import { generatePaymentCode, isPaymentCode, PAYMENT_CODE_DIGITS } from "./payment-code";

/** Số ký tự sau tiền tố của mã hoá đơn — dùng để tách mã khỏi nội dung chuyển khoản (ADR-059, ADR-065). */
export const INVOICE_CODE_SUFFIX_LENGTH = PAYMENT_CODE_DIGITS;

/**
 * Mã hoá đơn gói = mã thanh toán ADR-065 (tiền tố + 8 chữ số) — với SePay, tiền tố là tiền tố đã cấu hình (VD "SEVQR"); cổng
 * khác dùng "SUB". Mã hoá đơn chính là nội dung chuyển khoản nên phải đúng định dạng SePay nhận diện được.
 */
export function generateInvoiceCode(prefix = "SUB"): string {
  return generatePaymentCode(prefix);
}

export function isValidInvoiceCode(code: string, prefix = "SUB"): boolean {
  return isPaymentCode(code, prefix);
}
