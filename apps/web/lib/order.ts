import { z } from "zod";
import {
  AppError,
  applyOrderToCustomerStats,
  auditActionLabel,
  calculateOrderPricing,
  canManuallyConfirmOrder,
  canPurchaseProduct,
  computeOrderExpiresAt,
  effectiveOrderStatus,
  generateOrderCode,
  internalError,
  logger,
  notFound,
  REMEDY_REFUND_SLA_DAYS,
  resolveDashboardRange,
  transitionOrderStatus,
  type DashboardPreset,
  type OrderStatus,
  type TenantCustomerStats,
} from "@gieochu/core";
import { getPrismaClient, Prisma, withCustomer, withSystemJob, withTenant, type Tx } from "@gieochu/db";
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
import { audit, isAuditTableMissing } from "./audit";
import { escapeLikePattern } from "./shop";
import { listOrderNotes, type OrderNoteView } from "./order-note";

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

// ───────────────────────── ADR-046: danh sách đơn Studio (lọc / tìm / sắp xếp / phân trang server) ─────────────────────────

/** Mọi trạng thái lọc được (trạng thái HIỆU LỰC — ADR-036). Thứ tự = thứ tự trong dropdown. */
export const ORDER_LIST_STATUSES = ["PENDING", "PAID", "FULFILLED", "EXPIRED", "CANCELED", "REFUNDED"] as const satisfies readonly OrderStatus[];
export const ORDER_LIST_SORTS = ["moi-nhat", "cu-nhat", "tong-giam", "tong-tang"] as const;
export type OrderListSort = (typeof ORDER_LIST_SORTS)[number];
export const ORDER_LIST_DEFAULT_SORT: OrderListSort = "moi-nhat";
/** Khớp lựa chọn của component Pagination (admin/_ui/pagination.tsx). */
export const ORDER_LIST_PAGE_SIZES = [10, 20, 50, 100] as const;
export const ORDER_LIST_DEFAULT_PAGE_SIZE = 20;
export const ORDER_LIST_Q_MAX = 100;

export type OrderRowAction = "confirm" | "cancel" | "refund" | "view";

/** Bộ lọc đã chuẩn hoá (trang dùng để điền lại form / dựng URL bằng {@link buildOrderListSearch}). */
export interface OrderListQuery {
  status: OrderStatus | null;
  remedy: "REFUND_REQUESTED" | null;
  q: string | null;
  /** Khoảng ngày TẠO ĐƠN (ADR-046). null = mọi thời gian (không có `ky`, hoặc `ky`/`tu`/`den` không hợp lệ). */
  range: {
    key: DashboardPreset;
    label: string;
    /** `YYYY-MM-DD` (giờ VN) — chỉ có với `tuy-chon`. */
    customFrom: string | null;
    customTo: string | null;
    /** `YYYY-MM-DD` (giờ VN) — ngày đầu / ngày cuối bao gồm, cho ô `dd/mm/yyyy - dd/mm/yyyy`. */
    displayFrom: string;
    displayTo: string;
    /** UTC, nửa mở `[start, end)` theo `createdAt`. */
    start: Date;
    end: Date;
  } | null;
  /** Chỉ giữ khi sản phẩm thuộc gian hàng và đã có trong ít nhất 1 đơn (có trong `products`). */
  productId: string | null;
  /**
   * ADR-048 — `?khach=<userId>`: chỉ đơn của một khách. `listOrdersPage` chỉ giữ khi khách có ít nhất 1 đơn tại gian hàng
   * (mọi trạng thái); không thì bỏ (null) — như `productId`.
   */
  customerId: string | null;
  sort: OrderListSort;
  /** Trang YÊU CẦU (≥1). Trang thực tế sau khi kẹp ở `OrderListPage.page`. */
  page: number;
  pageSize: number;
}

export interface OrderListItem {
  id: string;
  code: string;
  createdAt: Date;
  paidAt: Date | null;
  /** Trạng thái hiệu lực (ADR-036: PENDING quá hạn → EXPIRED). */
  status: OrderStatus;
  totalVnd: number;
  /** ADR-041/044: chỉ họ tên + email — KHÔNG SĐT/địa chỉ. `fullName` null khi khách chưa có hồ sơ. */
  customer: { fullName: string | null; email: string };
  items: { productTitle: string }[];
  /** ADR-039: có dòng đơn đang REFUND_REQUESTED. */
  refundRequested: boolean;
  /** `remedyChosenAt` của yêu cầu hoàn tiền đang chờ (null khi không có) — dùng với `isRefundOverdue`. */
  refundRequestedAt: Date | null;
  /** Yêu cầu hoàn tiền quá hạn {@link REMEDY_REFUND_SLA_DAYS} ngày. */
  refundOverdue: boolean;
  /** Luôn có "view". Thứ tự cố định: view, confirm, cancel, refund. */
  allowedActions: OrderRowAction[];
}

export type OrderStatusCounts = Record<OrderStatus | "ALL", number>;

