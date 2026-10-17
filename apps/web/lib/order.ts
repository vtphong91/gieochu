import {
  AppError,
  applyOrderToCustomerStats,
  calculateOrderPricing,
  canManuallyConfirmOrder,
  canPurchaseProduct,
  computeOrderExpiresAt,
  effectiveOrderStatus,
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
import { sendEmailNow } from "./email-dispatch";
import { notifyPurchaseRemedyForOrder } from "./entitlement-remedy";
import { getEffectiveBrand } from "./branding";
import { getSystemSettings } from "./system-settings";
import { hideReviewsForRevokedItems, recomputeProductRatings } from "./review";
import { recomputeProductSoldCounts } from "./product-sold-count";
import { audit } from "./audit";

const ORDER_CODE_RETRIES = 10;

async function resolveUniqueOrderCode(prefix: string): Promise<string> {
  for (let attempt = 0; attempt < ORDER_CODE_RETRIES; attempt += 1) {
    const code = generateOrderCode(prefix);
    // `orders.code` unique TOÀN HỆ THỐNG → kiểm dưới system_job (client trần không scope bị RLS trả 0 dòng — kiểm trùng
    // trước đây luôn "không trùng"). Chỉ đọc id.
    const existing = await withSystemJob((tx) => tx.order.findUnique({ where: { code }, select: { id: true } }));
    if (!existing) return code;
  }
  throw internalError("Không tạo được mã đơn hàng, vui lòng thử lại.");
}

/** ADR-036 mục 3: an overdue PENDING order is EXPIRED for every decision, even before the daily sweep writes it. */
function isEffectivelyPending(order: { status: OrderStatus; expiresAt: Date }, now = new Date()): boolean {
  return effectiveOrderStatus(order.status, order.expiresAt, now) === "PENDING";
}

/** Read paths return the effective status (ADR-036) so pages never offer payment on an overdue order. */
function withEffectiveStatus<T extends { status: OrderStatus; expiresAt: Date }>(order: T, now = new Date()): T {
  return { ...order, status: effectiveOrderStatus(order.status, order.expiresAt, now) };
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
 * ADR-033: trả về `productIds` của đơn vừa FULFILLED (rỗng khi no-op) — caller gọi `recomputeProductSoldCounts`
 * SAU khi transaction commit (hàm này chạy trong transaction của caller nên không tự tính được).
 */
export type MarkOrderPaidSource = "SEPAY_WEBHOOK" | "MOMO_IPN" | "MANUAL_CONFIRM" | "ZERO_AMOUNT";

export interface MarkOrderPaidResult {
  fulfilled: boolean;
  /** Sản phẩm của đơn vừa chuyển FULFILLED (rỗng khi no-op) — cần tính lại `soldCount` sau commit. */
  productIds: string[];
  /**
   * Mã giảm giá hết lượt ngay lúc thanh toán (đơn vẫn PAID, §"M8"). Caller ghi audit `COUPON_OVERUSED` SAU commit
   * qua `auditMarkOrderPaid` (ADR-037: audit không ghi trong transaction nghiệp vụ).
   */
  couponOverused: { couponId: string; couponCode: string } | null;
}

/**
 * ADR-037: audit phát sinh từ `markOrderPaid` — gọi SAU khi transaction của caller commit. Hiện chỉ có
 * COUPON_OVERUSED (để owner biết, §"M8"). actor = null (hệ thống). Chỉ id + mã coupon, không thông tin khách.
 */
export async function auditMarkOrderPaid(
  tenantId: string,
  orderId: string,
  result: MarkOrderPaidResult,
  source: MarkOrderPaidSource,
): Promise<void> {
  if (!result.couponOverused) return;
  await audit.log({
    actorId: null,
    scope: "SYSTEM",
    tenantId,
    action: "COUPON_OVERUSED",
    targetType: "Order",
    targetId: orderId,
    metadata: { couponId: result.couponOverused.couponId, couponCode: result.couponOverused.couponCode, source },
  });
}

export async function markOrderPaid(tx: Tx, orderId: string, source: MarkOrderPaidSource): Promise<MarkOrderPaidResult> {
  const order = await tx.order.findUniqueOrThrow({ where: { id: orderId } });
  if (order.status === "PAID" || order.status === "FULFILLED") {
    return { fulfilled: false, productIds: [], couponOverused: null };
  }
  let couponOverused: MarkOrderPaidResult["couponOverused"] = null;

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
        couponOverused = { couponId: coupon.id, couponCode: coupon.code };
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
    // ADR-039 bổ sung: đơn trả tiền muộn cho tài liệu đã bị admin lưu trữ do vi phạm → entitlement sinh thẳng ở
    // PENDING_CHOICE (trigger entitlements_guard_remedy cho phép đúng trường hợp này dưới scope tenant). Email 2 lựa chọn
    // gửi sau commit trong sendOrderPaidEmails.
    const remedy = product.moderationLockedAt
      ? {
          remedyStatus: "PENDING_CHOICE" as const,
          remedyRequestedAt: now,
          remedyReportId:
            (
              await tx.abuseReport.findFirst({
                where: { targetType: "PRODUCT", targetId: product.id, status: "RESOLVED", decision: "ARCHIVE_PRODUCT" },
                orderBy: [{ resolvedAt: "desc" }, { id: "desc" }],
                select: { id: true },
              })
            )?.id ?? null,
        }
      : {};
    await tx.entitlement.upsert({
      where: { orderItemId: item.id },
      create: {
        userId: order.customerId,
        tenantId: order.tenantId,
        productId: item.productId,
        orderItemId: item.id,
        downloadsUsed: 0,
        downloadLimit: product.downloadLimit,
        ...remedy,
      },
      update: {},
    });
  }

  const fulfilledStatus = transitionOrderStatus(paidStatus, "FULFILL");
  await tx.order.update({ where: { id: orderId }, data: { status: fulfilledStatus } });

  return { fulfilled: true, productIds: [...new Set(items.map((item) => item.productId))], couponOverused };
}

/**
 * Sends the buyer + owner emails (SMTP đồng bộ, không hàng đợi) — called by the caller *after* the markOrderPaid
 * transaction commits, never from inside it (giữ transaction ngắn, không chờ SMTP bên trong).
 * ADR-039 bổ sung: nếu đơn sinh entitlement PENDING_CHOICE (tài liệu đang bị khoá kiểm duyệt) → thêm email 2 lựa chọn
 * cho khách (tự bắt lỗi, chạy cả khi phần email đơn hàng dừng sớm).
 */
async function sendOrderPaidEmails(orderId: string): Promise<void> {
  try {
    await sendOrderPaidEmailsInner(orderId);
  } finally {
    await notifyPurchaseRemedyForOrder(orderId);
  }
}

async function sendOrderPaidEmailsInner(orderId: string): Promise<void> {
  const env = getEnv();
  const brand = await getEffectiveBrand();
  // `orders` là L2 (RLS FORCE) — đọc dưới `withSystemJob` (client trần không scope thấy 0 dòng → email đơn hàng từng
  // không bao giờ gửi). Chỉ chọn trường cần cho email.
  const order = await withSystemJob((tx) =>
    tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        code: true,
        totalVnd: true,
        customer: { select: { email: true } },
        tenant: { select: { slug: true, owner: { select: { email: true } } } },
        items: { select: { titleSnapshot: true } },
      },
    }),
  );
  if (!order) return;

  const downloadsUrl = `${env.APP_URL}/account/library`;
  const buyerEmail = renderOrderPaidEmail({
    appName: brand.name,
    orderCode: order.code,
    totalVndDisplay: formatVnd(order.totalVnd),
    downloadsUrl,
  });
  const buyerSent = await sendEmailNow({ type: "order_paid", to: order.customer.email, subject: buyerEmail.subject, html: buyerEmail.html, text: buyerEmail.text });
  if (!buyerSent.ok) {
    logger.warn({ orderId, email: order.customer.email, error: buyerSent.error }, "order.paid: gửi email cho khách hàng thất bại");
  }

  const orderUrl = `${env.APP_URL}/studio/${order.tenant.slug}/orders/${order.id}`;
  const productTitle = order.items[0]?.titleSnapshot ?? "";
  const ownerEmail = renderNewSaleEmail({
    appName: brand.name,
    orderCode: order.code,
    productTitle,
    totalVndDisplay: formatVnd(order.totalVnd),
    orderUrl,
  });
  const ownerSent = await sendEmailNow({ type: "new_sale", to: order.tenant.owner.email, subject: ownerEmail.subject, html: ownerEmail.html, text: ownerEmail.text });
  if (!ownerSent.ok) {
    logger.warn({ orderId, email: order.tenant.owner.email, error: ownerSent.error }, "order.paid: gửi email báo owner thất bại");
  }
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

  const settings = await getSystemSettings();
  const code = await resolveUniqueOrderCode(tenant.orderCodePrefix);
  const expiresAt = computeOrderExpiresAt(now, settings.orderPendingTtlMinutes);

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
    const paid = await withTenant(tenant.id, (tx) => markOrderPaid(tx, order.id, "ZERO_AMOUNT"));
    await auditMarkOrderPaid(tenant.id, order.id, paid, "ZERO_AMOUNT");
    await recomputeProductSoldCounts(paid.productIds);
    // Chỉ khi lần gọi này thật sự chuyển đơn sang PAID/FULFILLED — không gửi lặp.
    if (paid.fulfilled) await sendOrderPaidEmails(order.id);
  }

  return order;
}

