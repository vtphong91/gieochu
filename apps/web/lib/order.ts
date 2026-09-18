import {
  AppError,
  applyOrderToCustomerStats,
  calculateOrderPricing,
  canManuallyConfirmOrder,
  canPurchaseProduct,
  computeOrderExpiresAt,
  generateOrderCode,
  internalError,
  logger,
  notFound,
  transitionOrderStatus,
  type OrderStatus,
  type TenantCustomerStats,
} from "@gieochu/core";
import { getPrismaClient, withCustomer, withSystemJob, withTenant, type Prisma, type Tx } from "@gieochu/db";
import {
  buildWebhookNotifyUrl,
  decryptSecret,
  getProvider,
  type PaymentProviderId,
} from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { renderNewSaleEmail, renderOrderPaidEmail } from "@gieochu/email";
import { assertTenantCanWrite } from "./tenant-write-guard";
import { toCouponSnapshot } from "./coupon";
import { enqueueEmail } from "./jobs";

const ORDER_CODE_RETRIES = 10;

async function resolveUniqueOrderCode(prefix: string): Promise<string> {
  const prisma = getPrismaClient();
  for (let attempt = 0; attempt < ORDER_CODE_RETRIES; attempt += 1) {
    const code = generateOrderCode(prefix);
    const existing = await prisma.order.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw internalError("Không tạo được mã đơn hàng, vui lòng thử lại.");
}

function formatVnd(amountVnd: number): string {
  return `${amountVnd.toLocaleString("vi-VN")}đ`;
}

/**
 * §"M8" — the single idempotent function every payment source funnels
 * through (SePay webhook, MoMo IPN, manual confirm, đơn 0 đồng). Runs inside
 * the caller's RLS transaction (`withTenant`/`withSystemJob`) — never opens
 * its own, so it composes with whichever scope the caller already set up.
 * Already-PAID/FULFILLED is a no-op (idempotent).
 */
export type MarkOrderPaidSource = "SEPAY_WEBHOOK" | "MOMO_IPN" | "MANUAL_CONFIRM" | "ZERO_AMOUNT";

export async function markOrderPaid(tx: Tx, orderId: string, source: MarkOrderPaidSource): Promise<{ fulfilled: boolean }> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === "PAID" || order.status === "FULFILLED") {
    return { fulfilled: false };
  }

  const now = new Date();
  const paidStatus = transitionOrderStatus(order.status as OrderStatus, "MARK_PAID");
  await tx.order.update({ where: { id: orderId }, data: { status: paidStatus, paidAt: now } });

  if (order.couponCode) {
    const coupon = await tx.coupon.findUnique({ where: { tenantId_code: { tenantId: order.tenantId, code: order.couponCode } } });
    if (coupon) {
      // Atomic conditional increment (§"M8"): "UPDATE ... WHERE usedCount < usageLimit" so
      // concurrent orders can never push usedCount past usageLimit, even without locking.
      const updatedRows = await tx.$executeRaw`
        UPDATE "coupons" SET "usedCount" = "usedCount" + 1
        WHERE "id" = ${coupon.id} AND ("usageLimit" IS NULL OR "usedCount" < "usageLimit")
      `;
      if (updatedRows > 0) {
        await tx.couponRedemption.create({
          data: { couponId: coupon.id, tenantId: order.tenantId, userId: order.customerId, orderId: order.id },
        });
      } else {
        logger.warn({ orderId, couponCode: order.couponCode, source }, "coupon usage limit reached at payment time — order still marked PAID");
      }
    }
  }

  const existingCustomer = await tx.tenantCustomer.findUnique({
    where: { tenantId_userId: { tenantId: order.tenantId, userId: order.customerId } },
  });
  const currentStats: TenantCustomerStats | null = existingCustomer
    ? {
        ordersCount: existingCustomer.ordersCount,
        totalSpentVnd: existingCustomer.totalSpentVnd,
        // Non-null once a row exists — applyOrderToCustomerStats always sets both together.
        firstOrderAt: existingCustomer.firstOrderAt!,
        lastOrderAt: existingCustomer.lastOrderAt!,
      }
    : null;
  const nextStats = applyOrderToCustomerStats(currentStats, { totalVnd: order.totalVnd, paidAt: now });
  await tx.tenantCustomer.upsert({
    where: { tenantId_userId: { tenantId: order.tenantId, userId: order.customerId } },
    create: { tenantId: order.tenantId, userId: order.customerId, ...nextStats },
    update: nextStats,
  });

  const items = await tx.orderItem.findMany({ where: { orderId } });
  for (const item of items) {
    const product = await tx.product.findUniqueOrThrow({ where: { id: item.productId } });
    await tx.entitlement.upsert({
      where: { orderItemId: item.id },
      create: {
        userId: order.customerId,
        tenantId: order.tenantId,
        productId: item.productId,
        orderItemId: item.id,
        downloadsUsed: 0,
        downloadLimit: product.downloadLimit,
      },
      update: {},
    });
  }

  const fulfilledStatus = transitionOrderStatus(paidStatus, "FULFILL");
  await tx.order.update({ where: { id: orderId }, data: { status: fulfilledStatus } });

  return { fulfilled: true };
}

