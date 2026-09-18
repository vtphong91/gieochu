import { createHmac } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import type { CheckoutQrResult } from "@gieochu/payments";
import { createTenantForUser } from "../../lib/create-tenant";
import { saveTenantProviderConfig } from "../../lib/tenant-payment";
import { createCoupon } from "../../lib/coupon";
import {
  applyCouponToOrder,
  confirmOrderManually,
  createOrder,
  getOrderDetail,
  getOrderForCustomer,
  initiateOrderCheckout,
  listOrders,
  runOrderSweep,
} from "../../lib/order";
import { processPaymentEvent } from "../../lib/payment-process";
import { POST as tenantWebhook } from "../../app/api/webhooks/tenants/[tenantId]/[provider]/route";
import type { CurrentUser } from "../../lib/session";

const prisma = getPrismaClient();
const RUN_PREFIX = `m8test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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
    const { tenant } = await createOwnerAndTenant("Manual QR Test", "manualqr");
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

    const updated = await initiateOrderCheckout(tenant.id, order.id, buyer.id, "MANUAL_QR");
    const checkout = updated.checkoutPayload as unknown as CheckoutQrResult;
    expect(checkout.kind).toBe("QR");
    expect(checkout.content).toBe(order.code);
  });

  it("owner's manual confirm requires a note, then fulfills the order and grants an entitlement", async () => {
    const { tenant } = await createOwnerAndTenant("Manual Confirm Test", "manualconfirm");
    const product = await createPublishedProduct(tenant.id, "de-thi", 50_000);
    const buyer = await createActiveUser(nextEmail());
    const order = await createOrder(buyer.id, tenant.slug, product.id);

    await expect(confirmOrderManually(tenant.id, order.id, "")).rejects.toMatchObject({ code: "NOTE_REQUIRED" });

    await confirmOrderManually(tenant.id, order.id, "Đã đối chiếu sao kê ngân hàng lúc 10:30");

    const fulfilled = await getOrderDetail(tenant.id, order.id);
    expect(fulfilled.status).toBe("FULFILLED");
    expect(fulfilled.paidAt).not.toBeNull();
    expect(fulfilled.confirmNote).toContain("đối chiếu");

    const entitlement = await withTenant(tenant.id, (tx) =>
      tx.entitlement.findUnique({ where: { orderItemId: fulfilled.items[0]!.id } }),
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

    const fulfilled = await getOrderDetail(tenant.id, order.id);
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

    const fulfilled = await getOrderDetail(tenant.id, order.id);
    expect(fulfilled.status).toBe("FULFILLED");
  });

  it("a wrong amount leaves the order PENDING and records a MISMATCH_AMOUNT transaction", async () => {
    const { tenant } = await createOwnerAndTenant("Mismatch Test", "mismatch");
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

    const stillPending = await getOrderDetail(tenant.id, order.id);
    expect(stillPending.status).toBe("PENDING");
    expect(stillPending.transactions.some((t) => t.matchStatus === "MISMATCH_AMOUNT")).toBe(true);
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

    const expired = await getOrderDetail(tenant.id, order.id);
    expect(expired.status).toBe("EXPIRED");

    const coupon = await withTenant(tenant.id, (tx) => tx.coupon.findFirstOrThrow({ where: { tenantId: tenant.id, code: "SWEEP10" } }));
    expect(coupon.usedCount).toBe(0);
  });

  it("tenant A cannot read tenant B's orders, and a customer cannot read another customer's order", async () => {
    const { tenant: tenantA } = await createOwnerAndTenant("Isolation A", "isoa");
    const { tenant: tenantB } = await createOwnerAndTenant("Isolation B", "isob");
    const productA = await createPublishedProduct(tenantA.id, "de-thi", 20_000);
    const buyer1 = await createActiveUser(nextEmail());
    const buyer2 = await createActiveUser(nextEmail());

    const order = await createOrder(buyer1.id, tenantA.slug, productA.id);

    await expect(getOrderDetail(tenantB.id, order.id)).rejects.toMatchObject({ httpStatus: 404 });
    const tenantBOrders = await listOrders(tenantB.id);
    expect(tenantBOrders.some((o) => o.id === order.id)).toBe(false);

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

    const [fulfilled1, fulfilled2] = await Promise.all([getOrderDetail(tenant.id, order1.id), getOrderDetail(tenant.id, order2.id)]);
    expect(fulfilled1.status).toBe("FULFILLED");
    expect(fulfilled2.status).toBe("FULFILLED");

    const coupon = await withTenant(tenant.id, (tx) => tx.coupon.findFirstOrThrow({ where: { tenantId: tenant.id, code: "RACE1" } }));
    expect(coupon.usedCount).toBe(1);

    const redemptions = await withTenant(tenant.id, (tx) => tx.couponRedemption.findMany({ where: { couponId: coupon.id } }));
    expect(redemptions.length).toBe(1);
  });
});