export interface OrderListPage {
  items: OrderListItem[];
  /** Số đơn khớp TOÀN BỘ bộ lọc. */
  total: number;
  /** Trang thực tế (đã kẹp về [1, pageCount]). */
  page: number;
  pageSize: number;
  /** ≥ 1 (kể cả khi total = 0). */
  pageCount: number;
  /** Số đơn theo trạng thái hiệu lực, áp MỌI bộ lọc khác TRỪ trạng thái (q, khoảng ngày, sản phẩm, khách, remedy). ALL = tổng. */
  statusCounts: OrderStatusCounts;
  /** Số đơn có yêu cầu hoàn tiền đang chờ — TOÀN gian hàng, không áp bộ lọc (cảnh báo, như badge cũ). */
  refundRequestCount: number;
  /** Trong số trên, số đơn quá hạn {@link REMEDY_REFUND_SLA_DAYS} ngày. */
  refundRequestOverdueCount: number;
  /** Sản phẩm của gian hàng đã có trong ít nhất 1 đơn (mọi trạng thái), sắp theo tên — cho dropdown. */
  products: { id: string; title: string }[];
  /** ADR-048: khách đang lọc (`?khach=`, đã kiểm thuộc gian hàng) — chỉ họ tên + email (ADR-041); null khi không lọc. */
  customer: { userId: string; fullName: string | null; email: string } | null;
  query: OrderListQuery;
}

const firstQueryValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);
const statusParamSchema = z.preprocess(firstQueryValue, z.enum(ORDER_LIST_STATUSES));
const sortParamSchema = z.preprocess(firstQueryValue, z.enum(ORDER_LIST_SORTS));
const pageParamSchema = z.preprocess(firstQueryValue, z.coerce.number().int().min(1).max(1_000_000));
const pageSizeParamSchema = z.preprocess(firstQueryValue, z.coerce.number().int());
const productIdParamSchema = z.preprocess(firstQueryValue, z.string().regex(/^[a-z0-9]{1,64}$/));
/** cuid2 — cùng dạng với `san-pham`. */
const customerIdParamSchema = productIdParamSchema;
const textParamSchema = z.preprocess(firstQueryValue, z.string());

/** Chuẩn hoá từ khoá tìm kiếm: NFC, bỏ ký tự điều khiển, gộp khoảng trắng, cắt {@link ORDER_LIST_Q_MAX} ký tự. */
export function normalizeOrderSearchQuery(value: unknown): string | null {
  const parsed = textParamSchema.safeParse(value);
  if (!parsed.success) return null;
  const normalized = parsed.data
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, ORDER_LIST_Q_MAX)
    .trim();
  return normalized.length > 0 ? normalized : null;
}

export type OrderListSearchParams = Record<string, string | string[] | undefined>;

/**
 * Parse phòng thủ `searchParams` của `/studio/{slug}/orders` (không bao giờ ném). Tham số: `trang-thai` (tên trạng thái,
 * vd `PENDING`; nhận thêm `status` cũ — link Tổng quan), `remedy=REFUND_REQUESTED` (link trong email ADR-039), `q`,
 * `ky`/`tu`/`den` (như dashboard ADR-043; không có `ky` hoặc sai → mọi thời gian), `san-pham`, `khach` (userId — ADR-048),
 * `sap-xep`, `trang`, `so-dong`. `san-pham`/`khach` chỉ được kiểm định dạng ở đây; `listOrdersPage` bỏ nếu không thuộc
 * gian hàng.
 */
export function parseOrderListQuery(sp: OrderListSearchParams, now = new Date()): OrderListQuery {
  const status = statusParamSchema.safeParse(sp["trang-thai"] ?? sp.status);
  const sort = sortParamSchema.safeParse(sp["sap-xep"]);
  const page = pageParamSchema.safeParse(sp.trang);
  const size = pageSizeParamSchema.safeParse(sp["so-dong"]);
  const productId = productIdParamSchema.safeParse(sp["san-pham"]);
  const customerId = customerIdParamSchema.safeParse(sp.khach);

  let range: OrderListQuery["range"] = null;
  const ky = firstQueryValue(sp.ky);
  if (typeof ky === "string" && ky !== "") {
    const resolved = resolveDashboardRange({ ky, tu: sp.tu, den: sp.den, now });
    if (!resolved.invalid) {
      range = {
        key: resolved.key,
        label: resolved.label,
        customFrom: resolved.customFrom,
        customTo: resolved.customTo,
        displayFrom: resolved.displayFrom,
        displayTo: resolved.displayTo,
        start: resolved.start,
        end: resolved.end,
      };
    }
  }

  return {
    status: status.success ? status.data : null,
    remedy: parseOrderRemedyFilter(typeof firstQueryValue(sp.remedy) === "string" ? (firstQueryValue(sp.remedy) as string) : undefined) ?? null,
    q: normalizeOrderSearchQuery(sp.q),
    range,
    productId: productId.success ? productId.data : null,
    customerId: customerId.success ? customerId.data : null,
    sort: sort.success ? sort.data : ORDER_LIST_DEFAULT_SORT,
    page: page.success ? page.data : 1,
    pageSize: size.success && (ORDER_LIST_PAGE_SIZES as readonly number[]).includes(size.data) ? size.data : ORDER_LIST_DEFAULT_PAGE_SIZE,
  };
}

