import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

/** Ngày `dd/MM/yyyy` theo giờ Việt Nam (DISPLAY_TIME_ZONE). Nhận `Date` hoặc chuỗi ISO (sau khi qua ranh giới client). */
export function formatVnDate(value: Date | string): string {
  return new Date(value).toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
}

/** `HH:mm dd/MM/yyyy` theo giờ Việt Nam. */
export function formatVnDateTime(value: Date | string): string {
  const date = new Date(value);
  const time = date.toLocaleTimeString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });
  return `${time} ${formatVnDate(date)}`;
}

/** Tiền VND số nguyên, định dạng `vi-VN` + "đ". */
export function formatVnd(value: number): string {
  return `${Math.round(value).toLocaleString("vi-VN")}đ`;
}
