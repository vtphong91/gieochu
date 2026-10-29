import type { OrderStatus } from "@gieochu/core";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { formatVndFull } from "../../../../admin/_ui/stats-chart";
import type { OrderListSort, OrderPaymentChannel } from "../../../../../lib/order";

/*
 * ADR-046 — nhãn và định dạng của trang Đơn hàng Studio (danh sách + chi tiết). File thuần (không JSX, không I/O) để
 * Server lẫn Client Component dùng chung. Dữ liệu/kiểu lấy từ loader `lib/order.ts` (`listOrdersPage`,
 * `getOrderDetailView`); URL dựng bằng `buildOrderListSearch` của loader.
 */

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FULFILLED: "Hoàn tất",
  EXPIRED: "Đã hết hạn",
  CANCELED: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, "success" | "warning" | "danger" | "neutral" | "info"> = {
  PENDING: "warning",
  PAID: "info",
  FULFILLED: "success",
  EXPIRED: "neutral",
  CANCELED: "danger",
  REFUNDED: "neutral",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABEL[status as OrderStatus] ?? status;
}

export function orderStatusTone(status: string): "success" | "warning" | "danger" | "neutral" | "info" {
  return ORDER_STATUS_TONE[status as OrderStatus] ?? "neutral";
}

export const ORDER_SORT_LABEL: Record<OrderListSort, string> = {
  "moi-nhat": "Mới nhất trước",
  "cu-nhat": "Cũ nhất trước",
  "tong-giam": "Tổng tiền cao → thấp",
  "tong-tang": "Tổng tiền thấp → cao",
};

/** Cổng thanh toán của gian hàng (`PaymentProviderId`). */
export const PAYMENT_PROVIDER_LABEL: Record<string, string> = {
  MANUAL_QR: "QR chuyển khoản thủ công",
  SEPAY: "SePay (chuyển khoản tự động)",
  MOMO: "Ví MoMo",
  MOMO_MANUAL: "MoMo (thủ công)",
};

function providerText(provider: string | null): string | null {
  return provider ? (PAYMENT_PROVIDER_LABEL[provider] ?? provider) : null;
}

/** Kênh thanh toán hiển thị ở thẻ Thông tin chung. */
export function paymentChannelText(channel: OrderPaymentChannel): string {
  switch (channel.kind) {
    case "PROVIDER":
      return `${providerText(channel.provider)} · mã GD ${channel.providerTxnId}`;
    case "MANUAL":
      return channel.provider ? `${providerText(channel.provider)} · chủ gian hàng xác nhận thủ công` : "Chủ gian hàng xác nhận thủ công";
    case "FREE":
      return "Miễn phí — không cần thanh toán";
    case "UNKNOWN":
      return providerText(channel.provider) ?? "Không xác định (dữ liệu cũ)";
    case "UNPAID":
      return channel.provider ? `Chưa thanh toán · khách chọn ${providerText(channel.provider)}` : "Chưa thanh toán · khách chưa chọn kênh";
  }
}

/**
 * Giá / tổng tiền của **một đơn hoặc một dòng** ("993.000 đ"); 0 đ → "Miễn phí". Số tổng hợp (Lịch sử khách, giảm giá,
 * giao dịch…) dùng `formatOrderVnd` để luôn hiện "0 đ".
 */
export function formatOrderPrice(vnd: number): string {
  return vnd === 0 ? "Miễn phí" : formatVndFull(vnd);
}

/** Tiền VND đầy đủ, 0 → "0 đ" — cho số tổng hợp / không phải giá đơn. */
export function formatOrderVnd(vnd: number): string {
  return formatVndFull(vnd);
}

const dateFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
const timeFormat = new Intl.DateTimeFormat("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", hour12: false });

export function formatOrderDate(date: Date): string {
  return dateFormat.format(date);
}

export function formatOrderTime(date: Date): string {
  return timeFormat.format(date);
}

/** "18/10/2026 14:05" (giờ Việt Nam). */
export function formatOrderDateTime(date: Date): string {
  return `${dateFormat.format(date)} ${timeFormat.format(date)}`;
}

/** `YYYY-MM-DD` của hôm nay theo giờ VN (cho ô chọn ngày). */
export function todayIsoVn(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: DISPLAY_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function hrefWithSearch(basePath: string, search: string, hash?: string): string {
  return `${basePath}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}

/**
 * Link chi tiết kèm `?back=<query danh sách>` để nút "← Danh sách đơn hàng" quay về đúng bộ lọc/trang. Trang chi tiết
 * luôn ghép `back` vào đường dẫn danh sách cố định (không phải URL tự do → không open redirect).
 */
export function orderDetailHref(basePath: string, orderId: string, listSearch: string, hash?: string): string {
  return hrefWithSearch(`${basePath}/${orderId}`, listSearch ? new URLSearchParams({ back: listSearch }).toString() : "", hash);
}

const BACK_KEYS = new Set(["q", "trang-thai", "status", "remedy", "san-pham", "khach", "ky", "tu", "den", "sap-xep", "trang", "so-dong"]);

/** Dựng lại link danh sách từ `?back=` — chỉ giữ các khoá lọc đã biết (loader vẫn parse phòng thủ). */
export function orderListBackHref(basePath: string, back: string | string[] | undefined): string {
  const raw = Array.isArray(back) ? back[0] : back;
  if (!raw) return basePath;
  const kept = new URLSearchParams();
  for (const [key, value] of new URLSearchParams(raw.slice(0, 1000))) if (BACK_KEYS.has(key) && value) kept.set(key, value.slice(0, 200));
  return hrefWithSearch(basePath, kept.toString());
}

/**
 * ADR-047 — giới hạn hiển thị (đếm ký tự) của ô ghi chú nội bộ. Bản sao của `ORDER_NOTE_MAX_LENGTH` (`lib/order-note.ts`)
 * vì module đó kéo `@gieochu/db` vào client bundle; server vẫn là nơi kiểm thật — đổi một nơi thì đổi cả hai.
 */
export const ORDER_NOTE_MAX_LENGTH_UI = 1000;

/** Tên tác giả ghi chú: họ tên → email → "Tài khoản đã xoá" (tác giả bị xoá). */
export function orderNoteAuthorText(author: { name: string | null; email: string } | null): string {
  return author ? (author.name ?? author.email) : "Tài khoản đã xoá";
}
