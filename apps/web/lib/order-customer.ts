import { AppError, DISPLAY_TIME_ZONE, effectiveOrderStatus, logger, notFound, transitionOrderStatus, type OrderStatus } from "@gieochu/core";
import { getPrismaClient, withCustomer, withSystemJob, withTenant, type Prisma } from "@gieochu/db";
import { isManualConfirmProvider, type CheckoutResult, type PaymentProviderId } from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { renderCustomerDeclaredPaidEmail, renderOrderPaymentInstructionsEmail } from "@gieochu/email";
import { sendEmailNow, type ScheduleAfterResponse } from "./email-dispatch";
import { getBankByBin } from "./tenant-payment";
import { audit } from "./audit";

/**
 * ADR-061 / ADR-062 — các thao tác & email phía KHÁCH trên đơn đang chờ thanh toán.
 *
 * RLS: khách (scope `customer`) chỉ ĐỌC được đơn của mình (`select_access`); policy ghi của `orders` chỉ cho scope tenant/system_job
 * (`rls_adr029_split_write_policies`). Vì vậy mọi thao tác ghi theo cùng mẫu `initiateOrderCheckout`: đọc + kiểm chủ đơn dưới
 * `withCustomer(userId)`, rồi ghi có điều kiện dưới `withTenant(order.tenantId)` với `customerId` tường minh trong WHERE.
 * Email/khối hướng dẫn cho khách là L3 (không ghi EmailSendLog — `TENANT_CUSTOMER_FACING_TYPES`).
 */

/** ADR-062 bổ sung mục 6: tối đa 3 email hướng dẫn thanh toán / đơn (đếm qua audit `ORDER_PAYMENT_EMAIL_SENT`). */
export const MAX_PAYMENT_EMAILS_PER_ORDER = 3;
/** ADR-061 Q7: nhắc 1 lần khi còn ≤ 24 giờ. */
export const PAYMENT_REMINDER_WINDOW_HOURS = 24;

/** Nhãn phương thức hiển thị cho KHÁCH (ADR-062 Q8: SePay = "Chuyển khoản (xác nhận tự động)"). */
export const CUSTOMER_PROVIDER_LABELS: Record<PaymentProviderId, string> = {
  MANUAL_QR: "Chuyển khoản ngân hàng",
  SEPAY: "Chuyển khoản (xác nhận tự động)",
  // KB-Audit §45: MoMo API (tự xác nhận) phân biệt với "Ví MoMo" của MOMO_MANUAL.
  MOMO: "Ví MoMo (tự động)",
  // Brief bước 3: khách chỉ thấy "Ví MoMo" (xác nhận tay là chi tiết phía người bán).
  MOMO_MANUAL: "Ví MoMo",
};

function formatVnd(amountVnd: number): string {
  return `${amountVnd.toLocaleString("vi-VN")}đ`;
}

function formatDisplayDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE });
}

function appUrl(): string {
  return getEnv().APP_URL.replace(/\/+$/, "");
}

/** Thông tin chuyển tiền dạng chữ cho email — từ `checkoutPayload` hiện tại (đã tạo lại khi áp/gỡ mã, ADR-056). */
async function paymentLines(checkout: CheckoutResult | null, totalVnd: number): Promise<{ label: string; value: string }[]> {
  if (!checkout) return [];
  if (checkout.kind === "QR") {
    const bank = await getBankByBin(checkout.bank.bin);
    return [
      ...(bank ? [{ label: "Ngân hàng", value: bank.shortName }] : []),
      { label: "Số tài khoản", value: checkout.bank.accountNo },
      { label: "Chủ tài khoản", value: checkout.bank.accountName },
      { label: "Số tiền", value: formatVnd(totalVnd) },
      { label: "Nội dung chuyển khoản", value: checkout.content },
    ];
  }
  if (checkout.kind === "WALLET") {
    return [
      { label: "Ví", value: "MoMo" },
      { label: "Số điện thoại MoMo", value: checkout.phone },
      { label: "Tên chủ tài khoản", value: checkout.accountName },
      { label: "Số tiền", value: formatVnd(totalVnd) },
      { label: "Nội dung chuyển khoản (bắt buộc)", value: checkout.content },
    ];
  }
  return [];
}

const ORDER_EMAIL_SELECT = {
  id: true,
  code: true,
  status: true,
  totalVnd: true,
  expiresAt: true,
  provider: true,
  checkoutPayload: true,
  customerPaymentEmailedProvider: true,
  customer: { select: { email: true } },
  tenant: { select: { slug: true } },
  items: { select: { titleSnapshot: true } },
} as const satisfies Prisma.OrderSelect;

type OrderForEmail = Prisma.OrderGetPayload<{ select: typeof ORDER_EMAIL_SELECT }>;

