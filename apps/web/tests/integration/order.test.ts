import { createHmac } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getPrismaClient, withCustomer, withPublic, withSystemJob, withTenant } from "@gieochu/db";
import type { CheckoutQrResult } from "@gieochu/payments";
import { QUEUE_NAMES } from "@gieochu/jobs";
import { getStartedQueue } from "../../lib/jobs";
import { createTenantForUser } from "../../lib/create-tenant";
import { saveTenantProviderConfig } from "../../lib/tenant-payment";
import { createCoupon } from "../../lib/coupon";
import {
  applyCouponToOrder,
  confirmOrderManually,
  createOrder,
  getOrderDetailView,
  getOrderForCustomer,
  initiateOrderCheckout,
  listOrdersPage,
  removeCouponFromOrder,
  runOrderSweep,
} from "../../lib/order";
import { addOrderNote, deleteOrderNote } from "../../lib/order-note";
import { listCustomersPage, updateCustomerNote } from "../../lib/customer-list";
import { processPaymentEvent } from "../../lib/payment-process";
import { listTenantTransactionsNeedingAction } from "../../lib/tenant-payment-transactions";
import { POST as tenantWebhook } from "../../app/api/webhooks/tenants/[tenantId]/[provider]/route";
import type { CurrentUser } from "../../lib/session";

// ADR-059: email báo chủ gian hàng (đơn chờ xác nhận tay) không gửi thật — chặn đúng loại này, loại khác giữ nguyên hành vi.
const { sendEmailNowSpy } = vi.hoisted(() => ({ sendEmailNowSpy: vi.fn() }));
vi.mock("../../lib/email-dispatch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/email-dispatch")>();
  sendEmailNowSpy.mockImplementation(async (message: { type: string }) =>
    message.type === "order_pending_manual" || message.type === "payment_mismatch" ? { ok: true } : actual.sendEmailNow(message as never),
  );
  return { ...actual, sendEmailNow: sendEmailNowSpy };
});

const prisma = getPrismaClient();
const RUN_PREFIX = `m8test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.test`;
}

async function createActiveUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: "not-used-in-this-test", status: "ACTIVE", emailVerifiedAt: new Date() },
  });
}

function toCurrentUser(userId: string): CurrentUser {
  return { userId, familyId: "test-family", role: "USER", emailVerified: true, profileCompleted: true };
}

async function createOwnerAndTenant(name: string, slug: string) {
  const owner = await createActiveUser(nextEmail());
  const created = await createTenantForUser(toCurrentUser(owner.id), { name, slug: `${RUN_PREFIX}-${slug}` });
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: created.id } });
  return { owner, tenant };
}

async function createPublishedProduct(tenantId: string, slug: string, priceVnd: number) {
  return withTenant(tenantId, (tx) =>
    tx.product.create({ data: { tenantId, slug, title: `Sản phẩm ${slug}`, status: "PUBLISHED", priceVnd } }),
  );
}

function signedSepayRequest(tenantId: string, secret: string, rawBody: string): Request {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  return new Request(`http://localhost/api/webhooks/tenants/${tenantId}/sepay`, {
    method: "POST",
    headers: { "x-sepay-signature": signature, "x-sepay-timestamp": timestamp },
    body: rawBody,
  });
}

