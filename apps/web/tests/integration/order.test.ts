import { createHmac } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import { getPrismaClient, withCustomer, withPublic, withSystemJob, withTenant } from "@gieochu/db";
import type { CheckoutQrResult } from "@gieochu/payments";
import { QUEUE_NAMES } from "@gieochu/jobs";
import { getStartedQueue, type PaymentProcessJobData } from "../../lib/jobs";
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
import { cancelOrderByCustomer, declareOrderPaid, runOrderPaymentReminders, undoDeclareOrderPaid } from "../../lib/order-customer";
import { getCheckoutView } from "../../lib/checkout-view";
import { activateGuestAccount, startGuestCheckout } from "../../lib/guest-checkout";
import { rateLimitKey } from "../../lib/rate-limit-store";
import { REFRESH_COOKIE_NAME } from "../../lib/cookies";
import { NextRequest } from "next/server";
import { POST as refreshRoute } from "../../app/api/auth/refresh/route";
import { POST as tenantWebhook } from "../../app/api/webhooks/tenants/[tenantId]/[provider]/route";
import type { CurrentUser } from "../../lib/session";

// ADR-059: email báo chủ gian hàng (đơn chờ xác nhận tay) không gửi thật — chặn đúng loại này, loại khác giữ nguyên hành vi.
const { sendEmailNowSpy } = vi.hoisted(() => ({ sendEmailNowSpy: vi.fn() }));
vi.mock("../../lib/email-dispatch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/email-dispatch")>();
  sendEmailNowSpy.mockImplementation(async (message: { type: string }) =>
    // ADR-061/062: email người bán/khách của luồng mua cũng chặn (không gửi thật).
    [
      "order_pending_manual",
      "payment_mismatch",
      "order_payment_customer",
      "order_payment_reminder",
      "order_customer_declared_paid",
      "guest_activation",
    ].includes(message.type)
      ? { ok: true }
      : actual.sendEmailNow(message as never),
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

    // ADR-062 Q3: hạn giữ đơn = lúc đặt đơn + 72 giờ (thủ công, mặc định).
    expect(updated.expiresAt.getTime() - updated.createdAt.getTime()).toBe(72 * 60 * 60 * 1000);

    // ADR-059 + ADR-061 Q10/Q7: chọn (lại) phương thức luôn lên lịch email, nhưng mốc trên đơn bảo đảm người bán chỉ nhận 1 email
    // "chờ xác nhận" và khách chỉ nhận 1 email hướng dẫn cho cùng một phương thức.
    await initiateOrderCheckout(tenant.id, order.id, buyer.id, "MANUAL_QR", { scheduleNotification });
    expect(scheduled).toHaveLength(4);
    sendEmailNowSpy.mockClear();
    for (const task of scheduled) await task();
    const sentOf = (type: string) => sendEmailNowSpy.mock.calls.map(([message]) => message).filter((message) => message.type === type);
    const notices = sentOf("order_pending_manual");
    expect(notices).toHaveLength(1);
    expect(notices[0]).toMatchObject({ to: owner.email, subject: expect.stringContaining(order.code) });
    expect(notices[0].text).toContain("100.000đ");
    expect(notices[0].text).toContain(`/studio/${tenant.slug}/orders/${order.id}`);
    expect(notices[0].text).toContain("đối chiếu sao kê");
    const instructions = sentOf("order_payment_customer");
    expect(instructions).toHaveLength(1);
    expect(instructions[0]).toMatchObject({ to: buyer.email, subject: expect.stringContaining(order.code) });
    expect(instructions[0].text).toContain("0011012345678");
    expect(instructions[0].text).toContain(`/${tenant.slug}/checkout/${order.code}`);

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

    // ADR-062 §6 — view model trang thanh toán (khách đã đăng nhập).
    const view = await getCheckoutView(toCurrentUser(buyer.id), order.code);
    expect(view?.order).toMatchObject({ code: order.code, displayStatus: "AWAITING_PAYMENT", provider: "MANUAL_QR", confirmMode: "MANUAL" });
    expect(view?.order.can).toEqual({ changeProvider: true, applyCoupon: true, declarePaid: true, undoDeclarePaid: false, cancel: true });
    expect(view?.enabledProviders).toEqual([{ id: "MANUAL_QR", confirmMode: "MANUAL", label: "Chuyển khoản ngân hàng", available: true }]);
    expect(view?.item).toMatchObject({ productId: product.id, productPath: `/${tenant.slug}/de-thi`, stillPurchasable: true });
    expect(await getCheckoutView(toCurrentUser(owner.id), order.code)).toBeNull();

    // ADR-062 Q1: "Tôi đã chuyển khoản" — ghi mốc (không đổi status), khoá đổi phương thức/mã/huỷ, người bán nhận 1 email
    // (báo lại sau khi hoàn tác không gửi thêm). Khách khác không thao tác được trên đơn này.
    const declaredTasks: Array<() => Promise<void>> = [];
    const scheduleDeclared = (task: () => Promise<void>) => void declaredTasks.push(task);
    await expect(declareOrderPaid(owner.id, order.id)).rejects.toMatchObject({ httpStatus: 404 });
    const { declaredAt } = await declareOrderPaid(buyer.id, order.id, { scheduleNotification: scheduleDeclared });
    expect((await getOrderForCustomer(buyer.id, order.code)).status).toBe("PENDING");
    await expect(initiateOrderCheckout(tenant.id, order.id, buyer.id, "MANUAL_QR")).rejects.toMatchObject({ code: "ORDER_DECLARED_PAID" });
    await expect(applyCouponToOrder(tenant.id, order.id, buyer.id, "QR10")).rejects.toMatchObject({ code: "ORDER_DECLARED_PAID" });
    await expect(cancelOrderByCustomer(buyer.id, order.id)).rejects.toMatchObject({ code: "ORDER_DECLARED_PAID" });
    expect((await getCheckoutView(toCurrentUser(buyer.id), order.code))?.order.displayStatus).toBe("AWAITING_SELLER_CONFIRM");
    const detail = await getOrderDetailView(tenant.id, order.id);
    expect(detail.customerDeclaredPaidAt?.getTime()).toBe(declaredAt.getTime());
    await undoDeclareOrderPaid(buyer.id, order.id);
    await declareOrderPaid(buyer.id, order.id, { scheduleNotification: scheduleDeclared });
    sendEmailNowSpy.mockClear();
    for (const task of declaredTasks) await task();
    expect(sentOf("order_customer_declared_paid")).toHaveLength(1);
    expect(sentOf("order_customer_declared_paid")[0]).toMatchObject({ to: owner.email, subject: expect.stringContaining(order.code) });
    const declaredAudits = await prisma.auditLog.count({ where: { targetId: order.id, action: { in: ["ORDER_CUSTOMER_DECLARED_PAID", "ORDER_CUSTOMER_DECLARED_PAID_UNDONE"] } } });
    expect(declaredAudits).toBe(3);

    // ADR-061 Q7: nhắc 1 lần khi còn ≤ 24 giờ — `now` đặt ở năm 2099 để bước cron chỉ chạm đơn của test (không đụng đơn thật).
    const farNow = new Date("2099-01-01T00:00:00.000Z");
    await withTenant(tenant.id, (tx) => tx.order.update({ where: { id: order.id }, data: { expiresAt: new Date("2099-01-01T12:00:00.000Z") } }));
    sendEmailNowSpy.mockClear();
    expect(await runOrderPaymentReminders(farNow)).toBe(1);
    expect(await runOrderPaymentReminders(farNow)).toBe(0);
    expect(sentOf("order_payment_reminder")).toHaveLength(1);
    expect(sentOf("order_payment_reminder")[0]).toMatchObject({ to: buyer.email, subject: expect.stringContaining(order.code) });

    // ADR-061 Q1 / Bổ sung ADR-062 — khách vãng lai: tạo user PENDING chưa mật khẩu + đồng ý + token GUEST_ACTIVATION 7 ngày (chỉ
    // hash) + phiên guest ≤ 24 giờ + đơn; email đã có → không gắn đơn; phiên guest refresh được, xem đơn của mình (RLS), không xem
    // đơn người khác; kích hoạt bằng token một lần.
    const guestEmail = nextEmail();
    const guestIp = `198.51.100.${Math.floor(Math.random() * 250) + 1}-${RUN_PREFIX}`;
    const guestTasks: Array<() => Promise<void>> = [];
    const guestInput = {
      tenantSlug: tenant.slug,
      productSlug: "de-thi",
      fullName: "Khách Vãng Lai",
      email: guestEmail,
      acceptTerms: "on",
      provider: "MANUAL_QR",
      ip: guestIp,
      userAgent: "vitest",
      scheduleNotification: (task: () => Promise<void>) => void guestTasks.push(task),
    };
    expect(await startGuestCheckout({ ...guestInput, acceptTerms: undefined })).toMatchObject({ ok: false, fieldErrors: { acceptTerms: expect.any(String) } });
    const guest = await startGuestCheckout(guestInput);
    if (!guest.ok) throw new Error(`guest checkout failed: ${guest.error}`);
    const guestUser = await prisma.user.findUniqueOrThrow({ where: { id: guest.userId } });
    expect(guestUser).toMatchObject({ status: "PENDING", hasPassword: false, emailVerifiedAt: null });
    const guestSessionRow = await prisma.refreshToken.findFirstOrThrow({ where: { userId: guest.userId } });
    expect(guestSessionRow.guestCheckout).toBe(true);
    expect(guestSessionRow.rememberMe).toBe(false);
    expect(guestSessionRow.expiresAt.getTime() - guestSessionRow.sessionStartedAt!.getTime()).toBeLessThanOrEqual(24 * 60 * 60 * 1000);
    const activationRow = await prisma.verificationToken.findFirstOrThrow({ where: { userId: guest.userId, type: "GUEST_ACTIVATION" } });
    expect(activationRow.expiresAt.getTime() - activationRow.createdAt.getTime()).toBeGreaterThan(6.9 * 24 * 60 * 60 * 1000);
    const guestOrder = await getOrderForCustomer(guest.userId, guest.orderCode);
    expect(guestOrder).toMatchObject({ customerId: guest.userId, provider: "MANUAL_QR", status: "PENDING" });
    const guestViewer = { userId: guest.userId, familyId: guestSessionRow.familyId, role: "USER" as const, emailVerified: false, profileCompleted: false, guestCheckout: true };
    expect((await getCheckoutView(guestViewer, guest.orderCode))?.viewer).toMatchObject({ guestSession: true, email: guestEmail });
    expect(await getCheckoutView(guestViewer, order.code)).toBeNull();
    expect(await startGuestCheckout({ ...guestInput, ip: `${guestIp}-2` })).toMatchObject({ ok: false, code: "EMAIL_EXISTS_GUEST" });
    expect(await startGuestCheckout({ ...guestInput, ip: `${guestIp}-3`, email: buyer.email })).toMatchObject({ ok: false, code: "EMAIL_EXISTS" });

    const refreshed = await refreshRoute(
      new NextRequest("http://localhost/api/auth/refresh", { method: "POST", headers: { cookie: `${REFRESH_COOKIE_NAME}=${guest.cookies.refreshToken}` } }),
    );
    expect(refreshed.status).toBe(200);
    const rotated = await prisma.refreshToken.findFirstOrThrow({ where: { userId: guest.userId, replacedById: null, revokedAt: null } });
    expect(rotated.guestCheckout).toBe(true);
    expect(rotated.expiresAt.getTime()).toBe(guestSessionRow.expiresAt.getTime());

    sendEmailNowSpy.mockClear();
    for (const task of guestTasks) await task();
    const activationMail = sentOf("guest_activation");
    expect(activationMail).toHaveLength(1);
    expect(activationMail[0]).toMatchObject({ to: guestEmail });
    const rawToken = new URL(String(activationMail[0].text.match(/https?:\/\/\S+dat-mat-khau\S+/)?.[0])).searchParams.get("token")!;
    expect(rawToken).not.toBe(activationRow.tokenHash);
    expect(await activateGuestAccount(rawToken, "Str0ngPass1", "khac")).toMatchObject({ ok: false, code: "PASSWORD_MISMATCH" });
    expect(await activateGuestAccount(rawToken, "Str0ngPass1", "Str0ngPass1")).toMatchObject({ ok: true, email: guestEmail });
    expect(await prisma.user.findUniqueOrThrow({ where: { id: guest.userId } })).toMatchObject({ status: "ACTIVE", hasPassword: true });
    expect(await activateGuestAccount(rawToken, "Str0ngPass1", "Str0ngPass1")).toMatchObject({ ok: false, code: "TOKEN_ALREADY_USED" });
    await prisma.rateLimitCounter.deleteMany({
      where: {
        key: {
          in: [
            rateLimitKey("guest_signup_email", guestEmail),
            rateLimitKey("guest_signup_email", buyer.email),
            ...[guestIp, `${guestIp}-2`, `${guestIp}-3`].map((ip) => rateLimitKey("guest_signup_ip", ip)),
          ],
        },
      },
    });
  }, 90_000); // DB dùng chung qua mạng (Neon) — case nhiều truy vấn tuần tự vượt 20s mặc định.

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

  it("ADR-065: a SePay checkout uses a numeric paymentRef as transfer content and the webhook job fulfills the order by it", async () => {
    const { tenant } = await createOwnerAndTenant("Sepay Ref Test", "sepayref");
    const product = await createPublishedProduct(tenant.id, "de-thi", 99_000);
    const buyer = await createActiveUser(nextEmail());
    const apiKey = "tenant-sepay-apikey";
    await saveTenantProviderConfig(tenant.id, {
      provider: "SEPAY",
      isEnabled: true,
      publicConfig: { bankBin: "970415", accountNo: "106887878525", accountName: "NGUYEN VAN A", authType: "API_KEY", paymentPrefix: "SEVQR" },
      secrets: { secret: apiKey },
    });

    // Nội dung CK = mã thanh toán riêng (tiền tố SePay + 8 chữ số), không phải mã đơn; áp mã giảm giá giữ nguyên mã thanh toán.
    const order = await createOrder(buyer.id, tenant.slug, product.id);
    const checkedOut = await initiateOrderCheckout(tenant.id, order.id, buyer.id, "SEPAY");
    const qr = checkedOut.checkoutPayload as unknown as CheckoutQrResult;
    expect(checkedOut.code).toBe(order.code);
    expect(checkedOut.paymentRef).toMatch(/^SEVQR[1-9]\d{7}$/);
    expect(qr.content).toBe(checkedOut.paymentRef);
    await createCoupon(tenant.id, { code: "REF10", type: "PERCENT", value: 10, isEnabled: true });
    const discounted = await applyCouponToOrder(tenant.id, order.id, buyer.id, "REF10");
    expect(discounted.paymentRef).toBe(checkedOut.paymentRef);

    const sendWebhook = (id: string, accountNumber: string) =>
      tenantWebhook(
        new Request(`http://localhost/api/webhooks/tenants/${tenant.id}/sepay`, {
          method: "POST",
          headers: { authorization: `Apikey ${apiKey}` },
          body: JSON.stringify({
            id,
            accountNumber,
            code: null,
            content: `CT DEN:945T26B14AZ5VN4P MBVCB.13345.${checkedOut.paymentRef}.NGUYEN VAN A`,
            transferType: "in",
            transferAmount: discounted.totalVnd,
            transactionDate: "2026-11-24 14:07:22",
          }),
        }),
        { params: Promise.resolve({ tenantId: tenant.id, provider: "sepay" }) },
      );

    // Giao dịch của tài khoản ngân hàng khác (cùng tài khoản SePay) → 200 nhưng bỏ qua, không ghi webhook_events.
    expect((await sendWebhook(`evt_${RUN_PREFIX}_ref_other`, "0011012345678")).status).toBe(200);
    expect(await prisma.webhookEvent.count({ where: { tenantId: tenant.id, providerEventId: `evt_${RUN_PREFIX}_ref_other` } })).toBe(0);

    expect((await sendWebhook(`evt_${RUN_PREFIX}_ref`, "106887878525")).status).toBe(200);
    const queue = await getStartedQueue();
    const [job] = await queue.boss.findJobs<PaymentProcessJobData>(QUEUE_NAMES.PAYMENT_PROCESS, { data: { tenantId: tenant.id } });
    expect(job?.data.referenceCandidates?.[0]).toBe(checkedOut.paymentRef);
    await queue.boss.deleteJob(QUEUE_NAMES.PAYMENT_PROCESS, [job!.id]);
    await processPaymentEvent(job!.data);

    const fulfilled = await getOrderDetailView(tenant.id, order.id);
    expect(fulfilled.status).toBe("FULFILLED");
    expect(fulfilled.paymentRef).toBe(checkedOut.paymentRef);
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
    // ADR-061: không còn cửa sổ trễ 24 giờ → hết hạn là không xác nhận tay được, không huỷ được.
    expect(expired.allowedActions).toEqual(["view"]);
    await expect(confirmOrderManually(tenant.id, order.id, "muộn")).rejects.toMatchObject({ code: "ORDER_NOT_CONFIRMABLE" });
    await expect(cancelOrderByCustomer(buyer.id, order.id)).rejects.toMatchObject({ code: "ORDER_NOT_PENDING" });

    const coupon = await withTenant(tenant.id, (tx) => tx.coupon.findFirstOrThrow({ where: { tenantId: tenant.id, code: "SWEEP10" } }));
    expect(coupon.usedCount).toBe(0);

    // ADR-062 bổ sung mục 3: cổng xác nhận tay + khách đã báo chuyển TRƯỚC hạn → người bán vẫn xác nhận được sau hạn (audit ghi rõ).
    const expiredAt = (await withTenant(tenant.id, (tx) => tx.order.findUniqueOrThrow({ where: { id: order.id } }))).expiresAt;
    await withTenant(tenant.id, (tx) =>
      tx.order.update({ where: { id: order.id }, data: { provider: "MANUAL_QR", customerDeclaredPaidAt: new Date(expiredAt.getTime() - 5_000) } }),
    );
    expect((await getOrderDetailView(tenant.id, order.id)).allowedActions).toEqual(["view", "confirm"]);
    await confirmOrderManually(tenant.id, order.id, "Khách báo đã chuyển trước hạn, đã thấy tiền");
    expect((await getOrderDetailView(tenant.id, order.id)).status).toBe("FULFILLED");
    const lateAudit = await prisma.auditLog.findFirstOrThrow({ where: { targetId: order.id, action: "ORDER_MANUALLY_CONFIRMED" } });
    expect(lateAudit.metadata).toMatchObject({ previousStatus: "EXPIRED", lateDeclaredPaid: true, customerDeclaredPaid: true });

    // ADR-062 Q4 + ADR-061 Q6: khách tự huỷ đơn chờ (khách khác không huỷ được — đọc dưới withCustomer); mã giảm giá "mỗi
    // khách" tính cả đơn chờ còn hiệu lực.
    const couponBuyer = await createActiveUser(nextEmail());
    await createCoupon(tenant.id, { code: "ONCE", type: "PERCENT", value: 10, isEnabled: true, perCustomerLimit: 1 });
    const first = await createOrder(couponBuyer.id, tenant.slug, product.id);
    await applyCouponToOrder(tenant.id, first.id, couponBuyer.id, "ONCE");
    const second = await createOrder(couponBuyer.id, tenant.slug, product.id);
    await expect(applyCouponToOrder(tenant.id, second.id, couponBuyer.id, "ONCE")).rejects.toMatchObject({ code: "COUPON_LIMIT_REACHED" });
    const stranger = await createActiveUser(nextEmail());
    await expect(cancelOrderByCustomer(stranger.id, first.id)).rejects.toMatchObject({ httpStatus: 404 });
    await cancelOrderByCustomer(couponBuyer.id, first.id);
    expect((await getOrderDetailView(tenant.id, first.id)).status).toBe("CANCELED");
    await expect(applyCouponToOrder(tenant.id, second.id, couponBuyer.id, "ONCE")).resolves.toMatchObject({ couponCode: "ONCE" });
  }, 90_000); // DB dùng chung qua mạng (Neon) — case nhiều truy vấn tuần tự vượt 20s mặc định.

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
  }, 90_000); // DB dùng chung qua mạng (Neon) — case nhiều truy vấn tuần tự vượt 20s mặc định.

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