async function sendPaymentInstructions(order: OrderForEmail, type: "order_payment_customer" | "order_payment_reminder"): Promise<boolean> {
  if (!order.provider) return false;
  const rendered = renderOrderPaymentInstructionsEmail({
    orderCode: order.code,
    productTitle: order.items.map((item) => item.titleSnapshot).join(", "),
    totalVndDisplay: formatVnd(order.totalVnd),
    expiresAtDisplay: formatDisplayDateTime(order.expiresAt),
    methodLabel: CUSTOMER_PROVIDER_LABELS[order.provider],
    lines: await paymentLines(order.checkoutPayload as CheckoutResult | null, order.totalVnd),
    checkoutUrl: `${appUrl()}/${order.tenant.slug}/checkout/${order.code}`,
    reminder: type === "order_payment_reminder",
    manualConfirm: isManualConfirmProvider(order.provider),
  });
  const result = await sendEmailNow({ type, to: order.customer.email, ...rendered });
  if (!result.ok) logger.warn({ orderId: order.id, type, error: result.error }, "order.customer_email: gửi email cho khách thất bại");
  return result.ok;
}

/**
 * ADR-061 Q7 + ADR-062 bổ sung mục 6 — email hướng dẫn thanh toán cho khách lúc chọn/đổi phương thức. Chỉ gửi khi phương thức
 * hiện tại KHÁC phương thức đã gửi lần trước (nhận nguyên tử `customerPaymentEmailedProvider`), tối đa
 * {@link MAX_PAYMENT_EMAILS_PER_ORDER} email/đơn. Gọi sau response; lỗi chỉ log.
 */
export async function notifyCustomerOfPaymentInstructions(tenantId: string, orderId: string): Promise<void> {
  try {
    const order = await withTenant(tenantId, (tx) => tx.order.findFirst({ where: { id: orderId, tenantId }, select: ORDER_EMAIL_SELECT }));
    if (!order || !order.provider || effectiveOrderStatus(order.status, order.expiresAt, new Date()) !== "PENDING") return;
    if (order.customerPaymentEmailedProvider === order.provider) return;
    const sentBefore = await getPrismaClient().auditLog.count({ where: { action: "ORDER_PAYMENT_EMAIL_SENT", targetType: "Order", targetId: orderId } });
    if (sentBefore >= MAX_PAYMENT_EMAILS_PER_ORDER) return;

    const provider = order.provider;
    const claimed = await withTenant(tenantId, (tx) =>
      tx.order.updateMany({
        where: {
          id: orderId,
          tenantId,
          provider,
          OR: [{ customerPaymentEmailedProvider: null }, { customerPaymentEmailedProvider: { not: provider } }],
        },
        data: { customerPaymentEmailedProvider: provider, customerPaymentEmailedAt: new Date() },
      }),
    );
    if (claimed.count === 0) return;
    await audit.log({
      actorId: null,
      scope: "SYSTEM",
      tenantId,
      action: "ORDER_PAYMENT_EMAIL_SENT",
      targetType: "Order",
      targetId: orderId,
      metadata: { provider, kind: "INSTRUCTIONS" },
      ip: null,
      userAgent: null,
    });
    await sendPaymentInstructions(order, "order_payment_customer");
  } catch (error) {
    logger.warn({ tenantId, orderId, err: error }, "order.customer_email: lỗi khi gửi email hướng dẫn thanh toán");
  }
}

/**
 * ADR-061 Q7 — bước cron hằng ngày: nhắc 1 lần các đơn còn chờ, ĐÃ chọn phương thức, còn ≤ 24 giờ. Nhận mốc
 * `customerReminderSentAt` nguyên tử trước khi gửi (cron chạy lại không nhắc trùng). Đọc dưới `withSystemJob` (job hệ thống).
 * Trả số email đã gửi.
 *
 * `tenantIds` (tuỳ chọn) — chỉ nhắc đơn của các tenant này (integration test, ADR-034 DB dùng chung). Bỏ trống = mọi tenant (cron).
 */
