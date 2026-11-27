import { after } from "next/server";
import { DISPLAY_TIME_ZONE, logger, productPath } from "@gieochu/core";
import { getPrismaClient, withTenant } from "@gieochu/db";
import { getEnv } from "@gieochu/config";
import type { PaymentProviderId } from "@gieochu/payments";
import {
  renderOrderStatusEmail,
  renderSubscriptionInvoiceEmail,
  type OrderStatusEmailStage,
  type SubscriptionInvoiceEmailStage,
} from "@gieochu/email";
import { sendEmailNow } from "./email-dispatch";
import { getEffectiveBrand } from "./branding";
import { getSupportEmail } from "./system-settings";

/**
 * ADR-070 — email thông báo trạng thái thanh toán. Mọi hàm ở đây gọi SAU khi nghiệp vụ đã commit, **không bao giờ ném** (lỗi chỉ
 * log) — không làm hỏng thanh toán/sweep. Chống gửi trùng nằm ở NƠI GỌI: chỉ gọi khi chính lần chạy đó vừa chuyển trạng thái (cập
 * nhật có điều kiện) hoặc vừa ghi lần đầu sự kiện/giao dịch (unique `webhook_events` / giao dịch).
 * - Hoá đơn gói (L1): gửi chủ gian hàng; loại email ghi EmailSendLog (tiêu đề chỉ mã hoá đơn + tên gói).
 * - Đơn tài liệu (L2/L3): gửi khách của đơn, đọc dưới `withTenant`; loại email nằm trong `TENANT_CUSTOMER_FACING_TYPES` (không ghi
 *   EmailSendLog — §7.9).
 */

export const SUBSCRIPTION_INVOICE_EMAIL_TYPES: Record<SubscriptionInvoiceEmailStage, string> = {
  PAID: "subscription_invoice_paid",
  EXPIRED: "subscription_invoice_expired",
  AMOUNT_MISMATCH: "subscription_invoice_amount_mismatch",
  PAYMENT_FAILED: "subscription_invoice_payment_failed",
  VOIDED: "subscription_invoice_voided",
};

export const ORDER_STATUS_EMAIL_TYPES: Record<OrderStatusEmailStage, string> = {
  EXPIRED: "order_expired_customer",
  AMOUNT_MISMATCH: "order_amount_mismatch_customer",
  PAYMENT_FAILED: "order_payment_failed_customer",
  CANCELED_BY_SELLER: "order_canceled_customer",
};

/** Nhãn cổng trong câu email (chữ thường — đứng sau "qua …"). Câu chữ theo soát của Phong (ADR-070). */
const PROVIDER_LABELS: Record<PaymentProviderId, string> = {
  MANUAL_QR: "chuyển khoản ngân hàng (QR)",
  SEPAY: "chuyển khoản ngân hàng",
  MOMO: "ví MoMo",
  MOMO_MANUAL: "chuyển tiền MoMo",
};

/** Tiền trong email: "150.000 đ" (có khoảng trắng). */
export function formatEmailVnd(amountVnd: number): string {
  return `${amountVnd.toLocaleString("vi-VN")} đ`;
}