/**
 * Dựng query string (không có `?`) từ bộ lọc đã chuẩn hoá + phần thay đổi. Bỏ giá trị mặc định (sort `moi-nhat`,
 * trang 1, 20 dòng). Đổi bất kỳ bộ lọc nào mà không truyền `page` → về trang 1. `range` truyền dạng URL
 * (`{ ky, tu?, den? }`) hoặc null (mọi thời gian).
 */
export function buildOrderListSearch(
  query: OrderListQuery,
  patch: Partial<Omit<OrderListQuery, "range">> & { range?: { ky: DashboardPreset; tu?: string; den?: string } | null } = {},
): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.status) params.set("trang-thai", next.status);
  if (next.remedy) params.set("remedy", next.remedy);
  if (next.q) params.set("q", next.q);
  const range =
    "range" in patch
      ? patch.range
      : query.range
        ? { ky: query.range.key, tu: query.range.customFrom ?? undefined, den: query.range.customTo ?? undefined }
        : null;
  if (range) {
    params.set("ky", range.ky);
    if (range.ky === "tuy-chon" && range.tu && range.den) {
      params.set("tu", range.tu);
      params.set("den", range.den);
    }
  }
  if (next.productId) params.set("san-pham", next.productId);
  if (next.customerId) params.set("khach", next.customerId);
  if (next.sort !== ORDER_LIST_DEFAULT_SORT) params.set("sap-xep", next.sort);
  if (next.pageSize !== ORDER_LIST_DEFAULT_PAGE_SIZE) params.set("so-dong", String(next.pageSize));
  const filterChanged = Object.keys(patch).some((k) => k !== "page");
  const page = "page" in patch ? (patch.page ?? 1) : filterChanged ? 1 : query.page;
  if (page > 1) params.set("trang", String(page));
  return params.toString();
}

/** Thứ tự sắp xếp danh sách đơn (SQL, alias `o` = "orders"); luôn kết thúc bằng `id` để phân trang ổn định. */
function orderListOrderBySql(sort: OrderListSort): Prisma.Sql {
  switch (sort) {
    case "cu-nhat":
      return Prisma.sql`o."createdAt" ASC, o."id" ASC`;
    case "tong-giam":
      return Prisma.sql`o."totalVnd" DESC, o."createdAt" DESC, o."id" DESC`;
    case "tong-tang":
      return Prisma.sql`o."totalVnd" ASC, o."createdAt" DESC, o."id" DESC`;
    case "moi-nhat":
      return Prisma.sql`o."createdAt" DESC, o."id" DESC`;
  }
}

