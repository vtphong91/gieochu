import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import type { CheckoutDisplayStatus } from "../../../../../lib/checkout-view";

/** Tiền VND số nguyên theo `vi-VN` + "đ" (vd. 99.000đ). */
export function formatVnd(amountVnd: number): string {
  return `${Math.trunc(amountVnd).toLocaleString("vi-VN")}đ`;
}

/** "14:30 26/10/2026" theo giờ Việt Nam. */
export function formatDateTime(date: Date): string {
  const time = date.toLocaleTimeString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  const day = date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
  return `${time} ${day}`;
}

/** "14:30, Thứ Năm 29/10/2026" — dòng hạn giữ đơn (ADR-062 §4.1, không đếm ngược). */
export function formatHoldDeadline(date: Date): string {
  const time = date.toLocaleTimeString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  const weekday = date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, weekday: "long" });
  const day = date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
  return `${time}, ${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${day}`;
}

/** Thời điểm đã qua chưa / còn dưới 24 giờ — tính ở server mỗi lần render (không có bộ đếm phía client). */
export function deadlineInfo(date: Date): { passed: boolean; underOneDay: boolean } {
  const left = date.getTime() - Date.now();
  return { passed: left <= 0, underOneDay: left > 0 && left < 24 * 60 * 60 * 1000 };
}

export const STATUS_LABEL: Record<CheckoutDisplayStatus, string> = {
  AWAITING_PAYMENT: "Chờ thanh toán",
  AWAITING_SELLER_CONFIRM: "Chờ người bán xác nhận",
  PAID: "Đã thanh toán",
  EXPIRED: "Đã hết hạn",
  CANCELED: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
};

/** Bước hiện tại trên 4 bước (Đặt đơn · Thanh toán · Xác nhận · Tải tài liệu). */
export const STATUS_STEP: Record<CheckoutDisplayStatus, number> = {
  AWAITING_PAYMENT: 2,
  AWAITING_SELLER_CONFIRM: 3,
  PAID: 4,
  EXPIRED: 2,
  CANCELED: 2,
  REFUNDED: 4,
};