/** Ngày dd/mm/yyyy theo giờ Việt Nam. */
function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Giờ + ngày (HH:mm dd/mm/yyyy) theo giờ Việt Nam — hạn thanh toán lại. */
function formatVnDateTime(date: Date): string {
  const time = date.toLocaleTimeString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${time} ${formatVnDate(date)}`;
}

function difference(receivedVnd: number, expectedVnd: number): { differenceDisplay: string; differenceKind: "SHORT" | "OVER" } {
  const diff = receivedVnd - expectedVnd;
  return diff < 0
    ? { differenceDisplay: `thiếu ${formatEmailVnd(-diff)}`, differenceKind: "SHORT" }
    : { differenceDisplay: `thừa ${formatEmailVnd(diff)}`, differenceKind: "OVER" };
}

function appUrl(): string {
  return getEnv().APP_URL.replace(/\/+$/, "");
}

/** A1–A5 — email hoá đơn gói cho chủ gian hàng. `receivedVnd` chỉ dùng cho AMOUNT_MISMATCH. */
export async function notifyOwnerOfInvoiceStatus(
  invoiceId: string,
  stage: SubscriptionInvoiceEmailStage,
  extra: { receivedVnd?: number } = {},
): Promise<void> {
  try {
    const invoice = await getPrismaClient().subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        code: true,
        tenantId: true,
        amountVnd: true,
        provider: true,
        periodStart: true,
        periodEnd: true,
        tenant: { select: { name: true, slug: true, owner: { select: { email: true } } } },
        plan: { select: { name: true } },
      },
    });
    if (!invoice) return;
    const [brand, supportEmail] = await Promise.all([getEffectiveBrand(), getSupportEmail()]);
    const rendered = renderSubscriptionInvoiceEmail(stage, {
      appName: brand.name,
      tenantName: invoice.tenant.name,
      invoiceCode: invoice.code,
      planName: invoice.plan.name,
      amountVndDisplay: formatEmailVnd(invoice.amountVnd),
      providerLabel: PROVIDER_LABELS[invoice.provider] ?? invoice.provider,
      billingUrl: `${appUrl()}/studio/${invoice.tenant.slug}/billing`,
      supportEmail: supportEmail ?? null,
      ...(stage === "PAID" ? { periodStartDisplay: formatVnDate(invoice.periodStart), periodEndDisplay: formatVnDate(invoice.periodEnd) } : {}),
      ...(stage === "AMOUNT_MISMATCH" && extra.receivedVnd !== undefined
        ? { receivedVndDisplay: formatEmailVnd(extra.receivedVnd), ...difference(extra.receivedVnd, invoice.amountVnd) }
        : {}),
    });
    const type = SUBSCRIPTION_INVOICE_EMAIL_TYPES[stage];
    const result = await sendEmailNow({ type, to: invoice.tenant.owner.email, ...rendered }, { tenantId: invoice.tenantId });
    if (!result.ok) logger.warn({ invoiceId, type, error: result.error }, "invoice.status_email: gửi email cho chủ gian hàng thất bại");
  } catch (error) {
    logger.warn({ invoiceId, stage, err: error }, "invoice.status_email: lỗi khi gửi email cho chủ gian hàng");
  }
}

/**
 * B2–B5 — email đơn tài liệu cho khách của đơn (luồng tenant — không qua admin, §7.9). `receivedVnd` cho AMOUNT_MISMATCH,
 * `provider` cho AMOUNT_MISMATCH/PAYMENT_FAILED (cổng của giao dịch).
 */
export async function notifyCustomerOfOrderStatus(
  tenantId: string,
  orderId: string,
  stage: OrderStatusEmailStage,
  extra: { receivedVnd?: number; provider?: PaymentProviderId } = {},
): Promise<void> {
  try {
    const [tenant, order] = await Promise.all([
      getPrismaClient().tenant.findUnique({ where: { id: tenantId }, select: { name: true, slug: true } }),
      withTenant(tenantId, (tx) =>
        tx.order.findFirst({
          where: { id: orderId, tenantId },
          select: {
            code: true,
            totalVnd: true,
            provider: true,
            expiresAt: true,
            customer: { select: { email: true } },
            _count: { select: { items: true } },
            items: {
              orderBy: { createdAt: "asc" },
              take: 1,
              select: { titleSnapshot: true, product: { select: { slug: true, status: true } } },
            },
          },
        }),
      ),
    ]);
    if (!tenant || !order) return;
    const base = appUrl();
    const storefrontUrl = `${base}/${tenant.slug}`;
    const item = order.items[0];
    const provider = extra.provider ?? order.provider;
    let actionUrl: string | undefined;
    if (stage === "EXPIRED") {
      // Mua lại tài liệu: trang tài liệu nếu còn bán; ngừng bán → không truyền (mẫu hiện nút "Xem trang gian hàng").
      if (item?.product.status === "PUBLISHED") actionUrl = `${base}${productPath(tenant.slug, item.product.slug)}`;
    } else if (stage === "PAYMENT_FAILED") {
      actionUrl = `${base}/${tenant.slug}/checkout/${order.code}`;
    }
    const brand = await getEffectiveBrand();
    const rendered = renderOrderStatusEmail(stage, {
      appName: brand.name,
      tenantName: tenant.name,
      orderCode: order.code,
      productTitle: item?.titleSnapshot ?? "",
      extraItemCount: Math.max(0, order._count.items - 1),
      totalVndDisplay: formatEmailVnd(order.totalVnd),
      storefrontUrl,
      ...(actionUrl ? { actionUrl } : {}),
      ...(provider ? { providerLabel: PROVIDER_LABELS[provider] ?? provider } : {}),
      ...(stage === "AMOUNT_MISMATCH" && extra.receivedVnd !== undefined
        ? { receivedVndDisplay: formatEmailVnd(extra.receivedVnd), ...difference(extra.receivedVnd, order.totalVnd) }
        : {}),
      ...(stage === "PAYMENT_FAILED" ? { holdUntilDisplay: formatVnDateTime(order.expiresAt) } : {}),
    });
    const type = ORDER_STATUS_EMAIL_TYPES[stage];
    const result = await sendEmailNow({ type, to: order.customer.email, ...rendered }, { tenantId });
    if (!result.ok) logger.warn({ tenantId, orderId, type, error: result.error }, "order.status_email: gửi email cho khách thất bại");
  } catch (error) {
    logger.warn({ tenantId, orderId, stage, err: error }, "order.status_email: lỗi khi gửi email cho khách");
  }
}

/**
 * Chạy các việc gửi email SAU response (`after()` của next/server) — webhook trả 2xx nhanh, không chờ SMTP. Ngoài phạm vi request
 * (test gọi thẳng route, script) `after()` ném đồng bộ → chạy luôn tại chỗ. Các việc tự bắt lỗi (không ném).
 */
export async function runAfterResponseOrNow(tasks: ReadonlyArray<() => Promise<void>>): Promise<void> {
  if (tasks.length === 0) return;
  const run = async () => {
    for (const task of tasks) await task();
  };
  try {
    after(run);
  } catch {
    await run();
  }
}
