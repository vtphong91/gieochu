const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const SUFFIX_LENGTH = 8;
/** Số ký tự sau tiền tố của mã hoá đơn — dùng để tách mã khỏi nội dung chuyển khoản (ADR-059). */
export const INVOICE_CODE_SUFFIX_LENGTH = SUFFIX_LENGTH;

/** §"M3": "mã SUB + chuỗi ngẫu nhiên 8 ký tự in hoa". */
export function generateInvoiceCode(prefix = "SUB"): string {
  let suffix = "";
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    suffix += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `${prefix}${suffix}`;
}

export function isValidInvoiceCode(code: string, prefix = "SUB"): boolean {
  const pattern = new RegExp(`^${prefix}[A-Z0-9]{${SUFFIX_LENGTH}}$`);
  return pattern.test(code);
}