/**
 * ADR-039 bổ sung: đơn PENDING tạo trước khi tài liệu bị gỡ/lưu trữ (hoặc gian hàng bị khoá/tạm ngưng) không được đi
 * tiếp tới thanh toán / áp mã. Webhook và xác nhận tay cho giao dịch ĐÃ trả tiền không qua đây (fulfil → PENDING_CHOICE
 * nếu tài liệu bị khoá kiểm duyệt).
 */
async function assertOrderProductsPurchasable(tenantId: string, orderId: string): Promise<void> {
  const unavailable = () =>
    new AppError({
      code: "PRODUCT_UNAVAILABLE",
      message: "Tài liệu trong đơn hàng hiện không còn được bán nên không thể tiếp tục thanh toán.",
      httpStatus: 409,
    });
  // tenants là L1 (không RLS).
  const tenant = await getPrismaClient().tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
  if (!tenant || tenant.status !== "ACTIVE") throw unavailable();
  const blocked = await withTenant(tenantId, (tx) =>
    tx.orderItem.count({ where: { orderId, product: { status: { not: "PUBLISHED" } } } }),
  );
  if (blocked > 0) throw unavailable();
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
  if (!isEffectivelyPending(order)) {
    throw new AppError({ code: "ORDER_NOT_PENDING", message: "Đơn hàng không còn ở trạng thái chờ thanh toán.", httpStatus: 409 });
  }
  await assertOrderProductsPurchasable(tenantId, orderId);

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
    const paid = await withTenant(tenantId, (tx) => markOrderPaid(tx, orderId, "ZERO_AMOUNT"));
    await auditMarkOrderPaid(tenantId, orderId, paid, "ZERO_AMOUNT");
    await recomputeProductSoldCounts(paid.productIds);
    if (paid.fulfilled) await sendOrderPaidEmails(orderId);
  }

  return updated;
}

