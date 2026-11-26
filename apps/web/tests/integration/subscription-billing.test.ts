import { createHmac } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { encryptSecret } from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { createTenantForUser } from "../../lib/create-tenant";
import {
  confirmInvoiceFromPlatformTransaction,
  confirmManualInvoicePayment,
  createRenewalInvoice,
  getAdminSubscriptionDetail,
  getSubscriptionOverview,
  invoiceStatusTargets,
  listSubscriptionInvoices,
  listSubscriptions,
  markInvoicePaid,
  reopenSubscriptionInvoice,
  voidSubscriptionInvoice,
} from "../../lib/subscription-billing";
import { getSystemSettings } from "../../lib/system-settings";
import { listPlatformTransactions } from "../../lib/platform-transactions";
import { runSubscriptionSweep } from "../../lib/subscription-sweep";
import { assertPlanLimit } from "../../lib/plan-limits";
import { assertTenantCanWrite } from "../../lib/tenant-write-guard";
import { getPublishedProducts } from "../../lib/storefront";
import { POST as platformWebhook } from "../../app/api/webhooks/platform/[provider]/route";
import type { CurrentUser } from "../../lib/session";

const { PLATFORM_SEPAY_SECRET } = vi.hoisted(() => ({ PLATFORM_SEPAY_SECRET: "m3-platform-sepay-secret" }));

// ADR-034: DB dev = production — test KHÔNG ghi `platform_payment_configs` (cổng thu phí SaaS thật). Tạo hoá đơn gia hạn và
// webhook platform đọc cấu hình qua `getPlatformPaymentConfigRow` → thay bằng dòng SePay giả trong bộ nhớ (provider
// khác → null, coi như chưa cấu hình).
vi.mock("../../lib/platform-payment", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/platform-payment")>();
  return {
    ...actual,
    getPlatformPaymentConfigRow: async (provider: string) => {
      const now = new Date();
      // ADR-059: QR thủ công giả (không secret) để kiểm email báo admin khi có hoá đơn chờ đối soát.
      if (provider === "MANUAL_QR") {
        return {
          id: "test-platform-manual-qr",
          provider: "MANUAL_QR" as const,
          isEnabled: true,
          publicConfig: { bankBin: "970436", accountNo: "0000000001", accountName: "GIEO CHU" },
          encryptedSecrets: encryptSecret(JSON.stringify({}), getEnv().PAYMENT_ENCRYPTION_KEY),
          webhookSecretHash: null,
          lastVerifiedAt: null,
          createdAt: now,
          updatedAt: now,
        };
      }
      if (provider !== "SEPAY") return null;
      return {
        id: "test-platform-sepay",
        provider: "SEPAY" as const,
        isEnabled: true,
        publicConfig: { bankBin: "970436", accountNo: "0000000001", accountName: "GIEO CHU", authType: "HMAC_SHA256", paymentPrefix: "SUB" },
        encryptedSecrets: encryptSecret(JSON.stringify({ secret: PLATFORM_SEPAY_SECRET }), getEnv().PAYMENT_ENCRYPTION_KEY),
        webhookSecretHash: null,
        lastVerifiedAt: null,
        createdAt: now,
        updatedAt: now,
      };
    },
  };
});

// ADR-059: không ghi/đọc "Email hỗ trợ" thật (cấu hình dùng chung) và không gửi email báo admin thật — loại email khác giữ nguyên.
const { sendEmailNowSpy, supportEmailMock } = vi.hoisted(() => ({ sendEmailNowSpy: vi.fn(), supportEmailMock: vi.fn() }));
vi.mock("../../lib/email-dispatch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/email-dispatch")>();
  // ADR-070: runSubscriptionSweep quét TOÀN DB dùng chung → chặn MỌI email "subscription_*": email hoá đơn gói
  // (subscription_invoice_*) lẫn email của sweep thuê bao (subscription_reminder_7d / _reminder_1d / _grace / _downgraded_to_free).
  // ADR-071 (2A): email hoá đơn gói tới địa chỉ CỦA TEST (m3test_*) vẫn ghi email_send_log như gửi thật (không gửi SMTP) để kiểm dòng
  // "Đã gửi email" của nhật ký; địa chỉ khác (sweep chạm dữ liệu thật) không ghi gì. Dọn trong afterAll.
  sendEmailNowSpy.mockImplementation(async (message: { type: string; to: string; subject: string }) => {
    if (message.type === "invoice_pending_manual" || message.type.startsWith("subscription_")) {
      if (message.type.startsWith("subscription_invoice_") && message.to.startsWith("m3test_")) {
        await actual.logEmailSend({ type: message.type, recipient: message.to, subject: message.subject, status: "SENT" });
      }
      return { ok: true };
    }
    return actual.sendEmailNow(message as never);
  });
  return { ...actual, sendEmailNow: sendEmailNowSpy };
});
vi.mock("../../lib/system-settings", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/system-settings")>();
  return { ...actual, getSupportEmail: supportEmailMock };
});

const prisma = getPrismaClient();
const RUN_PREFIX = `m3test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.com`;
}

async function createActiveUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: "not-used-in-this-test", status: "ACTIVE", emailVerifiedAt: new Date() },
  });
}

function toCurrentUser(userId: string): CurrentUser {
  return { userId, familyId: "test-family", role: "USER", emailVerified: true, profileCompleted: true };
}