/** Enqueues the buyer + owner emails — called by the caller *after* the markOrderPaid transaction commits, never from inside it (matches subscription-sweep.ts's notify-after-write pattern). */
async function sendOrderPaidEmails(orderId: string): Promise<void> {
  const prisma = getPrismaClient();
  const env = getEnv();
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { customer: true, tenant: { include: { owner: true } }, items: true },
  });
  if (!order) return;

  const downloadsUrl = `${env.APP_URL}/account/library`;
  const buyerEmail = renderOrderPaidEmail({
    appName: env.APP_NAME,
    orderCode: order.code,
    totalVndDisplay: formatVnd(order.totalVnd),
    downloadsUrl,
  });
  await enqueueEmail({ to: order.customer.email, subject: buyerEmail.subject, html: buyerEmail.html, text: buyerEmail.text });

  const orderUrl = `${env.APP_URL}/studio/${order.tenant.slug}/orders/${order.id}`;
  const productTitle = order.items[0]?.titleSnapshot ?? "";
  const ownerEmail = renderNewSaleEmail({
    appName: env.APP_NAME,
    orderCode: order.code,
    productTitle,
    totalVndDisplay: formatVnd(order.totalVnd),
    orderUrl,
  });
  await enqueueEmail({ to: order.tenant.owner.email, subject: ownerEmail.subject, html: ownerEmail.html, text: ownerEmail.text });
}

/**
 * §"M8": "mỗi đơn 1 sản phẩm" (MVP). Blocks buying your own product or a
 * product you already hold an active entitlement for (§`canPurchaseProduct`).
 * A 0đ order (100% coupon isn't applied here — that's `applyCouponToOrder`;
 * this only happens when `priceVnd`/`salePriceVnd` is itself 0) is marked
 * PAID immediately.
 */