/** Removes a previously-applied coupon, resetting the order back to its subtotal. */
export async function removeCouponFromOrder(tenantId: string, orderId: string, customerId: string) {
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order || order.customerId !== customerId) throw notFound("Không tìm thấy đơn hàng.");
  if (!isEffectivelyPending(order)) {
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
  if (!isEffectivelyPending(order)) {
    throw new AppError({ code: "ORDER_NOT_PENDING", message: "Đơn hàng không còn ở trạng thái chờ thanh toán.", httpStatus: 409 });
  }
  await assertOrderProductsPurchasable(tenantId, orderId);

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
  return withEffectiveStatus(order);
}

/** §"M8": "Xác nhận thanh toán thủ công (chỉ đơn PENDING hoặc EXPIRED trong vòng 24 giờ; bắt buộc nhập ghi chú)". */
export async function confirmOrderManually(tenantId: string, orderId: string, note: string, actorId: string | null = null): Promise<void> {
  if (!note.trim()) {
    throw new AppError({ code: "NOTE_REQUIRED", message: "Vui lòng nhập ghi chú xác nhận.", httpStatus: 400 });
  }
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order) throw notFound("Không tìm thấy đơn hàng.");

  if (!canManuallyConfirmOrder(order.status as OrderStatus, order.expiresAt, new Date())) {
    throw new AppError({ code: "ORDER_NOT_CONFIRMABLE", message: "Đơn hàng không ở trạng thái có thể xác nhận thủ công.", httpStatus: 409 });
  }

  const paid = await withTenant(tenantId, async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { confirmNote: note.trim() } });
    return markOrderPaid(tx, orderId, "MANUAL_CONFIRM");
  });
  // ADR-037 / §7.9: chỉ id + trạng thái — KHÔNG ghi ghi chú xác nhận (văn bản tự do, có thể chứa thông tin khách).
  await audit.log({
    actorId,
    scope: "TENANT",
    tenantId,
    action: "ORDER_MANUALLY_CONFIRMED",
    targetType: "Order",
    targetId: orderId,
    metadata: { previousStatus: effectiveOrderStatus(order.status, order.expiresAt, new Date()), fulfilled: paid.fulfilled },
  });
  await auditMarkOrderPaid(tenantId, orderId, paid, "MANUAL_CONFIRM");
  await recomputeProductSoldCounts(paid.productIds);
  if (paid.fulfilled) await sendOrderPaidEmails(orderId);
}