/** Mốc thời gian JS (UTC) → `timestamp(3)` UTC trong SQL thô (cột lưu UTC không múi giờ — mẫu `tenant-dashboard.ts`). */
export function utcTimestampSql(value: Date): Prisma.Sql {
  return Prisma.sql`(${value.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
}

/** ADR-036 bằng SQL: lọc theo trạng thái HIỆU LỰC — PENDING bỏ đơn quá hạn, EXPIRED gồm cả PENDING quá hạn. */
function effectiveStatusSql(status: OrderStatus, now: Date): Prisma.Sql {
  if (status === "PENDING") return Prisma.sql`(o."status" = 'PENDING' AND o."expiresAt" >= ${utcTimestampSql(now)})`;
  if (status === "EXPIRED") {
    return Prisma.sql`(o."status" = 'EXPIRED' OR (o."status" = 'PENDING' AND o."expiresAt" < ${utcTimestampSql(now)}))`;
  }
  return Prisma.sql`o."status"::text = ${status}`;
}

const LIKE_ESCAPE = "\\";

/** ADR-047 mục 1 (mẫu ADR-035): `gieochu_unaccent(lower(col)) LIKE '%' || gieochu_unaccent(lower($q)) || '%' ESCAPE '\'`. */
export function unaccentLikeSql(column: Prisma.Sql, escapedQuery: string): Prisma.Sql {
  return Prisma.sql`public.gieochu_unaccent(lower(${column})) LIKE '%' || public.gieochu_unaccent(lower(${escapedQuery})) || '%' ESCAPE ${LIKE_ESCAPE}`;
}

/**
 * ADR-046 — luật thao tác của MỘT đơn, đúng như trang chi tiết và các action hiện có (không đặt luật mới):
 * confirm = `canManuallyConfirmOrder` (PENDING, hoặc EXPIRED ≤ 24 giờ); cancel = trạng thái hiệu lực PENDING
 * (`cancelOrder` → `transitionOrderStatus(..., "CANCEL")`); refund = FULFILLED (`markOrderRefunded`).
 */
export function orderAllowedActions(order: { status: OrderStatus; expiresAt: Date }, now = new Date()): OrderRowAction[] {
  const effective = effectiveOrderStatus(order.status, order.expiresAt, now);
  const actions: OrderRowAction[] = ["view"];
  if (canManuallyConfirmOrder(order.status, order.expiresAt, now)) actions.push("confirm");
  if (effective === "PENDING") actions.push("cancel");
  if (effective === "FULFILLED") actions.push("refund");
  return actions;
}

function refundOverdueBefore(now: Date): Date {
  return new Date(now.getTime() - REMEDY_REFUND_SLA_DAYS * 24 * 60 * 60 * 1000);
}

/**
 * ADR-046 — danh sách đơn Studio. TIỀN ĐIỀU KIỆN: nơi gọi đã `requireTenantMember(slug)` (OWNER) và truyền `tenant.id`
 * lấy từ đó — không lấy tenantId từ URL. Toàn bộ trong MỘT `withTenant` + `tenantId` tường minh. Bảng L1 đọc: `users.email`,
 * `user_profiles.fullName` (chỉ 2 trường này — ADR-041). Trang vượt số trang → kẹp về trang cuối.
 * ADR-047 mục 1 — tìm `q` KHÔNG DẤU, không phân biệt hoa thường trên mã đơn / email khách / họ tên khách:
 * `gieochu_unaccent(lower(col)) LIKE ... ESCAPE '\'` (`%`/`_`/`\` của người dùng được escape, tham số hoá). Prisma không
 * biểu diễn được điều kiện này nên lọc + đếm + lấy id trang bằng SQL thô (cùng transaction RLS), rồi Prisma nạp đúng các
 * đơn của trang theo id (≤ 100).
 */
export async function listOrdersPage(tenantId: string, sp: OrderListSearchParams): Promise<OrderListPage> {
  const now = new Date();
  const parsed = parseOrderListQuery(sp, now);

  return withTenant(tenantId, async (tx) => {
    const products = await tx.product.findMany({
      where: { tenantId, orderItems: { some: {} } },
      select: { id: true, title: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    });
    const productId = parsed.productId && products.some((p) => p.id === parsed.productId) ? parsed.productId : null;
    // ADR-048: khách phải có ít nhất 1 đơn tại gian hàng này (RLS + tenantId tường minh) — không thì bỏ bộ lọc. `users`/
    // `user_profiles` (L1) chỉ đọc email + họ tên của đúng khách đó.
    const customerOrder = parsed.customerId
      ? await tx.order.findFirst({
          where: { tenantId, customerId: parsed.customerId },
          select: { customer: { select: { id: true, email: true, profile: { select: { fullName: true } } } } },
        })
      : null;
    const customer = customerOrder
      ? { userId: customerOrder.customer.id, fullName: customerOrder.customer.profile?.fullName ?? null, email: customerOrder.customer.email }
      : null;
    const customerId = customer?.userId ?? null;

    const nonStatusFilters: Prisma.Sql[] = [Prisma.sql`o."tenantId" = ${tenantId}`];
    if (parsed.remedy) {
      nonStatusFilters.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "order_items" oi JOIN "entitlements" e ON e."orderItemId" = oi."id"
        WHERE oi."orderId" = o."id" AND e."remedyStatus"::text = ${parsed.remedy}
      )`);
    }
    if (parsed.range) {
      nonStatusFilters.push(
        Prisma.sql`o."createdAt" >= ${utcTimestampSql(parsed.range.start)} AND o."createdAt" < ${utcTimestampSql(parsed.range.end)}`,
      );
    }
    if (productId) {
      nonStatusFilters.push(Prisma.sql`EXISTS (SELECT 1 FROM "order_items" oi WHERE oi."orderId" = o."id" AND oi."productId" = ${productId})`);
    }
    if (customerId) nonStatusFilters.push(Prisma.sql`o."customerId" = ${customerId}`);
    if (parsed.q) {
      const escaped = escapeLikePattern(parsed.q);
      nonStatusFilters.push(Prisma.sql`(
        ${unaccentLikeSql(Prisma.sql`o."code"`, escaped)}
        OR EXISTS (SELECT 1 FROM "users" u WHERE u."id" = o."customerId" AND ${unaccentLikeSql(Prisma.sql`u."email"`, escaped)})
        OR EXISTS (SELECT 1 FROM "user_profiles" up WHERE up."userId" = o."customerId" AND ${unaccentLikeSql(Prisma.sql`up."fullName"`, escaped)})
      )`);
    }
    const baseWhere = Prisma.join(nonStatusFilters, " AND ");
    const where = parsed.status ? Prisma.sql`${baseWhere} AND ${effectiveStatusSql(parsed.status, now)}` : baseWhere;

    const refundWhere: Prisma.OrderWhereInput = { tenantId, items: { some: { entitlement: { is: { remedyStatus: "REFUND_REQUESTED" } } } } };
    const [totalRows, grouped, refundRequestCount, refundRequestOverdueCount] = await Promise.all([
      tx.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT count(*)::int AS total FROM "orders" o WHERE ${where}`),
      // Đếm theo trạng thái hiệu lực (PENDING quá hạn tính là EXPIRED — ADR-036).
      tx.$queryRaw<{ status: OrderStatus; n: number }[]>(Prisma.sql`
        SELECT CASE WHEN o."status" = 'PENDING' AND o."expiresAt" < ${utcTimestampSql(now)} THEN 'EXPIRED' ELSE o."status"::text END AS status,
               count(*)::int AS n
        FROM "orders" o
        WHERE ${baseWhere}
        GROUP BY 1
      `),
      tx.order.count({ where: refundWhere }),
      tx.order.count({
        where: {
          tenantId,
          items: { some: { entitlement: { is: { remedyStatus: "REFUND_REQUESTED", remedyChosenAt: { lt: refundOverdueBefore(now) } } } } },
        },
      }),
    ]);
    const total = totalRows[0]?.total ?? 0;

    const statusCounts: OrderStatusCounts = { ALL: 0, PENDING: 0, PAID: 0, FULFILLED: 0, EXPIRED: 0, CANCELED: 0, REFUNDED: 0 };
    for (const row of grouped) {
      if (row.status in statusCounts) statusCounts[row.status] += row.n;
      statusCounts.ALL += row.n;
    }

    const pageCount = Math.max(1, Math.ceil(total / parsed.pageSize));
    const page = Math.min(parsed.page, pageCount);
    const pageIds =
      total > 0
        ? (
            await tx.$queryRaw<{ id: string }[]>(Prisma.sql`
              SELECT o."id" FROM "orders" o
              WHERE ${where}
              ORDER BY ${orderListOrderBySql(parsed.sort)}
              LIMIT ${parsed.pageSize}::int OFFSET ${(page - 1) * parsed.pageSize}::int
            `)
          ).map((row) => row.id)
        : [];
    const fetched =
      pageIds.length > 0
        ? await tx.order.findMany({
            where: { tenantId, id: { in: pageIds } },
            select: {
              id: true,
              code: true,
              createdAt: true,
              paidAt: true,
              status: true,
              expiresAt: true,
              totalVnd: true,
              customer: { select: { email: true, profile: { select: { fullName: true } } } },
              items: {
                orderBy: { createdAt: "asc" },
                select: { titleSnapshot: true, entitlement: { select: { remedyStatus: true, remedyChosenAt: true } } },
              },
            },
          })
        : [];
    const byId = new Map(fetched.map((order) => [order.id, order]));
    const rows = pageIds.flatMap((id) => {
      const order = byId.get(id);
      return order ? [order] : [];
    });

    const overdueBefore = refundOverdueBefore(now);
    const items = rows.map((order): OrderListItem => {
      const refund = order.items.find((item) => item.entitlement?.remedyStatus === "REFUND_REQUESTED")?.entitlement ?? null;
      const refundRequestedAt = refund?.remedyChosenAt ?? null;
      return {
        id: order.id,
        code: order.code,
        createdAt: order.createdAt,
        paidAt: order.paidAt,
        status: effectiveOrderStatus(order.status, order.expiresAt, now),
        totalVnd: order.totalVnd,
        customer: { fullName: order.customer.profile?.fullName ?? null, email: order.customer.email },
        items: order.items.map((item) => ({ productTitle: item.titleSnapshot })),
        refundRequested: refund !== null,
        refundRequestedAt,
        refundOverdue: refundRequestedAt !== null && refundRequestedAt.getTime() < overdueBefore.getTime(),
        allowedActions: orderAllowedActions(order, now),
      };
    });

    return {
      items,
      total,
      page,
      pageSize: parsed.pageSize,
      pageCount,
      statusCounts,
      refundRequestCount,
      refundRequestOverdueCount,
      products,
      customer,
      query: { ...parsed, productId, customerId, page },
    };
  });
}