export async function createOrder(customerId: string, tenantSlug: string, productId: string) {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({ where: { slug: tenantSlug } });
  if (!tenant) throw notFound("Không tìm thấy trang.");
  assertTenantCanWrite(tenant);

  const product = await withTenant(tenant.id, (tx) =>
    tx.product.findFirst({ where: { id: productId, tenantId: tenant.id, status: "PUBLISHED" } }),
  );
  if (!product) throw new AppError({ code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy sản phẩm.", httpStatus: 404 });

  const isOwner = tenant.ownerId === customerId;
  const existingEntitlement = await withCustomer(customerId, (tx) =>
    tx.entitlement.findFirst({ where: { userId: customerId, productId, revokedAt: null } }),
  );
  const guard = canPurchaseProduct({ isOwner, hasActiveEntitlement: Boolean(existingEntitlement) });
  if (!guard.allowed) {
    const isOwnProduct = guard.reason === "OWN_PRODUCT";
    throw new AppError({
      code: isOwnProduct ? "CANNOT_BUY_OWN_PRODUCT" : "ALREADY_OWNED",
      message: isOwnProduct ? "Bạn không thể mua sản phẩm của chính mình." : "Bạn đã sở hữu tài liệu này.",
      httpStatus: 409,
    });
  }

  const now = new Date();
  const pricing = calculateOrderPricing(
    [
      {
        productId: product.id,
        title: product.title,
        priceVnd: product.priceVnd,
        salePriceVnd: product.salePriceVnd,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
      },
    ],
    null,
    0,
    now,
  );

  const env = getEnv();
  const code = await resolveUniqueOrderCode(tenant.orderCodePrefix);
  const expiresAt = computeOrderExpiresAt(now, env.ORDER_PENDING_TTL_MINUTES);

  const order = await withTenant(tenant.id, (tx) =>
    tx.order.create({
      data: {
        tenantId: tenant.id,
        customerId,
        code,
        status: "PENDING",
        subtotalVnd: pricing.subtotalVnd,
        discountVnd: pricing.discountVnd,
        totalVnd: pricing.totalVnd,
        expiresAt,
        items: {
          create: pricing.lines.map((line) => ({
            productId: line.productId,
            titleSnapshot: line.titleSnapshot,
            unitPriceVnd: line.unitPriceVnd,
            finalPriceVnd: line.finalPriceVnd,
          })),
        },
      },
    }),
  );

  if (order.totalVnd === 0) {
    await withTenant(tenant.id, (tx) => markOrderPaid(tx, order.id, "ZERO_AMOUNT"));
    await sendOrderPaidEmails(order.id);
  }

  return order;
}

function couponErrorMessage(code: string): string {
  switch (code) {
    case "EXPIRED":
      return "Mã giảm giá đã hết hạn.";
    case "LIMIT_REACHED":
      return "Mã giảm giá đã hết lượt sử dụng.";
    case "NOT_APPLICABLE":
      return "Mã giảm giá không áp dụng cho sản phẩm này.";
    default:
      return "Mã giảm giá không hợp lệ.";
  }
}

/** Re-runs `calculateOrderPricing()` server-side (§7.5) — never trusts a client-supplied total. */
export async function applyCouponToOrder(tenantId: string, orderId: string, customerId: string, couponCode: string) {
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order || order.customerId !== customerId) throw notFound("Không tìm thấy đơn hàng.");
  if (order.status !== "PENDING") {
    throw new AppError({ code: "ORDER_NOT_PENDING", message: "Đơn hàng không còn ở trạng thái chờ thanh toán.", httpStatus: 409 });
  }

  const items = await withTenant(tenantId, (tx) => tx.orderItem.findMany({ where: { orderId } }));
  const products = await withTenant(tenantId, (tx) =>
    tx.product.findMany({ where: { id: { in: items.map((item) => item.productId) } } }),
  );

  const code = couponCode.trim().toUpperCase();
  const couponRow = await withTenant(tenantId, (tx) => tx.coupon.findFirst({ where: { tenantId, code, isEnabled: true } }));
  if (!couponRow) throw new AppError({ code: "COUPON_NOT_FOUND", message: "Mã giảm giá không hợp lệ.", httpStatus: 400 });

  let customerUsageCount = 0;
  if (couponRow.perCustomerLimit != null) {
    customerUsageCount = await withTenant(tenantId, (tx) =>
      tx.couponRedemption.count({ where: { couponId: couponRow.id, userId: customerId } }),
    );
  }

  const now = new Date();
  const pricing = calculateOrderPricing(
    products.map((p) => ({
      productId: p.id,
      title: p.title,
      priceVnd: p.priceVnd,
      salePriceVnd: p.salePriceVnd,
      saleStartsAt: p.saleStartsAt,
      saleEndsAt: p.saleEndsAt,
    })),
    toCouponSnapshot(couponRow),
    customerUsageCount,
    now,
  );

  if (pricing.couponError) {
    throw new AppError({ code: `COUPON_${pricing.couponError}`, message: couponErrorMessage(pricing.couponError), httpStatus: 400 });
  }

  const updated = await withTenant(tenantId, async (tx) => {
    await Promise.all(
      pricing.lines.map((line) =>
        tx.orderItem.updateMany({ where: { orderId, productId: line.productId }, data: { finalPriceVnd: line.finalPriceVnd } }),
      ),
    );
    return tx.order.update({
      where: { id: orderId },
      data: { subtotalVnd: pricing.subtotalVnd, discountVnd: pricing.discountVnd, totalVnd: pricing.totalVnd, couponCode: code },
    });
  });

  if (updated.totalVnd === 0) {
    await withTenant(tenantId, (tx) => markOrderPaid(tx, orderId, "ZERO_AMOUNT"));
    await sendOrderPaidEmails(orderId);
  }

  return updated;
}

/** Removes a previously-applied coupon, resetting the order back to its subtotal. */
export async function removeCouponFromOrder(tenantId: string, orderId: string, customerId: string) {
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order || order.customerId !== customerId) throw notFound("Không tìm thấy đơn hàng.");
  if (order.status !== "PENDING") {
    throw new AppError({ code: "ORDER_NOT_PENDING", message: "Đơn hàng không còn ở trạng thái chờ thanh toán.", httpStatus: 409 });
  }

  return withTenant(tenantId, async (tx) => {
    const items = await tx.orderItem.findMany({ where: { orderId } });
    await Promise.all(items.map((item) => tx.orderItem.update({ where: { id: item.id }, data: { finalPriceVnd: item.unitPriceVnd } })));
    return tx.order.update({
      where: { id: orderId },
      data: { subtotalVnd: order.subtotalVnd, discountVnd: 0, totalVnd: order.subtotalVnd, couponCode: null },
    });
  });
}