/** Only valid from PENDING (§`transitionOrderStatus`) — throws AppError otherwise. */
export async function cancelOrder(tenantId: string, orderId: string): Promise<void> {
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order) throw notFound("Không tìm thấy đơn hàng.");
  // ADR-036: an overdue PENDING order is EXPIRED — CANCEL is not a valid transition from there (same as after the sweep).
  const nextStatus = transitionOrderStatus(effectiveOrderStatus(order.status, order.expiresAt, new Date()), "CANCEL");
  await withTenant(tenantId, (tx) => tx.order.update({ where: { id: orderId }, data: { status: nextStatus } }));
}

/**
 * Only valid from FULFILLED — revokes every entitlement the order created so downloads stop working.
 * ADR-029 mục 2: đánh giá gắn với các dòng đơn này tự ẩn (HIDDEN, lý do REFUNDED) trong cùng transaction, điểm
 * sản phẩm tính lại sau khi commit. ADR-033: `soldCount` của sản phẩm trong đơn cũng tính lại sau commit.
 */
export async function markOrderRefunded(tenantId: string, orderId: string, actorId: string | null = null): Promise<void> {
  const order = await withTenant(tenantId, (tx) => tx.order.findUnique({ where: { id: orderId } }));
  if (!order) throw notFound("Không tìm thấy đơn hàng.");
  const nextStatus = transitionOrderStatus(order.status as OrderStatus, "REFUND");

  const { reviewProductIds, orderProductIds, revokedItemCount } = await withTenant(tenantId, async (tx) => {
    await tx.order.update({ where: { id: orderId }, data: { status: nextStatus } });
    const items = await tx.orderItem.findMany({ where: { orderId }, select: { id: true, productId: true } });
    const itemIds = items.map((i) => i.id);
    await tx.entitlement.updateMany({ where: { orderItemId: { in: itemIds } }, data: { revokedAt: new Date() } });
    // ADR-039: yêu cầu hoàn tiền của khách (tài liệu bị gỡ do vi phạm) → đã hoàn. Sau lệnh thu hồi ở trên (trigger
    // entitlements_guard_remedy chỉ cho chuyển này khi entitlement đã thu hồi).
    await tx.entitlement.updateMany({
      where: { orderItemId: { in: itemIds }, remedyStatus: "REFUND_REQUESTED" },
      data: { remedyStatus: "REFUNDED", remedyResolvedAt: new Date() },
    });
    return {
      reviewProductIds: await hideReviewsForRevokedItems(tx, tenantId, itemIds),
      orderProductIds: items.map((i) => i.productId),
      revokedItemCount: itemIds.length,
    };
  });
  await audit.log({
    actorId,
    scope: "TENANT",
    tenantId,
    action: "ORDER_REFUNDED",
    targetType: "Order",
    targetId: orderId,
    metadata: { revokedEntitlements: revokedItemCount, hiddenReviewProducts: reviewProductIds.length },
  });
  await recomputeProductRatings(reviewProductIds);
  await recomputeProductSoldCounts(orderProductIds);
}