// ───────────────────────── ADR-046: chi tiết đơn Studio ─────────────────────────

export type OrderPaymentChannel =
  /** Đã trả qua cổng (giao dịch tenant MATCHED mới nhất). */
  | { kind: "PROVIDER"; provider: PaymentProviderId; providerTxnId: string; at: Date }
  /** Chủ gian hàng xác nhận thủ công (`confirmNote` có giá trị — bắt buộc khi xác nhận tay). */
  | { kind: "MANUAL"; provider: PaymentProviderId | null }
  /** Đơn 0đ (tài liệu miễn phí / mã giảm 100%) — tự thanh toán. */
  | { kind: "FREE" }
  /** Đã thanh toán nhưng không xác định được kênh (dữ liệu cũ). `provider` = cổng khách đã chọn lúc checkout. */
  | { kind: "UNKNOWN"; provider: PaymentProviderId | null }
  /** Chưa thanh toán. `provider` = cổng khách đã chọn ở trang checkout (null nếu chưa chọn). */
  | { kind: "UNPAID"; provider: PaymentProviderId | null };

export interface OrderDetailLine {
  id: string;
  productId: string;
  productTitle: string;
  /** Đơn giá lúc đặt (đã gồm giá khuyến mãi nếu đang sale). Giá niêm yết trước khuyến mãi KHÔNG được lưu snapshot. */
  unitPriceVnd: number;
  /** Giảm từ mã giảm giá trên dòng này = unitPriceVnd − finalPriceVnd (≥ 0). */
  discountVnd: number;
  /** Mã giảm giá của đơn khi dòng này có giảm; null nếu không. */
  couponCode: string | null;
  /** Thành tiền dòng. */
  finalPriceVnd: number;
  entitlement: {
    id: string;
    downloadsUsed: number;
    /** 0 = không giới hạn. */
    downloadLimit: number;
    revokedAt: Date | null;
    remedyStatus: "NONE" | "PENDING_CHOICE" | "FINAL_DOWNLOAD" | "REFUND_REQUESTED" | "REFUNDED";
    remedyRequestedAt: Date | null;
    remedyChosenAt: Date | null;
    remedyResolvedAt: Date | null;
  } | null;
}

