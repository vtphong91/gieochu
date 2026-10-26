import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import type { AdminInvoiceProvider, AdminInvoiceStatus, AdminSubscriptionStatus } from "../../../lib/subscription-billing";
import type { PlatformTxnFilter, PlatformTxnState } from "../../../lib/platform-transactions";

/**
 * Nhãn tiếng Việt + tông badge cho hoá đơn gói / thuê bao (ADR-056) — dùng chung `/admin/billing/invoices` và
 * `/admin/subscriptions`. Badge luôn hiện CHỮ (không truyền nghĩa chỉ bằng màu). Nhãn khớp Studio `/billing`.
 */
type Tone = "success" | "warning" | "danger" | "neutral" | "info";

export const INVOICE_STATUS_LABEL: Record<AdminInvoiceStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  EXPIRED: "Đã hết hạn",
  VOID: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
};

export const INVOICE_STATUS_TONE: Record<AdminInvoiceStatus, Tone> = {
  PENDING: "warning",
  PAID: "success",
  EXPIRED: "neutral",
  VOID: "danger",
  REFUNDED: "neutral",
};

export const INVOICE_PROVIDER_LABEL: Record<AdminInvoiceProvider, string> = {
  MANUAL_QR: "QR thủ công",
  MOMO_MANUAL: "MoMo (chuyển tay)",
  SEPAY: "SePay",
  MOMO: "MoMo",
};

export const SUBSCRIPTION_STATUS_LABEL: Record<AdminSubscriptionStatus, string> = {
  TRIALING: "Dùng thử",
  ACTIVE: "Đang hoạt động",
  PAST_DUE: "Quá hạn thanh toán",
  GRACE: "Quá hạn (ân hạn)",
  EXPIRED: "Đã hết hạn",
  CANCELED: "Đã huỷ gia hạn",
};

export const SUBSCRIPTION_STATUS_TONE: Record<AdminSubscriptionStatus, Tone> = {
  TRIALING: "info",
  ACTIVE: "success",
  PAST_DUE: "warning",
  GRACE: "warning",
  EXPIRED: "danger",
  CANCELED: "neutral",
};

/** Ngày + giờ ngắn theo Asia/Ho_Chi_Minh, vd "25/10/2026 14:05". */
export function formatAdminDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, dateStyle: "short", timeStyle: "short" });
}

/** Chỉ ngày theo Asia/Ho_Chi_Minh, vd "25/10/2026". */
export function formatAdminDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** ADR-059 (B2) — tình trạng giao dịch cổng thu phí gói (`platform_payment_transactions`), suy ra từ cột sẵn có. */
export const PLATFORM_TXN_FILTER_LABEL: Record<PlatformTxnFilter, string> = {
  "chua-khop": "Chưa khớp hoá đơn",
  "khop-chua-ap": "Khớp nhưng hoá đơn chưa thanh toán",
  "da-ap": "Đã áp vào hoá đơn",
};

export const PLATFORM_TXN_STATE_LABEL: Record<PlatformTxnState, string> = {
  APPLIED: "Đã áp",
  MATCHED_NOT_APPLIED: "Khớp, chưa áp",
  AMOUNT_MISMATCH: "Sai số tiền",
  INVOICE_NOT_FOUND: "Không tìm thấy hoá đơn",
  NO_REFERENCE: "Thiếu mã hoá đơn",
  NOT_INCOMING: "Không phải tiền vào",
};

export const PLATFORM_TXN_STATE_TONE: Record<PlatformTxnState, Tone> = {
  APPLIED: "success",
  MATCHED_NOT_APPLIED: "warning",
  AMOUNT_MISMATCH: "danger",
  INVOICE_NOT_FOUND: "danger",
  NO_REFERENCE: "warning",
  NOT_INCOMING: "neutral",
};