/** Calls the tenant-scoped provider (§`PaymentScope: {kind:"TENANT", tenantId}` — never shares config/routes with platform billing) and stores the checkout payload for the checkout page to read back. */
export async function initiateOrderCheckout(tenantId: string, orderId: string, customerId: string, provider: PaymentProviderId) {
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order || order.customerId !== customerId) throw notFound("Không tìm thấy đơn hàng.");
  if (order.status !== "PENDING") {
    throw new AppError({ code: "ORDER_NOT_PENDING", message: "Đơn hàng không còn ở trạng thái chờ thanh toán.", httpStatus: 409 });
  }

  const [configRow, tenant] = await Promise.all([
    withTenant(tenantId, (tx) => tx.tenantPaymentConfig.findUnique({ where: { tenantId_provider: { tenantId, provider } } })),
    getPrismaClient().tenant.findUniqueOrThrow({ where: { id: tenantId } }),
  ]);
  if (!configRow?.isEnabled) {
    throw new AppError({ code: "PROVIDER_NOT_AVAILABLE", message: "Phương thức thanh toán này chưa sẵn sàng.", httpStatus: 400 });
  }

  const env = getEnv();
  const secrets = JSON.parse(decryptSecret(configRow.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>;
  const cfg = { ...(configRow.publicConfig as Record<string, unknown>), ...secrets };

  const checkout = await getProvider(provider).createCheckout({
    scope: { kind: "TENANT", tenantId },
    cfg: cfg as never,
    reference: order.code,
    amountVnd: order.totalVnd,
    description: `Thanh toan don hang ${order.code}`,
    returnUrl: `${env.APP_URL}/${tenant.slug}/checkout/${order.code}`,
    notifyUrl: buildWebhookNotifyUrl(env.APP_URL, { kind: "TENANT", tenantId }, provider),
  });

  return withTenant(tenantId, (tx) =>
    tx.order.update({ where: { id: orderId }, data: { provider, checkoutPayload: checkout as unknown as Prisma.InputJsonValue } }),
  );
}

export async function getOrderForCustomer(customerId: string, orderCode: string) {
  const order = await withCustomer(customerId, (tx) =>
    tx.order.findFirst({ where: { code: orderCode, customerId }, include: { items: true, tenant: { select: { name: true, slug: true } } } }),
  );
  if (!order) throw notFound("Không tìm thấy đơn hàng.");
  return order;
}

/** §"M8": "Xác nhận thanh toán thủ công (chỉ đơn PENDING hoặc EXPIRED trong vòng 24 giờ; bắt buộc nhập ghi chú)". */
export async function confirmOrderManually(tenantId: string, orderId: string, note: string): Promise<void> {
  if (!note.trim()) {
    throw new AppError({ code: "NOTE_REQUIRED", message: "Vui lòng nhập ghi chú xác nhận.", httpStatus: 400 });
  }
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order) throw notFound("Không tìm thấy đơn hàng.");

  if (!canManuallyConfirmOrder(order.status as OrderStatus, order.expiresAt, new Date())) {
    throw new AppError({ code: "ORDER_NOT_CONFIRMABLE", message: "Đơn hàng không ở trạng thái có thể xác nhận thủ công.", httpStatus: 409 });
  }

  await withTenant(tenantId, async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { confirmNote: note.trim() } });
    await markOrderPaid(tx, orderId, "MANUAL_CONFIRM");
  });
  await sendOrderPaidEmails(orderId);
}

