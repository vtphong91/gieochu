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
  getSubscriptionOverview,
  listSubscriptionInvoices,
  listSubscriptions,
  markInvoicePaid,
} from "../../lib/subscription-billing";
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
  sendEmailNowSpy.mockImplementation(async (message: { type: string }) =>
    message.type === "invoice_pending_manual" ? { ok: true } : actual.sendEmailNow(message as never),
  );
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
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
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
      createRenewalInvoice(tenant.id, { planId: creatorPlan.id, provider: "MANUAL_QR" }, { scheduleNotification }),
      createRenewalInvoice(tenant.id, { planId: creatorPlan.id, provider: "MANUAL_QR" }, { scheduleNotification }),
    ]);
    expect(reused.id).toBe(manualInvoice.id);
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

    // ADR-056: System Center "Tất cả" invoices tab + /admin/subscriptions read the same rows (read-only, L1).
    const paidSepay = await listSubscriptionInvoices({ status: "PAID", provider: "SEPAY", page: 1, pageSize: 100 });
    const listed = paidSepay.items.find((i) => i.id === invoice.id);
    expect(listed).toMatchObject({ code: invoice.code, status: "PAID", amountVnd: proPlan.priceVnd, tenant: { slug: tenant.slug } });
    expect(listed?.paidAt).toBeInstanceOf(Date);
    expect(paidSepay.items.every((i) => i.status === "PAID" && i.provider === "SEPAY")).toBe(true);
    const manualOnly = await listSubscriptionInvoices({ provider: "MANUAL_QR", page: 1, pageSize: 100 });
    expect(manualOnly.items.some((i) => i.id === invoice.id)).toBe(false);

    const creatorActive = await listSubscriptions({ planCode: "CREATOR", status: "ACTIVE", page: 1, pageSize: 100 });
    const listedSub = creatorActive.items.find((s) => s.tenant.id === tenant.id);
    expect(listedSub?.latestInvoice).toEqual({ id: invoice.id, code: invoice.code, status: "PAID", amountVnd: proPlan.priceVnd, provider: "SEPAY" });
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
    const underpaid = await sendEvent("under", renewal.amountVnd - 2_000, renewal.code);
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

    await runSubscriptionSweep();
    let subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription.status).toBe("GRACE");
    expect(subscription.graceEndsAt).not.toBeNull();
    expect(subscription.planId).toBe(creatorPlan.id);

    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { graceEndsAt: new Date(Date.now() - 60 * 1000) },
    });

    await runSubscriptionSweep();
    subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.plan.isFree).toBe(true);

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