export interface OrderListFilters {
  status?: OrderStatus;
  /** ADR-039: chỉ đơn có yêu cầu hoàn tiền đang chờ (`?remedy=REFUND_REQUESTED`). Kết hợp được với `status`. */
  remedy?: "REFUND_REQUESTED";
}

/** Đọc `?remedy=` của trang đơn Studio — chỉ nhận đúng "REFUND_REQUESTED". */
export function parseOrderRemedyFilter(value: string | undefined): OrderListFilters["remedy"] {
  return value === "REFUND_REQUESTED" ? "REFUND_REQUESTED" : undefined;
}

/** ADR-036: filters and labels by effective status — PENDING excludes overdue orders, EXPIRED includes them. */
function effectiveStatusWhere(status: OrderStatus, now: Date): Prisma.OrderWhereInput {
  if (status === "PENDING") return { status: "PENDING", expiresAt: { gte: now } };
  if (status === "EXPIRED") return { OR: [{ status: "EXPIRED" }, { status: "PENDING", expiresAt: { lt: now } }] };
  return { status };
}

export async function listOrders(tenantId: string, filters: OrderListFilters = {}) {
  const now = new Date();
  const orders = await withTenant(tenantId, (tx) =>
    tx.order.findMany({
      where: {
        tenantId,
        ...(filters.status ? effectiveStatusWhere(filters.status, now) : {}),
        ...(filters.remedy ? { items: { some: { entitlement: { is: { remedyStatus: filters.remedy } } } } } : {}),
      },
      include: {
        customer: { select: { email: true } },
        // ADR-039: trạng thái quyền lợi người mua của từng dòng (null = dòng chưa có entitlement, vd đơn chưa thanh toán).
        items: { include: { entitlement: { select: { remedyStatus: true, remedyChosenAt: true } } } },
      },
      orderBy: { createdAt: "desc" },
    }),
  );
  return orders.map((order) => ({
    ...withEffectiveStatus(order, now),
    refundRequested: order.items.some((item) => item.entitlement?.remedyStatus === "REFUND_REQUESTED"),
  }));
}

export async function getOrderDetail(tenantId: string, orderId: string) {
  const order = await withTenant(tenantId, (tx) =>
    tx.order.findUnique({
      where: { id: orderId },
      include: { customer: { select: { email: true } }, items: { include: { entitlement: true } }, transactions: true },
    }),
  );
  if (!order || order.tenantId !== tenantId) throw notFound("Không tìm thấy đơn hàng.");
  return withEffectiveStatus(order);
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
      tx.order.count({ where: { tenantId, status: "PENDING", expiresAt: { gte: new Date() } } }),
    ]);
    return { revenue30dVnd: paidOrders.reduce((sum, o) => sum + o.totalVnd, 0), pendingOrdersCount };
  });
}

/**
 * §"M8" sweep: PENDING past `expiresAt` -> EXPIRED. Coupon usage is untouched — it's only ever consumed inside
 * `markOrderPaid()`. ADR-036: runs once a day from `/api/cron/daily` — it only syncs the stored status; every
 * read/payment path already treats an overdue PENDING order as EXPIRED (`effectiveOrderStatus`). Returns the
 * number of orders expired.
 */
export async function runOrderSweep(): Promise<number> {
  const now = new Date();
  return withSystemJob(async (tx) => {
    const expiring = await tx.order.findMany({ where: { status: "PENDING", expiresAt: { lt: now } } });
    for (const order of expiring) {
      const nextStatus = transitionOrderStatus(order.status as OrderStatus, "EXPIRE");
      await tx.order.update({ where: { id: order.id }, data: { status: nextStatus } });
    }
    return expiring.length;
  });
}

export { sendOrderPaidEmails };
