import { normalizePaymentCodePrefix, PAYMENT_CODE_DIGITS } from "@gieochu/core/payment-code";

/**
 * ADR-065 — chuỗi hướng dẫn cấu hình SePay dùng chung cho form System Center (hoá đơn gói) và Studio (đơn hàng của gian hàng),
 * cùng thông báo sau khi lưu. Chỉ là chuỗi thuần (không đụng DB/secret) nên client component import được — vì vậy chỉ import
 * subpath `@gieochu/core/payment-code`, không import `@gieochu/core` gốc.
 */

/** Tiền tố hiển thị: tiền tố người dùng nhập (chuẩn hoá in hoa) nếu hợp lệ, không thì `fallbackPrefix` (System "SUB", Studio tiền tố mã đơn). */
function displayPrefix(prefix: string, fallbackPrefix: string): string {
  return normalizePaymentCodePrefix(prefix) ?? (fallbackPrefix.trim().toUpperCase() || "…");
}

/** Cấu hình "Cấu trúc mã thanh toán" bên SePay phải khớp đúng `generatePaymentCode` (@gieochu/core). */
export function sepayCodeStructureInstruction(prefix: string): string {
  const shown = prefix.trim().toUpperCase() || "…";
  return `Trên SePay → Công ty → Cấu hình chung → Cấu trúc mã thanh toán: tiền tố "${shown}", hậu tố dài ${PAYMENT_CODE_DIGITS} ký tự, "Là số nguyên"; chỉ giữ một mẫu.`;
}

/** Gợi ý ngắn cho ô tiền tố (form) — ví dụ mã và lưu ý ngân hàng bắt buộc từ khoá đầu nội dung. */
export function sepayPrefixHint(prefix: string, fallbackPrefix: string): string {
  const shown = displayPrefix(prefix, fallbackPrefix);
  return `2–5 chữ cái không dấu. Mã thanh toán = tiền tố + ${PAYMENT_CODE_DIGITS} chữ số, VD: ${shown}40718256. VietinBank bắt buộc SEVQR.`;
}

/** Các bước cấu hình bên SePay (Công ty → Cấu hình chung) — form render thành danh sách có thứ tự. */
export function sepaySetupSteps(prefix: string, fallbackPrefix: string): string[] {
  const shown = displayPrefix(prefix, fallbackPrefix);
  return [
    `Cấu trúc mã thanh toán: tiền tố ${shown}, hậu tố dài ${PAYMENT_CODE_DIGITS} ký tự (đặt từ ${PAYMENT_CODE_DIGITS} đến ${PAYMENT_CODE_DIGITS}, hoặc khoảng có chứa ${PAYMENT_CODE_DIGITS}), chọn “Là số nguyên”.`,
    `Không để hai mẫu cùng tiền tố ${shown}.`,
    "Đổi tiền tố ở đây thì đổi mẫu bên SePay cùng lúc.",
  ];
}

/** Gợi ý ô API Token SePay (User API) — chỉ dùng cho "Kiểm tra kết nối". */
export const SEPAY_API_TOKEN_HINT =
  "Lấy ở my.sepay.vn → Cấu hình Công ty → API Access. Chỉ dùng để kiểm tra kết nối (xác nhận tài khoản đã liên kết SePay), không ảnh hưởng nhận tiền.";

/** Gợi ý ô secret theo kiểu xác thực đang chọn — khớp cách `verifySepayWebhook` kiểm tra (packages/payments). */
export function sepaySecretHint(authType: string): string {
  return authType === "API_KEY"
    ? "SePay gửi header Authorization: Apikey <key>. Ở SePay chọn “API Key” và dán đúng key này."
    : "Dán key này vào ô secret HMAC-SHA256 bên SePay — hai bên phải dùng cùng một secret.";
}