export interface OrderTimelineEvent {
  at: Date;
  kind:
    | "created"
    | "payment_txn"
    | "paid"
    | "expired"
    | "canceled"
    | "audit"
    | "remedy_opened"
    | "email"
    /** ADR-047: ghi chú nội bộ — `noteId` khớp `OrderDetailView.notes[].id`, `detail` = nội dung ghi chú. */
    | "note";
  label: string;
  detail?: string;
  /** Chỉ có với kind "note". */
  noteId?: string;
}

export interface OrderDetailView {
  id: string;
  code: string;
  /** Trạng thái hiệu lực (ADR-036). */
  status: OrderStatus;
  createdAt: Date;
  paidAt: Date | null;
  expiresAt: Date;
  subtotalVnd: number;
  discountVnd: number;
  totalVnd: number;
  couponCode: string | null;
  /** Ghi chú xác nhận thủ công của chủ gian hàng (có thể null). */
  confirmNote: string | null;
  paymentChannel: OrderPaymentChannel;
  /** ADR-041/044: chỉ họ tên + email. */
  customer: { fullName: string | null; email: string };
  lines: OrderDetailLine[];
  /** Giao dịch cổng thanh toán tenant gắn với đơn (không trả `rawPayload`), mới nhất trước. */
  transactions: { id: string; provider: PaymentProviderId; providerTxnId: string; amountVnd: number; matchStatus: "MATCHED" | "UNMATCHED" | "MISMATCH_AMOUNT"; createdAt: Date }[];
  /**
   * Lịch sử khách TẠI GIAN HÀNG NÀY (ADR-043): chỉ đơn `totalVnd > 0` đã thanh toán (`paidAt` khác null), mọi trạng thái
   * kể cả đã hoàn — `spentVnd` là doanh thu gộp (gồm đơn sau này hoàn), `refundedVnd` tách riêng phần đã hoàn.
   */
  customerHistory: { orders: number; spentVnd: number; refundedVnd: number; avgOrderVnd: number | null };
  /** Có yêu cầu hoàn tiền đang chờ (ADR-039). */
  refundRequested: boolean;
  refundRequestedAt: Date | null;
  refundOverdue: boolean;
  /** Cũ → mới. */
  timeline: OrderTimelineEvent[];
  allowedActions: OrderRowAction[];
  /**
   * ADR-047: ghi chú nội bộ (cũ → mới, tối đa 200). Khách không bao giờ thấy. Rỗng khi `notesAvailable = false`
   * (migration `order_notes` chưa áp — UI ẩn form thêm ghi chú / báo "chưa sẵn sàng").
   */
  notes: OrderNoteView[];
  notesAvailable: boolean;
}

const PROVIDER_LABELS: Record<PaymentProviderId, string> = { MANUAL_QR: "Chuyển khoản QR", SEPAY: "SePay", MOMO: "MoMo" };
const MATCH_STATUS_LABELS: Record<string, string> = { MATCHED: "khớp đơn", UNMATCHED: "không khớp đơn", MISMATCH_AMOUNT: "sai số tiền" };
const ORDER_TIMELINE_AUDIT_ACTIONS = [
  "ORDER_MANUALLY_CONFIRMED",
  "ORDER_REFUNDED",
  "COUPON_OVERUSED",
  "ENTITLEMENT_EXTRA_GRANTED",
  "ENTITLEMENT_REVOKED",
  "REMEDY_FINAL_DOWNLOAD_CHOSEN",
  "REMEDY_REFUND_REQUESTED",
];
/** Email gửi qua `sendEmailNow` có mã đơn trong tiêu đề — lọc được đúng đơn (mã đơn unique toàn hệ thống). */
const ORDER_EMAIL_TYPES: Record<string, string> = {
  order_paid: "Email xác nhận thanh toán gửi khách",
  remedy_refund_requested: "Email báo yêu cầu hoàn tiền gửi chủ gian hàng",
};

function formatAmount(amountVnd: number): string {
  return `${amountVnd.toLocaleString("vi-VN")}đ`;
}

/**
 * ADR-046 — dữ liệu trang chi tiết đơn Studio. TIỀN ĐIỀU KIỆN như {@link listOrdersPage} (OWNER, `tenant.id` từ guard).
 * Bảng L2 (orders, order_items, entitlements, tenant_payment_transactions, tenant_members) đọc trong MỘT `withTenant`.
 * Bảng L1: `audit_logs` (`tenantId` = tenant VÀ target là đơn này hoặc entitlement của đơn này — không IP/UA; actor
 * ngoài gian hàng chỉ hiện "Khách hàng"/"Quản trị hệ thống"/"Hệ thống"), `email_send_log` (chỉ loại có mã đơn trong
 * tiêu đề, người nhận ∈ {email khách của đơn, email chủ gian hàng}; không trả địa chỉ người nhận), `tenants.owner`.
 * Email `new_sale` (tiêu đề chỉ có tên tài liệu) và email remedy cho khách (tiêu đề theo tài liệu) KHÔNG lọc được theo
 * đơn → không đưa vào dòng thời gian.
 * ADR-047: ghi chú nội bộ đọc ở transaction `withTenant` riêng (lib/order-note.ts); `viewerId` (user đang xem) quyết định
 * `canDelete` (chỉ tác giả).
 */