export async function runOrderPaymentReminders(now = new Date(), options: { tenantIds?: readonly string[] } = {}): Promise<number> {
  const tenantIds = options.tenantIds ? [...new Set(options.tenantIds)] : null;
  if (tenantIds !== null && tenantIds.length === 0) return 0;
  const until = new Date(now.getTime() + PAYMENT_REMINDER_WINDOW_HOURS * 60 * 60 * 1000);
  const due = await withSystemJob((tx) =>
    tx.order.findMany({
      where: {
        status: "PENDING",
        provider: { not: null },
        expiresAt: { gt: now, lte: until },
        customerReminderSentAt: null,
        ...(tenantIds !== null ? { tenantId: { in: tenantIds } } : {}),
      },
      select: ORDER_EMAIL_SELECT,
      orderBy: { expiresAt: "asc" },
      take: 500,
    }),
  );
  let sent = 0;
  for (const order of due) {
    try {
      const claimed = await withSystemJob((tx) =>
        tx.order.updateMany({ where: { id: order.id, status: "PENDING", customerReminderSentAt: null }, data: { customerReminderSentAt: new Date() } }),
      );
      if (claimed.count === 0) continue;
      if (await sendPaymentInstructions(order, "order_payment_reminder")) sent += 1;
    } catch (error) {
      logger.warn({ orderId: order.id, err: error }, "order.reminder: lỗi khi nhắc thanh toán");
    }
  }
  return sent;
}

async function loadOwnOrder(customerId: string, orderId: string) {
  const order = await withCustomer(customerId, (tx) =>
    tx.order.findFirst({
      where: { id: orderId, customerId },
      select: { id: true, tenantId: true, code: true, status: true, expiresAt: true, provider: true, customerDeclaredPaidAt: true },
    }),
  );
  if (!order) throw notFound("Không tìm thấy đơn hàng.");
  return order;
}

const notPendingError = () =>
  new AppError({ code: "ORDER_NOT_PENDING", message: "Đơn hàng không còn ở trạng thái chờ thanh toán.", httpStatus: 409 });

export interface CustomerOrderActionOptions {
  /** Server Action truyền `after` — email người bán gửi sau response. Bỏ trống → không gửi (test). */
  scheduleNotification?: ScheduleAfterResponse;
  /** Người thực hiện (chính khách) cho audit. */
  actorId?: string | null;
}

/**
 * ADR-062 Q1 — khách bấm "Tôi đã chuyển khoản": chỉ đơn còn chờ (hiệu lực) của cổng xác nhận tay; ghi `customerDeclaredPaidAt`
 * (idempotent), KHÔNG đổi `status`. Email người bán "Khách báo đã chuyển đơn {mã}" một lần/đơn (`ownerDeclaredPaidNotifiedAt`).
 * Mốc này mở ngoại lệ xác nhận sau hạn (ADR-062 bổ sung mục 3).
 */
export async function declareOrderPaid(customerId: string, orderId: string, options: CustomerOrderActionOptions = {}): Promise<{ declaredAt: Date }> {
  const order = await loadOwnOrder(customerId, orderId);
  const now = new Date();
  if (effectiveOrderStatus(order.status as OrderStatus, order.expiresAt, now) !== "PENDING") throw notPendingError();
  if (!order.provider || !isManualConfirmProvider(order.provider)) {
    throw new AppError({ code: "NOT_MANUAL_PROVIDER", message: "Phương thức này tự xác nhận khi tiền về — không cần báo đã chuyển.", httpStatus: 400 });
  }
  if (order.customerDeclaredPaidAt) return { declaredAt: order.customerDeclaredPaidAt };

  const { count } = await withTenant(order.tenantId, (tx) =>
    tx.order.updateMany({
      where: { id: orderId, customerId, status: "PENDING", expiresAt: { gt: now }, provider: order.provider, customerDeclaredPaidAt: null },
      data: { customerDeclaredPaidAt: now },
    }),
  );
  if (count === 0) {
    const fresh = await loadOwnOrder(customerId, orderId);
    if (fresh.customerDeclaredPaidAt) return { declaredAt: fresh.customerDeclaredPaidAt };
    throw new AppError({ code: "ORDER_CHANGED", message: "Đơn hàng vừa được cập nhật, vui lòng tải lại trang và thử lại.", httpStatus: 409 });
  }
  await audit.log({
    actorId: options.actorId ?? customerId,
    scope: "CUSTOMER",
    tenantId: order.tenantId,
    action: "ORDER_CUSTOMER_DECLARED_PAID",
    targetType: "Order",
    targetId: orderId,
    metadata: { provider: order.provider },
  });
  options.scheduleNotification?.(() => notifyOwnerOfDeclaredPaid(order.tenantId, orderId));
  return { declaredAt: now };
}

/** ADR-062 Q1 — "Tôi chưa chuyển khoản": hoàn tác khi đơn còn chờ (hiệu lực). Không gửi email lại cho người bán. */
export async function undoDeclareOrderPaid(customerId: string, orderId: string, options: CustomerOrderActionOptions = {}): Promise<void> {
  const order = await loadOwnOrder(customerId, orderId);
  const now = new Date();
  if (effectiveOrderStatus(order.status as OrderStatus, order.expiresAt, now) !== "PENDING") throw notPendingError();
  if (!order.customerDeclaredPaidAt) return;
  const { count } = await withTenant(order.tenantId, (tx) =>
    tx.order.updateMany({
      where: { id: orderId, customerId, status: "PENDING", expiresAt: { gt: now }, customerDeclaredPaidAt: { not: null } },
      data: { customerDeclaredPaidAt: null },
    }),
  );
  if (count === 0) return;
  await audit.log({
    actorId: options.actorId ?? customerId,
    scope: "CUSTOMER",
    tenantId: order.tenantId,
    action: "ORDER_CUSTOMER_DECLARED_PAID_UNDONE",
    targetType: "Order",
    targetId: orderId,
    metadata: { provider: order.provider },
  });
}