/** ADR-070: email hoá đơn gói đã "gửi" (qua spy) theo loại + mã hoá đơn trong tiêu đề. */
function invoiceEmails(type: string, invoiceCode: string): Array<{ type: string; to: string; subject: string; text: string }> {
  return sendEmailNowSpy.mock.calls
    .map(([message]) => message as { type: string; to: string; subject: string; text: string })
    .filter((message) => message.type === type && message.subject.includes(invoiceCode));
}

function signedSepayRequest(rawBody: string): Request {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac("sha256", PLATFORM_SEPAY_SECRET).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  return new Request("http://localhost/api/webhooks/platform/sepay", {
    method: "POST",
    headers: { "x-sepay-signature": signature, "x-sepay-timestamp": timestamp },
    body: rawBody,
  });
}

describe("M3 subscription and platform billing", () => {
  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await prisma.platformPaymentTransaction.deleteMany({
        where: { matchedInvoice: { tenantId: { in: tenantIds } } },
      });
      // ADR-059 (B2): giao dịch chưa khớp (matchedInvoiceId null) của lần chạy này — nhận theo id sự kiện evt_{RUN_PREFIX}_*.
      await prisma.platformPaymentTransaction.deleteMany({
        where: { rawPayload: { path: ["id"], string_starts_with: `evt_${RUN_PREFIX}` } },
      });
      await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: { in: tenantIds } } });
      // products/tenant_members are RLS-protected (L2) — a plain deleteMany is silently
      // filtered to zero rows outside a scoped session, same as M7's cleanup.
      await withSystemJob(async (tx) => {
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    // ADR-071: dòng email_send_log do mock ghi cho địa chỉ của lần chạy này.
    await prisma.emailSendLog.deleteMany({ where: { recipient: { startsWith: RUN_PREFIX } } });
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    // ADR-067 bổ sung: gói tạm (đã ngừng bán) của lần chạy này — hoá đơn tham chiếu đã xoá ở trên.
    await prisma.plan.deleteMany({ where: { code: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("creating a tenant opens an ACTIVE subscription on the FREE plan, which never expires", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Free Test", slug: `${RUN_PREFIX}-free` });

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.plan.isFree).toBe(true);
    expect(subscription.currentPeriodEnd.getTime()).toBeLessThanOrEqual(subscription.currentPeriodStart.getTime() + 1);

    // ADR-059: hoá đơn QR thủ công vừa tạo → đúng 1 email báo admin tới "Email hỗ trợ"; tạo lại khi còn hoá đơn chờ
    // (dùng lại hoá đơn cũ) không báo nữa; Email hỗ trợ trống → bỏ qua, không lỗi.
    const creatorPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });
    const scheduled: Array<() => Promise<void>> = [];
    const scheduleNotification = (task: () => Promise<void>) => void scheduled.push(task);
    // ADR-059 (B2): hai lần tạo SONG SONG (khoá dòng subscriptions) → cùng một hoá đơn, chỉ 1 hoá đơn PENDING.
    const [manualInvoice, reused] = await Promise.all([
      createRenewalInvoice(tenant.id, { planId: creatorPlan.id, provider: "MANUAL_QR" }, { scheduleNotification, actorId: owner.id }),
      createRenewalInvoice(tenant.id, { planId: creatorPlan.id, provider: "MANUAL_QR" }, { scheduleNotification, actorId: owner.id }),
    ]);
    expect(reused.id).toBe(manualInvoice.id);
    // ADR-071: audit "Tạo hoá đơn" chỉ khi thật sự tạo — lần dùng lại hoá đơn chờ không ghi.
    const createdAudits = await prisma.auditLog.findMany({ where: { action: "SUBSCRIPTION_INVOICE_CREATED", targetId: manualInvoice.id } });
    expect(createdAudits).toHaveLength(1);
    expect(createdAudits[0]).toMatchObject({ actorId: owner.id, scope: "SYSTEM", tenantId: tenant.id, targetType: "SubscriptionInvoice" });
    expect(createdAudits[0]!.metadata).toMatchObject({ code: manualInvoice.code, planId: creatorPlan.id, provider: "MANUAL_QR", amountVnd: creatorPlan.priceVnd });
    expect(await prisma.subscriptionInvoice.count({ where: { tenantId: tenant.id, status: "PENDING" } })).toBe(1);
    expect(scheduled).toHaveLength(1);

    sendEmailNowSpy.mockClear();
    supportEmailMock.mockResolvedValueOnce(null);
    await scheduled[0]!();
    supportEmailMock.mockResolvedValueOnce(`${RUN_PREFIX}_support@example.test`);
    await scheduled[0]!();
    const notices = sendEmailNowSpy.mock.calls.map(([message]) => message).filter((message) => message.type === "invoice_pending_manual");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ to: `${RUN_PREFIX}_support@example.test`, subject: expect.stringContaining(manualInvoice.code) });
    expect(notices[0].text).toContain("/admin/billing/invoices");
    expect(notices[0].text).toContain(tenant.slug);

    // ADR-059 bổ sung — xác nhận tay hoá đơn EXPIRED: (1) chặn khi gian hàng có hoá đơn tạo sau đang PENDING/PAID;
    // (2) kỳ tính lại theo lúc xác nhận (không dùng kỳ cũ đã lưu); (3) hai lần bấm song song chỉ gia hạn một lần + audit.
    const dayMs = 24 * 60 * 60 * 1000;
    const stalePeriod = { periodStart: new Date(Date.now() - 10 * dayMs), periodEnd: new Date(Date.now() + 20 * dayMs) };
    await prisma.subscriptionInvoice.update({
      where: { id: manualInvoice.id },
      data: { status: "EXPIRED", dueAt: new Date(Date.now() - 9 * dayMs), ...stalePeriod },
    });
    const newer = await createRenewalInvoice(tenant.id, { planId: creatorPlan.id, provider: "MANUAL_QR" });
    expect(newer.id).not.toBe(manualInvoice.id);
    await expect(confirmManualInvoicePayment(manualInvoice.id, owner.id)).rejects.toMatchObject({ code: "NEWER_INVOICE_EXISTS", httpStatus: 409 });
    expect((await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: manualInvoice.id } })).status).toBe("EXPIRED");

    await prisma.subscriptionInvoice.update({ where: { id: newer.id }, data: { status: "VOID" } });
    const confirmStartedAt = Date.now();
    await Promise.all([confirmManualInvoicePayment(manualInvoice.id, owner.id), confirmManualInvoicePayment(manualInvoice.id, owner.id)]);
    const lateInvoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: manualInvoice.id } });
    expect(lateInvoice.status).toBe("PAID");
    expect(lateInvoice.paidAt!.getTime()).toBeGreaterThanOrEqual(confirmStartedAt - 1_000);
    expect(lateInvoice.periodStart.getTime()).toBeGreaterThanOrEqual(confirmStartedAt - 1_000);
    expect(lateInvoice.periodEnd.getTime()).not.toBe(stalePeriod.periodEnd.getTime());
    const lateSubscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    expect(lateSubscription.planId).toBe(creatorPlan.id);
    expect(lateSubscription.currentPeriodStart.getTime()).toBe(lateInvoice.periodStart.getTime());
    expect(lateSubscription.currentPeriodEnd.getTime()).toBe(lateInvoice.periodEnd.getTime());
    const lateAudits = await prisma.auditLog.findMany({ where: { action: "SUBSCRIPTION_PAID", targetId: manualInvoice.id } });
    expect(lateAudits).toHaveLength(1);
    expect(lateAudits[0]!.metadata).toMatchObject({ previousInvoiceStatus: "EXPIRED", lateConfirmation: true, periodRecomputed: true });
    // ADR-070 A1: xác nhận trễ (2 lần bấm song song) → đúng 1 email "thanh toán thành công" cho chủ gian hàng.
    expect(invoiceEmails("subscription_invoice_paid", manualInvoice.code)).toHaveLength(1);
    expect(invoiceEmails("subscription_invoice_paid", manualInvoice.code)[0]).toMatchObject({ to: owner.email });

    // ADR-067 — "Đổi trạng thái" hoá đơn gói: bảng chuyển trạng thái; hoá đơn đã trả không huỷ/mở lại được; huỷ PENDING → VOID;
    // mở lại chỉ cho hoá đơn mới nhất và khi không có hoá đơn PENDING khác; mở lại đặt hạn mới + tính lại kỳ, giữ mã/số tiền.
    expect(invoiceStatusTargets("PENDING")).toEqual(["PAID", "VOID"]);
    expect(invoiceStatusTargets("EXPIRED")).toEqual(["PAID", "PENDING", "VOID"]);
    expect(invoiceStatusTargets("VOID")).toEqual(["PENDING"]);
    expect([invoiceStatusTargets("PAID"), invoiceStatusTargets("REFUNDED")]).toEqual([[], []]);
    await expect(voidSubscriptionInvoice(manualInvoice.id, owner.id)).rejects.toMatchObject({ code: "INVOICE_NOT_VOIDABLE", httpStatus: 409 });
    await expect(reopenSubscriptionInvoice(manualInvoice.id, owner.id)).rejects.toMatchObject({ code: "INVOICE_NOT_REOPENABLE", httpStatus: 409 });
    expect((await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: manualInvoice.id } })).status).toBe("PAID");

    const latestInvoice = await createRenewalInvoice(tenant.id, { planId: creatorPlan.id, provider: "MANUAL_QR" });
    expect(latestInvoice.status).toBe("PENDING");
    await expect(reopenSubscriptionInvoice(newer.id, owner.id)).rejects.toMatchObject({ code: "INVOICE_NOT_LATEST", httpStatus: 409 });
    await voidSubscriptionInvoice(latestInvoice.id, owner.id, "  Khách đổi ý  ");
    expect((await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: latestInvoice.id } })).status).toBe("VOID");
    const voidAudit = await prisma.auditLog.findFirstOrThrow({ where: { action: "SUBSCRIPTION_INVOICE_VOIDED", targetId: latestInvoice.id } });
    expect(voidAudit).toMatchObject({ scope: "SYSTEM", tenantId: tenant.id, actorId: owner.id, targetType: "SubscriptionInvoice" });
    expect(voidAudit.metadata).toMatchObject({ fromStatus: "PENDING", toStatus: "VOID", note: "Khách đổi ý" });
    // ADR-070 A5: chủ gian hàng nhận đúng 1 email "hoá đơn đã bị huỷ" — KHÔNG chứa ghi chú của admin.
    const voidedEmails = invoiceEmails("subscription_invoice_voided", latestInvoice.code);
    expect(voidedEmails).toHaveLength(1);
    expect(voidedEmails[0]).toMatchObject({ to: owner.email });
    expect(voidedEmails[0]!.text).not.toContain("Khách đổi ý");

    // Hoá đơn cũ hơn còn PENDING (đã quá hạn, chưa sweep) → chặn mở lại hoá đơn mới nhất.
    await prisma.subscriptionInvoice.update({ where: { id: newer.id }, data: { status: "PENDING", dueAt: new Date(Date.now() - 60_000) } });
    await expect(reopenSubscriptionInvoice(latestInvoice.id, owner.id)).rejects.toMatchObject({ code: "PENDING_INVOICE_EXISTS", httpStatus: 409 });
    await voidSubscriptionInvoice(newer.id, owner.id);
    expect((await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: newer.id } })).status).toBe("VOID");

    const { invoicePendingTtlHours } = await getSystemSettings();
    const ttlMs = invoicePendingTtlHours * 60 * 60 * 1000;
    const reopenStartedAt = Date.now();
    await reopenSubscriptionInvoice(latestInvoice.id, owner.id);
    const reopenFinishedAt = Date.now();
    const reopened = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: latestInvoice.id } });
    expect(reopened).toMatchObject({ status: "PENDING", code: latestInvoice.code, amountVnd: latestInvoice.amountVnd, provider: "MANUAL_QR" });
    expect(reopened.dueAt.getTime()).toBeGreaterThanOrEqual(reopenStartedAt + ttlMs - 1_000);
    expect(reopened.dueAt.getTime()).toBeLessThanOrEqual(reopenFinishedAt + ttlMs + 1_000);
    // Thuê bao đang còn hạn (vừa xác nhận trễ) → kỳ mới nối tiếp currentPeriodEnd.
    expect(reopened.periodStart.getTime()).toBe(lateSubscription.currentPeriodEnd.getTime());
    expect(reopened.periodEnd.getTime()).toBeGreaterThan(reopened.periodStart.getTime());
    const reopenAudit = await prisma.auditLog.findFirstOrThrow({ where: { action: "SUBSCRIPTION_INVOICE_REOPENED", targetId: latestInvoice.id } });
    expect(reopenAudit.metadata).toMatchObject({
      fromStatus: "VOID",
      toStatus: "PENDING",
      dueAt: reopened.dueAt.toISOString(),
      periodStart: reopened.periodStart.toISOString(),
      periodEnd: reopened.periodEnd.toISOString(),
    });
    expect(reopenAudit.metadata).not.toHaveProperty("note");

    // ADR-067 bổ sung: hoá đơn (mới nhất, đã huỷ) của gói đã ngừng bán không mở lại được. Gói tạm của lần chạy này — không
    // sửa gói thật dùng chung; dọn trong afterAll.
    await voidSubscriptionInvoice(latestInvoice.id, owner.id);
    const inactivePlan = await prisma.plan.create({
      data: {
        code: `${RUN_PREFIX}_INACTIVE`,
        name: "Gói tạm ngừng bán (test)",
        priceVnd: creatorPlan.priceVnd,
        interval: creatorPlan.interval,
        intervalCount: creatorPlan.intervalCount,
        maxProducts: creatorPlan.maxProducts,
        storageMb: creatorPlan.storageMb,
        maxFileMb: creatorPlan.maxFileMb,
        isActive: false,
      },
    });
    const inactivePlanInvoice = await prisma.subscriptionInvoice.create({
      data: {
        tenantId: tenant.id,
        planId: inactivePlan.id,
        code: `${RUN_PREFIX}_INACTIVE`,
        provider: "MANUAL_QR",
        status: "VOID",
        amountVnd: inactivePlan.priceVnd,
        periodStart: new Date(),
        periodEnd: new Date(Date.now() + 30 * dayMs),
        dueAt: new Date(Date.now() - 60_000),
      },
    });
    await expect(reopenSubscriptionInvoice(inactivePlanInvoice.id, owner.id)).rejects.toMatchObject({ code: "PLAN_INACTIVE", httpStatus: 409 });
    expect((await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: inactivePlanInvoice.id } })).status).toBe("VOID");

    // ADR-069 — chi tiết đơn hàng gói: id lạ → null; hoá đơn mới nhất trước kèm statusTargets; nhật ký có huỷ/mở lại (ghi chú,
    // người làm, mã hoá đơn) và xác nhận trễ, mới nhất trước.
    expect(await getAdminSubscriptionDetail(`${RUN_PREFIX}_missing`)).toBeNull();
    const subscriptionRow = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    const detail = (await getAdminSubscriptionDetail(subscriptionRow.id))!;
    expect(detail).toMatchObject({ id: subscriptionRow.id, tenant: { id: tenant.id, slug: tenant.slug }, plan: { code: "CREATOR" } });
    expect(detail.invoices.map((i) => i.id)).toEqual([inactivePlanInvoice.id, latestInvoice.id, newer.id, manualInvoice.id]);
    expect(detail.invoices[0]!.statusTargets).toEqual(["PENDING"]);
    expect(detail.invoices.find((i) => i.id === manualInvoice.id)!.statusTargets).toEqual([]);
    const activityTimes = detail.activity.map((a) => a.createdAt.getTime());
    expect(activityTimes).toEqual([...activityTimes].sort((a, b) => b - a));
    // ADR-071 (2A): dòng nhật ký chi tiết — huỷ/mở lại, thanh toán trễ (Quản trị viên, EXPIRED → PAID), tạo hoá đơn (audit + suy ra),
    // email đã gửi (ghi email_send_log qua mock).
    const ownerActor = { label: owner.email, role: "TENANT_OWNER" };
    expect(detail.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: "INVOICE_VOIDED",
          action: "SUBSCRIPTION_INVOICE_VOIDED",
          actionLabel: "Huỷ hoá đơn gói dịch vụ",
          invoice: { code: latestInvoice.code, amountVnd: latestInvoice.amountVnd, provider: "MANUAL_QR" },
          fromStatus: "PENDING",
          toStatus: "VOID",
          note: "Khách đổi ý",
          actor: ownerActor,
        }),
        expect.objectContaining({ kind: "INVOICE_REOPENED", fromStatus: "VOID", toStatus: "PENDING", note: null }),
        expect.objectContaining({
          kind: "PAYMENT",
          invoice: expect.objectContaining({ code: manualInvoice.code }),
          paymentSource: "ADMIN_MANUAL",
          lateConfirmation: true,
          fromStatus: "EXPIRED",
          toStatus: "PAID",
          bankTransactions: [],
          receivedVnd: null,
        }),
        expect.objectContaining({
          kind: "INVOICE_CREATED",
          inferred: false,
          actor: ownerActor,
          planName: creatorPlan.name,
          invoice: expect.objectContaining({ code: manualInvoice.code }),
        }),
        expect.objectContaining({
          id: `created:${inactivePlanInvoice.id}`,
          kind: "INVOICE_CREATED",
          action: null,
          inferred: true,
          actor: null,
          planName: inactivePlan.name,
          createdAt: inactivePlanInvoice.createdAt,
        }),
        expect.objectContaining({
          kind: "EMAIL",
          invoice: expect.objectContaining({ code: latestInvoice.code }),
          email: { kind: "INVOICE_VOIDED", status: "SENT", recipientIsCurrentOwner: true, recipientMasked: null },
        }),
        expect.objectContaining({
          kind: "EMAIL",
          invoice: expect.objectContaining({ code: manualInvoice.code }),
          email: expect.objectContaining({ kind: "INVOICE_PAID", status: "SENT" }),
        }),
      ]),
    );
    // Hoá đơn tạo qua createRenewalInvoice có audit → không có dòng suy ra trùng.
    expect(detail.activity.some((a) => a.id === `created:${manualInvoice.id}`)).toBe(false);
  });

  it("creates a renewal invoice and marks it PAID via a signed platform SePay webhook, activating the subscription", async () => {
    const proPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });

    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Sepay Billing", slug: `${RUN_PREFIX}-sepay-paid` });

    const invoice = await createRenewalInvoice(tenant.id, { planId: proPlan.id, provider: "SEPAY" });
    expect(invoice.status).toBe("PENDING");
    expect(invoice.amountVnd).toBe(proPlan.priceVnd);
    // ADR-065: mã hoá đơn = tiền tố SePay đã cấu hình + 8 chữ số (SePay chỉ nhận diện hậu tố toàn số).
    expect(invoice.code).toMatch(/^SUB[1-9]\d{7}$/);

    const rawBody = JSON.stringify({
      id: `evt_${RUN_PREFIX}_paid`,
      content: `thanh toan ${invoice.code}`,
      transferType: "in",
      transferAmount: invoice.amountVnd,
      transactionDate: "2026-01-01 10:00:00",
    });

    const response = await platformWebhook(signedSepayRequest(rawBody), { params: Promise.resolve({ provider: "sepay" }) });
    expect(response.status).toBe(200);

    const { subscription, invoices } = await getSubscriptionOverview(tenant.id);
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.planId).toBe(proPlan.id);
    expect(invoices.find((i) => i.id === invoice.id)?.status).toBe("PAID");
    // ADR-070 A1: webhook áp hoá đơn → đúng 1 email thành công cho chủ gian hàng, nút về trang Gói dịch vụ.
    const paidEmails = invoiceEmails("subscription_invoice_paid", invoice.code);
    expect(paidEmails).toHaveLength(1);
    expect(paidEmails[0]).toMatchObject({ to: owner.email });
    expect(paidEmails[0]!.text).toContain(`/studio/${tenant.slug}/billing`);
    expect(paidEmails[0]!.subject).toBe(`Thanh toán thành công hoá đơn ${invoice.code} — gói ${proPlan.name}`);
    expect(paidEmails[0]!.text).toMatch(/có hiệu lực từ \d{2}\/\d{2}\/\d{4} đến \d{2}\/\d{2}\/\d{4}/);
    // ADR-071 (2A): nhật ký — thanh toán tự động qua SePay kèm giao dịch ngân hàng (chỉ trường trích, không payload thô) + email đã gửi.
    const paidSubscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    const paidDetail = (await getAdminSubscriptionDetail(paidSubscription.id))!;
    const autoPayment = paidDetail.activity.find((a) => a.kind === "PAYMENT");
    expect(autoPayment).toMatchObject({
      paymentSource: "AUTO_SEPAY",
      actor: null,
      lateConfirmation: false,
      fromStatus: "PENDING",
      toStatus: "PAID",
      receivedVnd: invoice.amountVnd,
      differenceVnd: 0,
      bankTransactions: [
        {
          provider: "SEPAY",
          reference: `evt_${RUN_PREFIX}_paid`,
          occurredAt: new Date("2026-01-01T03:00:00.000Z"),
          contentExcerpt: `thanh toan ${invoice.code}`,
          amountVnd: invoice.amountVnd,
        },
      ],
    });
    expect(Object.keys(autoPayment!.bankTransactions[0]!).sort()).toEqual(["amountVnd", "contentExcerpt", "occurredAt", "provider", "reference"]);
    expect(paidDetail.activity).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: "EMAIL", email: { kind: "INVOICE_PAID", status: "SENT", recipientIsCurrentOwner: true, recipientMasked: null } }),
        expect.objectContaining({ kind: "INVOICE_CREATED", inferred: false, actor: null }),
      ]),
    );

    // ADR-056: System Center "Tất cả" invoices tab + /admin/subscriptions read the same rows (read-only, L1).
    const paidSepay = await listSubscriptionInvoices({ status: "PAID", provider: "SEPAY", page: 1, pageSize: 100 });
    const listed = paidSepay.items.find((i) => i.id === invoice.id);
    const tenantSubscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    expect(listed).toMatchObject({
      code: invoice.code,
      status: "PAID",
      amountVnd: proPlan.priceVnd,
      tenant: { slug: tenant.slug },
      subscriptionId: tenantSubscription.id,
      statusTargets: [],
    });
    expect(listed?.tenant).not.toHaveProperty("subscription");
    expect(listed?.paidAt).toBeInstanceOf(Date);
    expect(paidSepay.items.every((i) => i.status === "PAID" && i.provider === "SEPAY")).toBe(true);
    const manualOnly = await listSubscriptionInvoices({ provider: "MANUAL_QR", page: 1, pageSize: 100 });
    expect(manualOnly.items.some((i) => i.id === invoice.id)).toBe(false);

    const creatorActive = await listSubscriptions({ planCode: "CREATOR", status: "ACTIVE", page: 1, pageSize: 100 });
    const listedSub = creatorActive.items.find((s) => s.tenant.id === tenant.id);
    expect(listedSub?.latestInvoice).toEqual({
      id: invoice.id,
      code: invoice.code,
      status: "PAID",
      amountVnd: proPlan.priceVnd,
      provider: "SEPAY",
      statusTargets: [],
    });
    expect(creatorActive.items.every((s) => s.plan.code === "CREATOR" && s.status === "ACTIVE")).toBe(true);
  });

  it("processes a duplicate webhook event idempotently (no double transaction, no error)", async () => {
    const proPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });

    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Sepay Dup", slug: `${RUN_PREFIX}-sepay-dup` });
    const invoice = await createRenewalInvoice(tenant.id, { planId: proPlan.id, provider: "SEPAY" });

    const rawBody = JSON.stringify({
      id: `evt_${RUN_PREFIX}_dup`,
      content: `thanh toan ${invoice.code}`,
      transferType: "in",
      transferAmount: invoice.amountVnd,
      transactionDate: "2026-01-01 10:00:00",
    });

    // ADR-059 (B2): webhook và admin áp cùng lúc → hoá đơn chỉ áp một lần, đúng 1 audit SUBSCRIPTION_PAID.
    const [first] = await Promise.all([
      platformWebhook(signedSepayRequest(rawBody), { params: Promise.resolve({ provider: "sepay" }) }),
      markInvoicePaid(invoice.id, { source: "ADMIN_MANUAL_CONFIRM" }),
    ]);
    const second = await platformWebhook(signedSepayRequest(rawBody), { params: Promise.resolve({ provider: "sepay" }) });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const transactionCount = await prisma.platformPaymentTransaction.count({ where: { matchedInvoiceId: invoice.id } });
    expect(transactionCount).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: "SUBSCRIPTION_PAID", targetId: invoice.id } })).toBe(1);
    // ADR-070 A1: webhook + admin cùng lúc + webhook lặp → chỉ 1 email thành công.
    expect(invoiceEmails("subscription_invoice_paid", invoice.code)).toHaveLength(1);

    // ADR-059 (B2): tab "Giao dịch cổng" — giao dịch khớp hiện "Đã áp"; giao dịch cùng mã nhưng sai tiền nằm ở "Chưa khớp",
    // phân loại AMOUNT_MISMATCH kèm hoá đơn mang mã đó.
    const wrongAmountBody = JSON.stringify({
      id: `evt_${RUN_PREFIX}_wrong_amount`,
      content: `thanh toan ${invoice.code}`,
      transferType: "in",
      transferAmount: invoice.amountVnd - 1_000,
      transactionDate: "2026-01-01 10:05:00",
    });
    expect((await platformWebhook(signedSepayRequest(wrongAmountBody), { params: Promise.resolve({ provider: "sepay" }) })).status).toBe(200);
    const applied = await listPlatformTransactions({ filter: "da-ap", page: 1, pageSize: 100 });
    expect(applied.items.find((row) => row.invoice?.id === invoice.id)).toMatchObject({ state: "APPLIED", reference: invoice.code, duplicateOfInvoice: false });
    const unmatched = await listPlatformTransactions({ filter: "chua-khop", page: 1, pageSize: 100 });
    const mismatch = unmatched.items.find((row) => row.providerTxnId === `evt_${RUN_PREFIX}_wrong_amount`);
    expect(mismatch).toMatchObject({ state: "AMOUNT_MISMATCH", amountVnd: invoice.amountVnd - 1_000, invoice: { id: invoice.id, code: invoice.code } });
    expect(mismatch).toMatchObject({ differenceVnd: -1_000, confirmable: false });

    // ADR-059 bổ sung lần 2: body hỏng / thiếu trường (chữ ký hợp lệ) → 400, không 500.
    expect((await platformWebhook(signedSepayRequest("not-json"), { params: Promise.resolve({ provider: "sepay" }) })).status).toBe(400);
    const missingFields = JSON.stringify({ id: `evt_${RUN_PREFIX}_missing`, transferType: "in", transferAmount: 1_000 });
    expect((await platformWebhook(signedSepayRequest(missingFields), { params: Promise.resolve({ provider: "sepay" }) })).status).toBe(400);

    // ADR-059 bổ sung lần 2 (a)(b): xác nhận hoá đơn từ giao dịch — thiếu tiền bị chặn; thừa tiền + hoá đơn SePay đã hết hạn → nhánh
    // trễ (tính lại kỳ), gắn giao dịch vào hoá đơn, audit ghi số chênh; giao dịch không dùng lại được.
    const findTxn = (eventId: string) =>
      prisma.platformPaymentTransaction.findFirstOrThrow({ where: { rawPayload: { path: ["id"], equals: eventId } } });
    const sendEvent = async (suffix: string, amount: number, code: string) => {
      const body = JSON.stringify({ id: `evt_${RUN_PREFIX}_${suffix}`, content: `ck ${code}`, transferType: "in", transferAmount: amount, transactionDate: "2026-01-02 09:00:00" });
      expect((await platformWebhook(signedSepayRequest(body), { params: Promise.resolve({ provider: "sepay" }) })).status).toBe(200);
      return findTxn(`evt_${RUN_PREFIX}_${suffix}`);
    };
    const renewal = await createRenewalInvoice(tenant.id, { planId: proPlan.id, provider: "SEPAY" });
    // ADR-070 A3: giao dịch sai tiền cho hoá đơn ĐÃ trả (wrong_amount ở trên) → không báo; cho hoá đơn chưa trả → đúng 1 email.
    expect(invoiceEmails("subscription_invoice_amount_mismatch", invoice.code)).toHaveLength(0);
    const underpaid = await sendEvent("under", renewal.amountVnd - 2_000, renewal.code);
    const mismatchEmails = invoiceEmails("subscription_invoice_amount_mismatch", renewal.code);
    expect(mismatchEmails).toHaveLength(1);
    expect(mismatchEmails[0]).toMatchObject({ to: owner.email });
    expect(mismatchEmails[0]!.text).toContain("thiếu 2.000 đ");
    expect(mismatchEmails[0]!.subject).toBe(`Hoá đơn ${renewal.code}: số tiền nhận được không khớp`);
    expect(mismatchEmails[0]!.text).toContain("không chuyển bù"); // nhánh THIẾU
    await expect(confirmInvoiceFromPlatformTransaction(underpaid.id, renewal.code, owner.id)).rejects.toMatchObject({ code: "TRANSACTION_UNDERPAID" });

    const overpaid = await sendEvent("over", renewal.amountVnd + 5_000, renewal.code);
    expect(overpaid.matchedInvoiceId).toBeNull();
    await prisma.subscriptionInvoice.update({ where: { id: renewal.id }, data: { status: "EXPIRED", dueAt: new Date(Date.now() - 60_000) } });
    await confirmInvoiceFromPlatformTransaction(overpaid.id, renewal.code.toLowerCase(), owner.id);
    const renewed = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: renewal.id } });
    expect(renewed.status).toBe("PAID");
    expect((await findTxn(`evt_${RUN_PREFIX}_over`)).matchedInvoiceId).toBe(renewal.id);
    expect((await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } })).currentPeriodEnd.getTime()).toBe(renewed.periodEnd.getTime());
    const txnAudit = await prisma.auditLog.findFirstOrThrow({ where: { action: "SUBSCRIPTION_PAID", targetId: renewal.id } });
    expect(txnAudit.metadata).toMatchObject({
      source: "ADMIN_TRANSACTION_CONFIRM",
      transactionId: overpaid.id,
      differenceVnd: 5_000,
      lateConfirmation: true,
      periodRecomputed: true,
    });
    await expect(confirmInvoiceFromPlatformTransaction(overpaid.id, renewal.code, owner.id)).rejects.toMatchObject({ code: "INVOICE_ALREADY_PAID" });
    // ADR-070 A1: xác nhận từ giao dịch → 1 email thành công; lần xác nhận lại bị chặn không gửi thêm.
    expect(invoiceEmails("subscription_invoice_paid", renewal.code)).toHaveLength(1);
    // ADR-071 (2A): nhật ký — Quản trị viên xác nhận từ giao dịch (trễ): đã nhận/chênh lệch, giao dịch đã chọn, EXPIRED → PAID.
    const txnSubscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    const txnPayment = (await getAdminSubscriptionDetail(txnSubscription.id))!.activity.find(
      (a) => a.kind === "PAYMENT" && a.invoice?.code === renewal.code,
    );
    expect(txnPayment).toMatchObject({
      paymentSource: "ADMIN_FROM_TRANSACTION",
      actor: { label: owner.email, role: "TENANT_OWNER" },
      lateConfirmation: true,
      fromStatus: "EXPIRED",
      toStatus: "PAID",
      receivedVnd: renewal.amountVnd + 5_000,
      differenceVnd: 5_000,
      bankTransactions: [expect.objectContaining({ provider: "SEPAY", reference: `evt_${RUN_PREFIX}_over`, amountVnd: renewal.amountVnd + 5_000 })],
    });
    await expect(confirmInvoiceFromPlatformTransaction(overpaid.id, invoice.code, owner.id)).rejects.toMatchObject({ code: "TRANSACTION_ALREADY_USED" });

    // ADR-066: tiền đã về nhưng webhook không tới → admin xác nhận tay hoá đơn SePay (mọi cổng), ghi chú không bắt buộc vào audit.
    const noWebhook = await createRenewalInvoice(tenant.id, { planId: proPlan.id, provider: "SEPAY" });
    await confirmManualInvoicePayment(noWebhook.id, owner.id, "  GD VietinBank 945T26B14AZ5VN4P  ");
    expect((await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: noWebhook.id } })).status).toBe("PAID");
    const manualAudit = await prisma.auditLog.findFirstOrThrow({ where: { action: "SUBSCRIPTION_PAID", targetId: noWebhook.id } });
    expect(manualAudit.metadata).toMatchObject({ source: "ADMIN_MANUAL_CONFIRM", provider: "SEPAY", note: "GD VietinBank 945T26B14AZ5VN4P" });
  });

  it("the hourly sweep downgrades an overdue paid subscription back to FREE, keeping the tenant sellable", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Sweep Test", slug: `${RUN_PREFIX}-sweep` });
    const creatorPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });

    // Upgrade at the DB level directly — this test is about the sweep's downgrade behavior, not the upgrade flow itself.
    const overduePeriodEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { planId: creatorPlan.id, currentPeriodEnd: overduePeriodEnd },
    });
    // ADR-070 A2: hoá đơn chờ quá hạn → sweep chuyển EXPIRED + đúng 1 email cho chủ gian hàng (sweep lần 2 không gửi lại).
    const overdueInvoice = await createRenewalInvoice(tenant.id, { provider: "SEPAY" });
    await prisma.subscriptionInvoice.update({ where: { id: overdueInvoice.id }, data: { dueAt: new Date(Date.now() - 60_000) } });

    // Chỉ quét tenant tạm của test (không đổi thuê bao/hoá đơn thật trên DB dùng chung).
    await runSubscriptionSweep({ tenantIds: [tenant.id] });
    expect((await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: overdueInvoice.id } })).status).toBe("EXPIRED");
    expect(invoiceEmails("subscription_invoice_expired", overdueInvoice.code)).toHaveLength(1);
    expect(invoiceEmails("subscription_invoice_expired", overdueInvoice.code)[0]).toMatchObject({
      to: owner.email,
      subject: `Hoá đơn gói dịch vụ ${overdueInvoice.code} đã hết hạn thanh toán`,
    });
    let subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription.status).toBe("GRACE");
    expect(subscription.graceEndsAt).not.toBeNull();
    expect(subscription.planId).toBe(creatorPlan.id);

    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { graceEndsAt: new Date(Date.now() - 60 * 1000) },
    });

    await runSubscriptionSweep({ tenantIds: [tenant.id] });
    subscription =await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.plan.isFree).toBe(true);
    expect(invoiceEmails("subscription_invoice_expired", overdueInvoice.code)).toHaveLength(1);

    // §"M3 v2" ADR-021: a lapsed paid subscription never sets the tenant READ_ONLY anymore — Free still sells.
    const tenantAfter = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(tenantAfter.status).toBe("ACTIVE");
  });

  it("a Free-plan tenant can publish within FREE's product limit, and assertPlanLimit blocks the next one", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Free Limit Test", slug: `${RUN_PREFIX}-freelimit` });
    const { subscription } = await getSubscriptionOverview(tenant.id);
    const freePlan = await prisma.plan.findUniqueOrThrow({ where: { id: subscription.planId } });
    expect(freePlan.isFree).toBe(true);

    await withTenant(tenant.id, async (tx) => {
      for (let i = 0; i < freePlan.maxProducts; i += 1) {
        await tx.product.create({ data: { tenantId: tenant.id, slug: `p-${i}`, title: `P${i}`, status: "PUBLISHED" } });
      }
    });

    await expect(assertPlanLimit(tenant.id, "products", 1)).rejects.toMatchObject({ code: "PRODUCT_LIMIT_REACHED" });

    await withTenant(tenant.id, (tx) => tx.product.updateMany({ where: { tenantId: tenant.id }, data: { status: "ARCHIVED" } }));
    await expect(assertPlanLimit(tenant.id, "products", 1)).resolves.toBeUndefined();
  });

  it("upgrading from Free to a paid plan computes the new period starting now and switches the plan immediately on payment", async () => {
    const creatorPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });

    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Upgrade Test", slug: `${RUN_PREFIX}-upgrade` });
    const before = await getSubscriptionOverview(tenant.id);
    expect(before.subscription.plan.isFree).toBe(true);

    const invoice = await createRenewalInvoice(tenant.id, { planId: creatorPlan.id, provider: "SEPAY" });
    const now = new Date();
    expect(invoice.periodStart.getTime()).toBeGreaterThanOrEqual(now.getTime() - 5_000);

    const rawBody = JSON.stringify({
      id: `evt_${RUN_PREFIX}_upgrade`,
      content: `thanh toan ${invoice.code}`,
      transferType: "in",
      transferAmount: invoice.amountVnd,
      transactionDate: "2026-01-01 10:00:00",
    });
    const response = await platformWebhook(signedSepayRequest(rawBody), { params: Promise.resolve({ provider: "sepay" }) });
    expect(response.status).toBe(200);

    const after = await getSubscriptionOverview(tenant.id);
    expect(after.subscription.status).toBe("ACTIVE");
    expect(after.subscription.plan.isFree).toBe(false);
    expect(after.subscription.planId).toBe(creatorPlan.id);
  });

  it("a READ_ONLY tenant cannot write new content, but a customer can still list its already-published products", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Read Only Test", slug: `${RUN_PREFIX}-readonly` });

    await withTenant(tenant.id, (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, slug: "old-doc", title: "Tài liệu cũ", status: "PUBLISHED" } }),
    );
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: "READ_ONLY" } });

    const readOnlyTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(() => assertTenantCanWrite(readOnlyTenant)).toThrow();

    const products = await getPublishedProducts(tenant.id);
    expect(products.some((p) => p.slug === "old-doc")).toBe(true);
  });
});