export async function getOrderDetailView(tenantId: string, orderId: string, viewerId: string | null = null): Promise<OrderDetailView> {
  const now = new Date();
  const loaded = await withTenant(tenantId, async (tx) => {
    const order = await tx.order.findFirst({
      where: { id: orderId, tenantId },
      select: {
        id: true,
        code: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        paidAt: true,
        expiresAt: true,
        subtotalVnd: true,
        discountVnd: true,
        totalVnd: true,
        couponCode: true,
        provider: true,
        confirmNote: true,
        customerId: true,
        customer: { select: { email: true, profile: { select: { fullName: true } } } },
        items: {
          orderBy: { createdAt: "asc" },
          select: {
            id: true,
            productId: true,
            titleSnapshot: true,
            unitPriceVnd: true,
            finalPriceVnd: true,
            entitlement: {
              select: {
                id: true,
                downloadsUsed: true,
                downloadLimit: true,
                revokedAt: true,
                remedyStatus: true,
                remedyRequestedAt: true,
                remedyChosenAt: true,
                remedyResolvedAt: true,
              },
            },
          },
        },
        transactions: {
          where: { tenantId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { id: true, provider: true, providerTxnId: true, amountVnd: true, matchStatus: true, createdAt: true },
        },
      },
    });
    if (!order) return null;
    const [history, refunded, members] = await Promise.all([
      tx.order.aggregate({
        where: { tenantId, customerId: order.customerId, paidAt: { not: null }, totalVnd: { gt: 0 } },
        _count: { _all: true },
        _sum: { totalVnd: true },
      }),
      tx.order.aggregate({
        where: { tenantId, customerId: order.customerId, paidAt: { not: null }, totalVnd: { gt: 0 }, status: "REFUNDED" },
        _sum: { totalVnd: true },
      }),
      tx.tenantMember.findMany({ where: { tenantId }, select: { userId: true } }),
    ]);
    return { order, history, refunded, memberIds: new Set(members.map((m) => m.userId)) };
  });
  if (!loaded) throw notFound("Không tìm thấy đơn hàng.");
  const { order, history, refunded, memberIds } = loaded;
  const noteData = await listOrderNotes(tenantId, order.id, viewerId);

  const status = effectiveOrderStatus(order.status, order.expiresAt, now);
  const entitlementIds = order.items.flatMap((item) => (item.entitlement ? [item.entitlement.id] : []));
  const titleByEntitlement = new Map(order.items.flatMap((item) => (item.entitlement ? [[item.entitlement.id, item.titleSnapshot] as const] : [])));

  // ── Bảng L1 (không RLS) — phạm vi giới hạn tường minh bằng tenantId + target của đúng đơn này.
  const prisma = getPrismaClient();
  const [auditRows, owner] = await Promise.all([
    prisma.auditLog
      .findMany({
        where: {
          tenantId,
          action: { in: ORDER_TIMELINE_AUDIT_ACTIONS },
          OR: [
            { targetType: "Order", targetId: order.id },
            ...(entitlementIds.length > 0 ? [{ targetType: "Entitlement", targetId: { in: entitlementIds } }] : []),
          ],
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        take: 200,
        select: { id: true, actorId: true, scope: true, action: true, targetType: true, targetId: true, metadata: true, createdAt: true },
      })
      .catch((error: unknown) => {
        if (isAuditTableMissing(error)) return [];
        throw error;
      }),
    prisma.tenant.findUnique({ where: { id: tenantId }, select: { owner: { select: { email: true } } } }),
  ]);
  const recipients = [order.customer.email, ...(owner ? [owner.owner.email] : [])];
  const [emailRows, memberUsers] = await Promise.all([
    prisma.emailSendLog.findMany({
      where: {
        type: { in: Object.keys(ORDER_EMAIL_TYPES) },
        recipient: { in: recipients },
        subject: { contains: order.code },
        createdAt: { gte: order.createdAt },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      take: 50,
      select: { type: true, status: true, createdAt: true },
    }),
    (async () => {
      const ids = [...new Set(auditRows.flatMap((r) => (r.actorId && memberIds.has(r.actorId) ? [r.actorId] : [])))];
      if (ids.length === 0) return new Map<string, string>();
      const users = await prisma.user.findMany({ where: { id: { in: ids } }, select: { id: true, email: true, profile: { select: { fullName: true } } } });
      return new Map(users.map((u) => [u.id, u.profile?.fullName ?? u.email]));
    })(),
  ]);

  const actorLabel = (row: { actorId: string | null; scope: string }): string => {
    if (!row.actorId) return "Hệ thống";
    if (row.scope === "CUSTOMER") return "Khách hàng";
    const member = memberUsers.get(row.actorId);
    if (member) return member;
    return "Quản trị hệ thống";
  };

  const timeline: OrderTimelineEvent[] = [{ at: order.createdAt, kind: "created", label: "Đơn hàng được tạo", detail: `Tổng ${formatAmount(order.totalVnd)}` }];
  for (const txn of [...order.transactions].reverse()) {
    timeline.push({
      at: txn.createdAt,
      kind: "payment_txn",
      label: `Nhận giao dịch ${PROVIDER_LABELS[txn.provider]}`,
      detail: `${formatAmount(txn.amountVnd)} · ${MATCH_STATUS_LABELS[txn.matchStatus] ?? txn.matchStatus} · mã GD ${txn.providerTxnId}`,
    });
  }
  if (order.paidAt) {
    timeline.push({ at: order.paidAt, kind: "paid", label: order.totalVnd === 0 ? "Nhận tài liệu miễn phí (đơn 0đ)" : "Đơn hàng đã thanh toán" });
  } else if (status === "EXPIRED") {
    timeline.push({ at: order.expiresAt, kind: "expired", label: "Đơn hết hạn thanh toán" });
  }
  if (status === "CANCELED") {
    // `orders` không có `canceledAt`; CANCELED là trạng thái cuối nên lần cập nhật cuối = lúc huỷ.
    timeline.push({ at: order.updatedAt, kind: "canceled", label: "Đơn hàng bị huỷ" });
  }
  for (const item of order.items) {
    if (item.entitlement?.remedyRequestedAt) {
      timeline.push({
        at: item.entitlement.remedyRequestedAt,
        kind: "remedy_opened",
        label: "Tài liệu bị gỡ do vi phạm — khách được chọn tải lần cuối hoặc hoàn tiền",
        detail: item.titleSnapshot,
      });
    }
  }
  for (const row of auditRows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    const parts = [actorLabel(row)];
    if (row.targetType === "Entitlement" && row.targetId) {
      const title = titleByEntitlement.get(row.targetId);
      if (title) parts.push(title);
    }
    if (row.action === "ENTITLEMENT_EXTRA_GRANTED" && typeof meta.extra === "number") parts.push(`+${meta.extra} lượt`);
    if (row.action === "REMEDY_FINAL_DOWNLOAD_CHOSEN" && typeof meta.grantedDownloads === "number") parts.push(`${meta.grantedDownloads} lượt tải cuối`);
    if (row.action === "COUPON_OVERUSED" && typeof meta.couponCode === "string") parts.push(`mã ${meta.couponCode}`);
    timeline.push({ at: row.createdAt, kind: "audit", label: auditActionLabel(row.action), detail: parts.join(" · ") });
  }
  for (const email of emailRows) {
    timeline.push({
      at: email.createdAt,
      kind: "email",
      label: ORDER_EMAIL_TYPES[email.type] ?? "Email",
      detail: email.status === "SENT" ? "Đã gửi" : "Gửi thất bại",
    });
  }
  for (const note of noteData.notes) {
    const author = note.author ? (note.author.name ?? note.author.email) : "Tài khoản đã xoá";
    timeline.push({ at: note.createdAt, kind: "note", label: `Ghi chú nội bộ · ${author}`, detail: note.body, noteId: note.id });
  }
  timeline.sort((a, b) => a.at.getTime() - b.at.getTime());

  const matched = order.transactions.find((txn) => txn.matchStatus === "MATCHED");
  let paymentChannel: OrderPaymentChannel;
  if (!order.paidAt) paymentChannel = { kind: "UNPAID", provider: order.provider };
  else if (matched) paymentChannel = { kind: "PROVIDER", provider: matched.provider, providerTxnId: matched.providerTxnId, at: matched.createdAt };
  else if (order.confirmNote) paymentChannel = { kind: "MANUAL", provider: order.provider };
  else if (order.totalVnd === 0) paymentChannel = { kind: "FREE" };
  else paymentChannel = { kind: "UNKNOWN", provider: order.provider };

  const refund = order.items.find((item) => item.entitlement?.remedyStatus === "REFUND_REQUESTED")?.entitlement ?? null;
  const refundRequestedAt = refund?.remedyChosenAt ?? null;
  const historyOrders = history._count._all;
  const spentVnd = history._sum.totalVnd ?? 0;

  return {
    id: order.id,
    code: order.code,
    status,
    createdAt: order.createdAt,
    paidAt: order.paidAt,
    expiresAt: order.expiresAt,
    subtotalVnd: order.subtotalVnd,
    discountVnd: order.discountVnd,
    totalVnd: order.totalVnd,
    couponCode: order.couponCode,
    confirmNote: order.confirmNote,
    paymentChannel,
    customer: { fullName: order.customer.profile?.fullName ?? null, email: order.customer.email },
    lines: order.items.map((item) => {
      const discountVnd = Math.max(0, item.unitPriceVnd - item.finalPriceVnd);
      return {
        id: item.id,
        productId: item.productId,
        productTitle: item.titleSnapshot,
        unitPriceVnd: item.unitPriceVnd,
        discountVnd,
        couponCode: discountVnd > 0 ? order.couponCode : null,
        finalPriceVnd: item.finalPriceVnd,
        entitlement: item.entitlement,
      };
    }),
    transactions: order.transactions,
    customerHistory: {
      orders: historyOrders,
      spentVnd,
      refundedVnd: refunded._sum.totalVnd ?? 0,
      avgOrderVnd: historyOrders > 0 ? Math.floor(spentVnd / historyOrders) : null,
    },
    refundRequested: refund !== null,
    refundRequestedAt,
    refundOverdue: refundRequestedAt !== null && refundRequestedAt.getTime() < refundOverdueBefore(now).getTime(),
    timeline,
    allowedActions: orderAllowedActions(order, now),
    notes: noteData.notes,
    notesAvailable: noteData.available,
  };
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