/**
 * ADR-062 Q4 — khách tự huỷ đơn đang chờ (hiệu lực PENDING). Chặn khi khách đã báo đã chuyển (phải hoàn tác trước — tránh huỷ
 * đơn mà tiền có thể đã về). PENDING → CANCELED theo FSM.
 */
export async function cancelOrderByCustomer(customerId: string, orderId: string, options: CustomerOrderActionOptions = {}): Promise<void> {
  const order = await loadOwnOrder(customerId, orderId);
  const now = new Date();
  const effective = effectiveOrderStatus(order.status as OrderStatus, order.expiresAt, now);
  if (effective !== "PENDING") throw notPendingError();
  if (order.customerDeclaredPaidAt) {
    throw new AppError({
      code: "ORDER_DECLARED_PAID",
      message: "Bạn đã báo đã chuyển khoản cho đơn này — chọn \"Tôi chưa chuyển khoản\" trước khi huỷ.",
      httpStatus: 409,
    });
  }
  const nextStatus = transitionOrderStatus(effective, "CANCEL");
  const { count } = await withTenant(order.tenantId, (tx) =>
    tx.order.updateMany({
      where: { id: orderId, customerId, status: "PENDING", expiresAt: { gt: now }, customerDeclaredPaidAt: null },
      data: { status: nextStatus },
    }),
  );
  if (count === 0) throw new AppError({ code: "ORDER_CHANGED", message: "Đơn hàng vừa được cập nhật, vui lòng tải lại trang và thử lại.", httpStatus: 409 });
  await audit.log({
    actorId: options.actorId ?? customerId,
    scope: "CUSTOMER",
    tenantId: order.tenantId,
    action: "ORDER_CANCELED_BY_CUSTOMER",
    targetType: "Order",
    targetId: orderId,
    metadata: { provider: order.provider },
  });
}

/** ADR-062 Q1 — email người bán "Khách báo đã chuyển đơn {mã}", một lần/đơn (nhận `ownerDeclaredPaidNotifiedAt`). Lỗi chỉ log. */
export async function notifyOwnerOfDeclaredPaid(tenantId: string, orderId: string): Promise<void> {
  try {
    const claimed = await withTenant(tenantId, (tx) =>
      tx.order.updateMany({
        where: { id: orderId, tenantId, customerDeclaredPaidAt: { not: null }, ownerDeclaredPaidNotifiedAt: null },
        data: { ownerDeclaredPaidNotifiedAt: new Date() },
      }),
    );
    if (claimed.count === 0) return;
    const [tenant, order] = await Promise.all([
      getPrismaClient().tenant.findUnique({ where: { id: tenantId }, select: { slug: true, owner: { select: { email: true } } } }),
      withTenant(tenantId, (tx) =>
        tx.order.findFirst({
          where: { id: orderId, tenantId },
          select: { id: true, code: true, totalVnd: true, provider: true, customerDeclaredPaidAt: true, items: { select: { titleSnapshot: true } } },
        }),
      ),
    ]);
    if (!tenant || !order || !order.provider || !order.customerDeclaredPaidAt) return;
    const rendered = renderCustomerDeclaredPaidEmail({
      orderCode: order.code,
      productTitle: order.items.map((item) => item.titleSnapshot).join(", "),
      totalVndDisplay: formatVnd(order.totalVnd),
      methodLabel: order.provider === "MOMO_MANUAL" ? "ví MoMo (đối chiếu lịch sử ví)" : "chuyển khoản ngân hàng (đối chiếu sao kê)",
      declaredAtDisplay: formatDisplayDateTime(order.customerDeclaredPaidAt),
      orderUrl: `${appUrl()}/studio/${tenant.slug}/orders/${order.id}`,
    });
    const result = await sendEmailNow({ type: "order_customer_declared_paid", to: tenant.owner.email, ...rendered });
    if (!result.ok) logger.warn({ tenantId, orderId, error: result.error }, "order.declared_paid: gửi email báo người bán thất bại");
  } catch (error) {
    logger.warn({ tenantId, orderId, err: error }, "order.declared_paid: lỗi khi gửi email báo người bán");
  }
}
