import { z } from "zod";
import type { CheckoutWalletResult, CreateCheckoutArgs, MomoManualConfig, PaymentProvider } from "../types";

/** Số điện thoại di động VN: 0xxxxxxxxx (10 số), chấp nhận +84/84 ở đầu và dấu cách/chấm/gạch. */
export function normalizeVnMobilePhone(value: string): string | null {
  const digits = value.replace(/[\s.\-()]/g, "");
  const local = digits.startsWith("+84") ? `0${digits.slice(3)}` : digits.startsWith("84") && digits.length === 11 ? `0${digits.slice(2)}` : digits;
  return /^0[35789]\d{8}$/.test(local) ? local : null;
}

/** Tên chủ ví theo kiểu ngân hàng: bỏ dấu, `đ` → `D`, VIẾT HOA, gộp khoảng trắng. */
export function normalizeAccountHolderName(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[đĐ]/g, "D")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

/** Chuẩn hoá cấu hình người dùng nhập (form) trước khi kiểm/lưu. */
export function normalizeMomoManualConfig(input: { phone: string; accountName: string }): { phone: string; accountName: string } {
  return {
    phone: normalizeVnMobilePhone(input.phone) ?? input.phone.trim(),
    accountName: normalizeAccountHolderName(input.accountName),
  };
}

const momoManualConfigSchema = z.object({
  phone: z.string().refine((value) => normalizeVnMobilePhone(value) === value, "Số điện thoại MoMo không hợp lệ (10 số, bắt đầu bằng 0)."),
  accountName: z
    .string()
    .min(2, "Vui lòng nhập tên chủ ví.")
    .max(70)
    .regex(/^[A-Z0-9 ]+$/, "Tên chủ ví viết HOA không dấu, như trên ngân hàng."),
});
// Bổ sung ADR-059 lần 4: bỏ hẳn "Số tài khoản VietQR của ví" — `z.object` mặc định LOẠI BỎ khoá lạ (strip), nên cấu hình cũ
// còn `vietQrAccountNo` vẫn hợp lệ và trường đó bị bỏ qua.

/**
 * Bổ sung ADR-059 lần 4: MoMo cá nhân KHÔNG có QR — chỉ thông tin để khách tự chuyển trong app MoMo + nút sao chép (nhánh F1).
 * `qr` luôn `null` (giữ trường trong kiểu cho payload cũ đã lưu trên đơn/hoá đơn).
 */
async function createMomoManualCheckout(args: CreateCheckoutArgs<MomoManualConfig>): Promise<CheckoutWalletResult> {
  return {
    kind: "WALLET",
    wallet: "MOMO",
    phone: args.cfg.phone,
    accountName: args.cfg.accountName,
    // Cùng luật MANUAL_QR: nội dung chuyển khoản = mã đơn / mã hoá đơn (đã mang tiền tố).
    content: args.reference,
    amountVnd: args.amountVnd,
    qr: null,
  };
}

/** No webhook — người nhận xác nhận tay theo lịch sử ví (như MANUAL_QR). */
export const momoManualProvider: PaymentProvider<MomoManualConfig> = {
  id: "MOMO_MANUAL",
  validateConfig(input) {
    return momoManualConfigSchema.parse(input);
  },
  createCheckout: createMomoManualCheckout,
  async verifyWebhook() {
    return false;
  },
  parseWebhook() {
    throw new Error("MOMO_MANUAL has no webhook.");
  },
};