/** Only valid from PENDING (§`transitionOrderStatus`) — throws AppError otherwise. */
export async function cancelOrder(tenantId: string, orderId: string): Promise<void> {
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order) throw notFound("Không tìm thấy đơn hàng.");
  const nextStatus = transitionOrderStatus(order.status as OrderStatus, "CANCEL");
  await withTenant(tenantId, (tx) => tx.order.update({ where: { id: orderId }, data: { status: nextStatus } }));
}

/** Only valid from FULFILLED — revokes every entitlement the order created so downloads stop working. */
export async function markOrderRefunded(tenantId: string, orderId: string): Promise<void> {
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order) throw notFound("Không tìm thấy đơn hàng.");
  const nextStatus = transitionOrderStatus(order.status as OrderStatus, "REFUND");

  await withTenant(tenantId, async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { id: true } });
    await tx.entitlement.updateMany({ where: { orderItemId: { in: items.map((i) => i.id) } }, data: { revokedAt: new Date() } });
  });
}

export interface OrderListFilters {
  status?: OrderStatus;
}

export async function listOrders(tenantId: string, filters: OrderListFilters = {}) {
  return withTenant(tenantId, (tx) =>
    tx.order.findMany({
      where: { tenantId, ...(filters.status ? { status: filters.status } : {}) },
      include: { customer: { select: { email: true } }, items: true },
      orderBy: { createdAt: "desc" },
    }),
  );
}

export async function getOrderDetail(tenantId: string, orderId: string) {
  const order = await withTenant(tenantId, (tx) =>
    tx.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { email: true } }, items: true, transactions: true },
    }),
  );
  if (!order || order.tenantId !== tenantId) throw notFound("Không tìm thấy đơn hàng.");
  return order;
}

export async function listTenantCustomers(tenantId: string) {
  return withTenant(tenantId, (tx) =>
    tx.tenantCustomer.findMany({
      where: { tenantId },
      include: { user: { select: { email: true } } },
      orderBy: { lastOrderAt: "desc" },
    }),
  );
}

/** Studio dashboard stat cards: revenue over the trailing 30 days + orders currently awaiting payment. */
export async function getOrderDashboardStats(tenantId: string): Promise<{ revenue30dVnd: number; pendingOrdersCount: number }> {
  return withTenant(tenantId, async (tx) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [paidOrders, pendingOrdersCount] = await Promise.all([
      tx.order.findMany({ where: { tenantId, status: { in: ["PAID", "FULFILLED"] }, paidAt: { gte: since } }, select: { totalVnd: true } }),
      tx.order.count({ where: { tenantId, status: "PENDING" } }),
    ]);
    return { revenue30dVnd: paidOrders.reduce((sum, o) => sum + o.totalVnd, 0), pendingOrdersCount };
  });
}

/** §"M8" hourly job: PENDING past `expiresAt` -> EXPIRED. Coupon usage is untouched — it's only ever consumed inside `markOrderPaid()`. */
export async function runOrderSweep(): Promise<void> {
  const now = new Date();
  await withSystemJob(async (tx) => {
    const expiring = await tx.order.findMany({ where: { status: "PENDING", expiresAt: { lt: now } } });
    for (const order of expiring) {
      const nextStatus = transitionOrderStatus(order.status as OrderStatus, "EXPIRE");
      await tx.order.update({ where: { id: order.id }, data: { status: nextStatus } });
    }
  });
}

export { sendOrderPaidEmails };