describe("M8 checkout and orders", () => {
  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      // ADR-036: the SePay webhook test enqueues `payment.process` jobs (providerEventId evt_m8test_*) on the shared
      // pg-boss queue — delete exactly this run's jobs (matched by tenantId), first, so no real drain picks them up
      // while the rows below are being removed.
      const queue = await getStartedQueue();
      for (const tenantId of tenantIds) {
        const jobs = await queue.boss.findJobs(QUEUE_NAMES.PAYMENT_PROCESS, { data: { tenantId } });
        if (jobs.length > 0) {
          await queue.boss.deleteJob(QUEUE_NAMES.PAYMENT_PROCESS, jobs.map((job) => job.id));
        }
      }
      await withSystemJob(async (tx) => {
        await tx.entitlement.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.couponRedemption.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantPaymentTransaction.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.orderItem.deleteMany({ where: { order: { tenantId: { in: tenantIds } } } });
        await tx.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantCustomer.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.coupon.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantPaymentConfig.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.webhookEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("creates a PENDING order and a MANUAL_QR checkout returns the reference in the QR content", async () => {
    const { owner, tenant } = await createOwnerAndTenant("Manual QR Test", "manualqr");
    const product = await createPublishedProduct(tenant.id, "de-thi", 100_000);
    const buyer = await createActiveUser(nextEmail());

    await saveTenantProviderConfig(tenant.id, {
      provider: "MANUAL_QR",
      isEnabled: true,
      publicConfig: { bankBin: "970403", accountNo: "0011012345678", accountName: "NGUYEN VAN A" },
      secrets: {},
    });

    const order = await createOrder(buyer.id, tenant.slug, product.id);
    expect(order.status).toBe("PENDING");
    expect(order.totalVnd).toBe(100_000);

    const scheduled: Array<() => Promise<void>> = [];
    const scheduleNotification = (task: () => Promise<void>) => void scheduled.push(task);
    const updated = await initiateOrderCheckout(tenant.id, order.id, buyer.id, "MANUAL_QR", { scheduleNotification });
    const checkout = updated.checkoutPayload as unknown as CheckoutQrResult;
    expect(checkout.kind).toBe("QR");
    expect(checkout.content).toBe(order.code);

    // ADR-059: lần đầu đơn có QR thủ công → đúng 1 email báo chủ gian hàng (mã đơn, số tiền, link Studio); chọn lại cổng không báo nữa.
    expect(scheduled).toHaveLength(1);
    await initiateOrderCheckout(tenant.id, order.id, buyer.id, "MANUAL_QR", { scheduleNotification });
    expect(scheduled).toHaveLength(1);
    sendEmailNowSpy.mockClear();
    await scheduled[0]!();
    const notices = sendEmailNowSpy.mock.calls.map(([message]) => message).filter((message) => message.type === "order_pending_manual");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ to: owner.email, subject: expect.stringContaining(order.code) });
    expect(notices[0].text).toContain("100.000đ");
    expect(notices[0].text).toContain(`/studio/${tenant.slug}/orders/${order.id}`);

    // ADR-056 bổ sung: áp/gỡ mã SAU khi đã có QR → server tạo lại QR theo totalVnd mới (VietQR tag 54 = số tiền), nội dung CK giữ mã đơn.
    await createCoupon(tenant.id, { code: "QR10", type: "PERCENT", value: 10, isEnabled: true });
    const discounted = await applyCouponToOrder(tenant.id, order.id, buyer.id, "QR10");
    const discountedQr = discounted.checkoutPayload as unknown as CheckoutQrResult;
    expect(discounted.totalVnd).toBe(90_000);
    expect(discounted.provider).toBe("MANUAL_QR");
    expect(discountedQr.qrPayload).toContain("540590000");
    expect(discountedQr.qrPayload).not.toBe(checkout.qrPayload);
    expect(discountedQr.content).toBe(order.code);

    const restored = await removeCouponFromOrder(tenant.id, order.id, buyer.id);
    const restoredQr = restored.checkoutPayload as unknown as CheckoutQrResult;
    expect(restored.totalVnd).toBe(100_000);
    expect(restoredQr.qrPayload).toContain("5406100000");
    expect(restoredQr.content).toBe(order.code);
  });

  it("owner's manual confirm requires a note, then fulfills the order and grants an entitlement", async () => {
    const { tenant } = await createOwnerAndTenant("Manual Confirm Test", "manualconfirm");
    const product = await createPublishedProduct(tenant.id, "de-thi", 50_000);
    const buyer = await createActiveUser(nextEmail());
    const order = await createOrder(buyer.id, tenant.slug, product.id);

    await expect(confirmOrderManually(tenant.id, order.id, "")).rejects.toMatchObject({ code: "NOTE_REQUIRED" });

    await confirmOrderManually(tenant.id, order.id, "Đã đối chiếu sao kê ngân hàng lúc 10:30");

    const fulfilled = await getOrderDetailView(tenant.id, order.id);
    expect(fulfilled.status).toBe("FULFILLED");
    expect(fulfilled.paidAt).not.toBeNull();
    // ADR-056 bổ sung: đơn đã thanh toán không được áp/gỡ mã giảm giá.
    await expect(applyCouponToOrder(tenant.id, order.id, buyer.id, "ANY")).rejects.toMatchObject({ code: "ORDER_NOT_PENDING" });
    await expect(removeCouponFromOrder(tenant.id, order.id, buyer.id)).rejects.toMatchObject({ code: "ORDER_NOT_PENDING" });
    expect(fulfilled.confirmNote).toContain("đối chiếu");
    expect(fulfilled.allowedActions).toEqual(["view", "refund"]);

    const entitlement = await withTenant(tenant.id, (tx) =>
      tx.entitlement.findUnique({ where: { orderItemId: fulfilled.lines[0]!.id } }),
    );
    expect(entitlement?.userId).toBe(buyer.id);
    expect(entitlement?.downloadLimit).toBe(product.downloadLimit);
    expect(entitlement?.downloadsUsed).toBe(0);

    const customerStats = await withTenant(tenant.id, (tx) =>
      tx.tenantCustomer.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: buyer.id } } }),
    );
    expect(customerStats?.ordersCount).toBe(1);
    expect(customerStats?.totalSpentVnd).toBe(50_000);
  });

  it("a signed SePay webhook is accepted once and recorded idempotently on retry, an invalid signature is rejected", async () => {
    const { tenant } = await createOwnerAndTenant("Sepay Webhook Test", "sepaywebhook");
    const secret = "tenant-sepay-secret";
    await saveTenantProviderConfig(tenant.id, {
      provider: "SEPAY",
      isEnabled: true,
      publicConfig: { bankBin: "970403", accountNo: "0011012345678", accountName: "NGUYEN VAN A", authType: "HMAC_SHA256", paymentPrefix: tenant.orderCodePrefix },
      secrets: { secret },
    });

    const rawBody = JSON.stringify({
      id: `evt_${RUN_PREFIX}_1`,
      content: `thanh toan ${tenant.orderCodePrefix}ABCDEF`,
      transferType: "in",
      transferAmount: 10_000,
      transactionDate: "2026-01-01 10:00:00",
    });

    const badSignature = new Request(`http://localhost/api/webhooks/tenants/${tenant.id}/sepay`, {
      method: "POST",
      headers: { "x-sepay-signature": "sha256=invalid", "x-sepay-timestamp": "1" },
      body: rawBody,
    });
    const rejected = await tenantWebhook(badSignature, { params: Promise.resolve({ tenantId: tenant.id, provider: "sepay" }) });
    expect(rejected.status).toBe(401);

    const first = await tenantWebhook(signedSepayRequest(tenant.id, secret, rawBody), {
      params: Promise.resolve({ tenantId: tenant.id, provider: "sepay" }),
    });
    const second = await tenantWebhook(signedSepayRequest(tenant.id, secret, rawBody), {
      params: Promise.resolve({ tenantId: tenant.id, provider: "sepay" }),
    });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const eventCount = await prisma.webhookEvent.count({ where: { tenantId: tenant.id, providerEventId: `evt_${RUN_PREFIX}_1` } });
    expect(eventCount).toBe(1);

    // ADR-059 bổ sung lần 2: body hỏng / thiếu trường (chữ ký hợp lệ) → 400, không 500, không ghi webhook_events.
    const brokenBody = await tenantWebhook(signedSepayRequest(tenant.id, secret, "{not json"), {
      params: Promise.resolve({ tenantId: tenant.id, provider: "sepay" }),
    });
    expect(brokenBody.status).toBe(400);
    const missingFields = await tenantWebhook(signedSepayRequest(tenant.id, secret, JSON.stringify({ id: `evt_${RUN_PREFIX}_2`, transferType: "in" })), {
      params: Promise.resolve({ tenantId: tenant.id, provider: "sepay" }),
    });
    expect(missingFields.status).toBe(400);
    expect(await prisma.webhookEvent.count({ where: { tenantId: tenant.id, providerEventId: `evt_${RUN_PREFIX}_2` } })).toBe(0);
  });

  it("processPaymentEvent matches a SePay payment to its order and fulfills it", async () => {
    const { tenant } = await createOwnerAndTenant("Sepay Match Test", "sepaymatch");
    const product = await createPublishedProduct(tenant.id, "de-thi", 75_000);
    const buyer = await createActiveUser(nextEmail());
    const order = await createOrder(buyer.id, tenant.slug, product.id);

    await processPaymentEvent({
      tenantId: tenant.id,
      provider: "SEPAY",
      providerEventId: `evt_${RUN_PREFIX}_match`,
      reference: order.code,
      amountVnd: order.totalVnd,
      success: true,
      rawPayload: { test: true },
    });

    const fulfilled = await getOrderDetailView(tenant.id, order.id);
    expect(fulfilled.status).toBe("FULFILLED");
    expect(fulfilled.transactions.some((t) => t.matchStatus === "MATCHED")).toBe(true);
  });

  it("processPaymentEvent also fulfills via a MoMo IPN-shaped event", async () => {
    const { tenant } = await createOwnerAndTenant("Momo Match Test", "momomatch");
    const product = await createPublishedProduct(tenant.id, "de-thi", 30_000);
    const buyer = await createActiveUser(nextEmail());
    const order = await createOrder(buyer.id, tenant.slug, product.id);

    await processPaymentEvent({
      tenantId: tenant.id,
      provider: "MOMO",
      providerEventId: `evt_${RUN_PREFIX}_momo`,
      reference: order.code,
      amountVnd: order.totalVnd,
      success: true,
      rawPayload: { test: true },
    });

    const fulfilled = await getOrderDetailView(tenant.id, order.id);
    expect(fulfilled.status).toBe("FULFILLED");
  });

  it("a wrong amount leaves the order PENDING and records a MISMATCH_AMOUNT transaction", async () => {
    const { owner, tenant } = await createOwnerAndTenant("Mismatch Test", "mismatch");
    const product = await createPublishedProduct(tenant.id, "de-thi", 100_000);
    const buyer = await createActiveUser(nextEmail());
    const order = await createOrder(buyer.id, tenant.slug, product.id);

    await processPaymentEvent({
      tenantId: tenant.id,
      provider: "SEPAY",
      providerEventId: `evt_${RUN_PREFIX}_mismatch`,
      reference: order.code,
      amountVnd: 90_000,
      success: true,
      rawPayload: { test: true },
    });

    const stillPending = await getOrderDetailView(tenant.id, order.id);
    expect(stillPending.status).toBe("PENDING");
    expect(stillPending.allowedActions).toEqual(["view", "confirm", "cancel"]);
    expect(stillPending.transactions.some((t) => t.matchStatus === "MISMATCH_AMOUNT")).toBe(true);

    // ADR-059 bổ sung lần 2 (d): email báo chủ gian hàng đúng 1 lần (job chạy lại cùng giao dịch không báo lại) + Studio
    // "Giao dịch cần xử lý" (withTenant) liệt kê giao dịch sai tiền kèm đơn.
    const mismatchEmails = () =>
      sendEmailNowSpy.mock.calls.map(([message]) => message).filter((message) => message.type === "payment_mismatch" && message.to === owner.email);
    expect(mismatchEmails()).toHaveLength(1);
    expect(mismatchEmails()[0]).toMatchObject({ subject: expect.stringContaining(order.code) });
    expect(mismatchEmails()[0].text).toContain("thiếu 10.000đ");
    await expect(
      processPaymentEvent({
        tenantId: tenant.id,
        provider: "SEPAY",
        providerEventId: `evt_${RUN_PREFIX}_mismatch`,
        reference: order.code,
        amountVnd: 90_000,
        success: true,
        rawPayload: { test: true },
      }),
    ).rejects.toThrow();
    expect(mismatchEmails()).toHaveLength(1);
    const needingAction = await listTenantTransactionsNeedingAction(tenant.id, 1);
    expect(needingAction.items).toHaveLength(1);
    expect(needingAction.items[0]).toMatchObject({ matchStatus: "MISMATCH_AMOUNT", amountVnd: 90_000, order: { id: order.id, code: order.code } });
    // RLS thật (ADR-010/020): tenant B không thấy giao dịch nào của tenant A — qua hàm lib lẫn truy vấn SQL không lọc tenantId
    // dưới scope tenant B (chỉ policy RLS chặn).
    const { tenant: otherTenant } = await createOwnerAndTenant("Mismatch Other", "mismatchother");
    const otherView = await listTenantTransactionsNeedingAction(otherTenant.id, 1);
    expect(otherView.total).toBe(0);
    expect(otherView.items).toEqual([]);
    const leaked = await withTenant(otherTenant.id, (tx) =>
      tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "tenant_payment_transactions" WHERE "orderId" = ${order.id}`,
    );
    expect(leaked).toEqual([]);
    const ownRows = await withTenant(tenant.id, (tx) =>
      tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "tenant_payment_transactions" WHERE "orderId" = ${order.id}`,
    );
    expect(ownRows).toHaveLength(1);
  });

  it("the hourly sweep expires an overdue PENDING order without consuming its coupon", async () => {
    const { tenant } = await createOwnerAndTenant("Sweep Test", "sweep");
    const product = await createPublishedProduct(tenant.id, "de-thi", 100_000);
    const buyer = await createActiveUser(nextEmail());
    await createCoupon(tenant.id, { code: "SWEEP10", type: "PERCENT", value: 10, isEnabled: true });

    const order = await createOrder(buyer.id, tenant.slug, product.id);
    await applyCouponToOrder(tenant.id, order.id, buyer.id, "SWEEP10");
    await withTenant(tenant.id, (tx) => tx.order.update({ where: { id: order.id }, data: { expiresAt: new Date(Date.now() - 60_000) } }));

    await runOrderSweep();

    const expired = await getOrderDetailView(tenant.id, order.id);
    expect(expired.status).toBe("EXPIRED");
    // Vừa quá hạn (< 24 giờ) → vẫn xác nhận tay được, không huỷ được.
    expect(expired.allowedActions).toEqual(["view", "confirm"]);

    const coupon = await withTenant(tenant.id, (tx) => tx.coupon.findFirstOrThrow({ where: { tenantId: tenant.id, code: "SWEEP10" } }));
    expect(coupon.usedCount).toBe(0);
  });

  it("tenant A cannot read tenant B's orders, and a customer cannot read another customer's order", async () => {
    const { owner: ownerA, tenant: tenantA } = await createOwnerAndTenant("Isolation A", "isoa");
    const { owner: ownerB, tenant: tenantB } = await createOwnerAndTenant("Isolation B", "isob");
    const productA = await createPublishedProduct(tenantA.id, "de-thi", 20_000);
    const buyer1 = await createActiveUser(nextEmail());
    const buyer2 = await createActiveUser(nextEmail());

    const order = await createOrder(buyer1.id, tenantA.slug, productA.id);

    await expect(getOrderDetailView(tenantB.id, order.id)).rejects.toMatchObject({ httpStatus: 404 });
    const tenantBOrders = await listOrdersPage(tenantB.id, {});
    expect(tenantBOrders.items.some((o) => o.id === order.id)).toBe(false);
    expect(tenantBOrders.total).toBe(0);
    expect((await listOrdersPage(tenantB.id, { q: order.code })).total).toBe(0);

    const tenantAByCode = await listOrdersPage(tenantA.id, { q: order.code.toLowerCase() });
    expect(tenantAByCode.items.map((o) => o.id)).toEqual([order.id]);
    expect(tenantAByCode.items[0]!.allowedActions).toEqual(["view", "confirm", "cancel"]);
    // `%`/`_` là ký tự thường, không phải wildcard: "%" không khớp mọi đơn; "m8tes_" không khớp email "m8test_...".
    expect((await listOrdersPage(tenantA.id, { q: "%" })).total).toBe(0);
    expect((await listOrdersPage(tenantA.id, { q: "m8tes_" })).total).toBe(0);
    expect((await listOrdersPage(tenantA.id, { q: "m8test_" })).total).toBe(1);
    // ADR-047 mục 1: tìm không dấu / không phân biệt hoa thường theo họ tên khách (user_profiles, L1).
    await prisma.userProfile.create({ data: { userId: buyer1.id, fullName: "Nguyễn Văn Thử", consentAt: new Date() } });
    expect((await listOrdersPage(tenantA.id, { q: "nguyen van thu" })).items.map((o) => o.id)).toEqual([order.id]);
    expect((await listOrdersPage(tenantA.id, { q: "NGUYỄN" })).total).toBe(1);
    expect((await listOrdersPage(tenantB.id, { q: "nguyen" })).total).toBe(0);

    // ADR-047 mục 2: ghi chú nội bộ — RLS tenant, khách/public không đọc được, chỉ tác giả xoá, không sửa.
    const note = await addOrderNote(tenantA.id, order.id, ownerA.id, "  Khách hỏi xuất hoá đơn  ");
    const asOwner = await getOrderDetailView(tenantA.id, order.id, ownerA.id);
    expect(asOwner.notesAvailable).toBe(true);
    expect(asOwner.notes.map((n) => [n.id, n.body, n.canDelete])).toEqual([[note.id, "Khách hỏi xuất hoá đơn", true]]);
    expect(asOwner.timeline.some((e) => e.kind === "note" && e.noteId === note.id)).toBe(true);
    expect((await getOrderDetailView(tenantA.id, order.id, buyer1.id)).notes[0]!.canDelete).toBe(false);
    await expect(addOrderNote(tenantA.id, order.id, ownerA.id, "   ")).rejects.toMatchObject({ httpStatus: 400 });
    await expect(addOrderNote(tenantB.id, order.id, ownerB.id, "x")).rejects.toMatchObject({ httpStatus: 404 });
    await expect(
      withTenant(tenantB.id, (tx) => tx.orderNote.create({ data: { tenantId: tenantB.id, orderId: order.id, authorId: ownerB.id, body: "x" } })),
    ).rejects.toThrow();
    expect(await withCustomer(buyer1.id, (tx) => tx.orderNote.count({ where: { orderId: order.id } }))).toBe(0);
    expect(await withPublic((tx) => tx.orderNote.count({ where: { orderId: order.id } }))).toBe(0);
    expect(await withTenant(tenantB.id, (tx) => tx.orderNote.count({ where: { orderId: order.id } }))).toBe(0);
    await expect(
      withTenant(tenantA.id, (tx) => tx.orderNote.updateMany({ where: { id: note.id }, data: { body: "đã sửa" } })),
    ).rejects.toThrow();
    await expect(deleteOrderNote(tenantB.id, order.id, note.id, ownerB.id)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(deleteOrderNote(tenantA.id, order.id, note.id, buyer1.id)).rejects.toMatchObject({ httpStatus: 403 });
    await deleteOrderNote(tenantA.id, order.id, note.id, ownerA.id);
    expect((await getOrderDetailView(tenantA.id, order.id, ownerA.id)).notes).toEqual([]);

    // ADR-048: khách chỉ xuất hiện khi có đơn đã thanh toán; tenant B không thấy khách của A; ghi chú khách bị chặn chéo tenant.
    expect((await listCustomersPage(tenantA.id, {})).total).toBe(0);
    await confirmOrderManually(tenantA.id, order.id, "Đã đối chiếu sao kê");
    const customersA = await listCustomersPage(tenantA.id, { q: "nguyen van thu" });
    expect(customersA.items.map((c) => [c.userId, c.paidOrders, c.freeClaims, c.spentVnd, c.refundedVnd])).toEqual([[buyer1.id, 1, 0, 20_000, 0]]);
    expect(customersA.stats).toMatchObject({ totalCustomers: 1, payingCustomers: 1, returningCustomers: 0, spentVnd: 20_000, freeOnlyCustomers: 0 });
    expect(customersA.groupCounts).toMatchObject({ "tat-ca": 1, moi: 1, "quay-lai": 0, "mien-phi": 0 });
    expect((await listCustomersPage(tenantA.id, { q: "%" })).total).toBe(0);
    const customersB = await listCustomersPage(tenantB.id, {});
    expect(customersB.total).toBe(0);
    expect(customersB.stats.totalCustomers).toBe(0);
    expect((await listCustomersPage(tenantB.id, { q: "nguyen" })).items).toEqual([]);
    await expect(updateCustomerNote(tenantB.id, buyer1.id, "x", ownerB.id)).rejects.toMatchObject({ httpStatus: 404 });
    await expect(updateCustomerNote(tenantA.id, buyer1.id, "a".repeat(501), ownerA.id)).rejects.toMatchObject({ httpStatus: 400 });
    expect(await updateCustomerNote(tenantA.id, buyer1.id, "  Khách quen  ", ownerA.id)).toEqual({ note: "Khách quen" });
    expect((await listCustomersPage(tenantA.id, {})).items[0]!.note).toBe("Khách quen");
    expect(await withTenant(tenantB.id, (tx) => tx.tenantCustomer.count({ where: { userId: buyer1.id } }))).toBe(0);
    expect(await updateCustomerNote(tenantA.id, buyer1.id, "   ", ownerA.id)).toEqual({ note: null });
    // ADR-048: trang Đơn hàng lọc theo khách — chỉ khách thuộc gian hàng.
    const byCustomer = await listOrdersPage(tenantA.id, { khach: buyer1.id });
    expect([byCustomer.total, byCustomer.customer?.userId, byCustomer.query.customerId]).toEqual([1, buyer1.id, buyer1.id]);
    expect((await listOrdersPage(tenantA.id, { khach: buyer2.id })).query.customerId).toBeNull();
    const crossTenant = await listOrdersPage(tenantB.id, { khach: buyer1.id });
    expect([crossTenant.total, crossTenant.customer]).toEqual([0, null]);

    await expect(getOrderForCustomer(buyer2.id, order.code)).rejects.toMatchObject({ httpStatus: 404 });
    const ownOrder = await getOrderForCustomer(buyer1.id, order.code);
    expect(ownOrder.id).toBe(order.id);
  });

  it("a coupon is only consumed once an order is PAID, and concurrent orders never push usedCount past usageLimit", async () => {
    const { tenant } = await createOwnerAndTenant("Coupon Race Test", "couponrace");
    const product = await createPublishedProduct(tenant.id, "de-thi", 40_000);
    const buyer1 = await createActiveUser(nextEmail());
    const buyer2 = await createActiveUser(nextEmail());
    await createCoupon(tenant.id, { code: "RACE1", type: "FIXED", value: 5_000, usageLimit: 1, isEnabled: true });

    const order1 = await createOrder(buyer1.id, tenant.slug, product.id);
    const order2 = await createOrder(buyer2.id, tenant.slug, product.id);
    await applyCouponToOrder(tenant.id, order1.id, buyer1.id, "RACE1");
    await applyCouponToOrder(tenant.id, order2.id, buyer2.id, "RACE1");

    // Coupon usage isn't checked before payment — the order stays discounted even if the coupon
    // runs out by the time it's paid (§"M8"/docs/BACKLOG.md), so both confirms succeed here;
    // only the *redemption* row is capped by the atomic update inside markOrderPaid().
    await Promise.all([
      confirmOrderManually(tenant.id, order1.id, "confirm 1"),
      confirmOrderManually(tenant.id, order2.id, "confirm 2"),
    ]);

    const [fulfilled1, fulfilled2] = await Promise.all([getOrderDetailView(tenant.id, order1.id), getOrderDetailView(tenant.id, order2.id)]);
    expect(fulfilled1.status).toBe("FULFILLED");
    expect(fulfilled2.status).toBe("FULFILLED");

    const coupon = await withTenant(tenant.id, (tx) => tx.coupon.findFirstOrThrow({ where: { tenantId: tenant.id, code: "RACE1" } }));
    expect(coupon.usedCount).toBe(1);

    const redemptions = await withTenant(tenant.id, (tx) => tx.couponRedemption.findMany({ where: { couponId: coupon.id } }));
    expect(redemptions.length).toBe(1);
  });
});
