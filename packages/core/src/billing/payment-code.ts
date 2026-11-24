/**
 * ADR-065 — Mã thanh toán (nội dung chuyển khoản) cho cổng đối soát ngân hàng (SePay), dùng chung cho hoá đơn gói (PLATFORM) và
 * đơn hàng của gian hàng (TENANT):
 *
 *   mã = TIỀN TỐ (2–5 chữ cái in hoa) + 8 CHỮ SỐ (chữ số đầu khác 0), VD "SEVQR40718256".
 *
 * Vì sao: SePay "Cấu trúc mã thanh toán" chỉ nhận diện hậu tố THUẦN SỐ, độ dài cố định; ô tiền tố trên SePay giới hạn 2–5 chữ cái.
 * Hậu tố lẫn chữ → SePay không trích được mã, ghi "Xác thực tự động: Không thực hiện" và KHÔNG gọi webhook (sự cố 2026-11-24).
 * Một số ngân hàng bắt buộc nội dung bắt đầu bằng từ khoá (VietinBank: "SEVQR") → từ khoá đó LÀ tiền tố.
 * Cấu hình tương ứng trên SePay: tiền tố = tiền tố này, hậu tố "từ 8 đến 8", "Là số nguyên"; chỉ giữ một mẫu.
 */

export const PAYMENT_CODE_DIGITS = 8;
export const PAYMENT_CODE_PREFIX_MIN = 2;
export const PAYMENT_CODE_PREFIX_MAX = 5;

const PREFIX_PATTERN = new RegExp(`^[A-Z]{${PAYMENT_CODE_PREFIX_MIN},${PAYMENT_CODE_PREFIX_MAX}}$`);

/** Chuẩn hoá tiền tố người dùng nhập (trim + in hoa); không hợp lệ (ngoài 2–5 chữ cái A–Z) → null. */
export function normalizePaymentCodePrefix(value: unknown): string | null {
  const prefix = typeof value === "string" ? value.trim().toUpperCase() : "";
  return PREFIX_PATTERN.test(prefix) ? prefix : null;
}

/** Số nguyên ngẫu nhiên đều trong [0, max) bằng CSPRNG (Web Crypto — chạy cả Node lẫn trình duyệt), loại phần lệch modulo. */
function randomBelow(max: number): number {
  const limit = Math.floor(0x1_0000_0000 / max) * max;
  const buf = new Uint32Array(1);
  for (;;) {
    globalThis.crypto.getRandomValues(buf);
    const value = buf[0]!;
    if (value < limit) return value % max;
  }
}

/** Sinh mã thanh toán. Tiền tố phải hợp lệ (gọi `normalizePaymentCodePrefix` trước) — sai thì ném lỗi lập trình. */
export function generatePaymentCode(prefix: string): string {
  if (!PREFIX_PATTERN.test(prefix)) throw new Error(`Invalid payment code prefix: ${prefix}`);
  const min = 10 ** (PAYMENT_CODE_DIGITS - 1);
  return `${prefix}${min + randomBelow(9 * min)}`;
}

/** Đúng định dạng mã thanh toán; có `prefix` thì phải đúng tiền tố đó. */
export function isPaymentCode(code: string, prefix?: string): boolean {
  const head = prefix ?? `[A-Z]{${PAYMENT_CODE_PREFIX_MIN},${PAYMENT_CODE_PREFIX_MAX}}`;
  return new RegExp(`^${head}[1-9]\\d{${PAYMENT_CODE_DIGITS - 1}}$`).test(code);
}
