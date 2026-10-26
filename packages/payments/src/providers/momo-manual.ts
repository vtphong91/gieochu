import { z } from "zod";
import QRCode from "qrcode";
import { buildVietQrPayload } from "../vietqr";
import type { CheckoutWalletResult, CreateCheckoutArgs, MomoManualConfig, PaymentProvider } from "../types";

/**
 * ADR-059 bổ sung lần 3 — BIN VietQR dùng cho "Số tài khoản nhận VietQR" của ví MoMo.
 *
 * ⚠️ CHỜ KIỂM CHỨNG THẬT: theo tìm hiểu (chưa có nguồn chính thức), QR "Nhận tiền" của MoMo dạng VietQR đi qua BVBank
 * (Ngân hàng Bản Việt) — BIN 970454, số tài khoản riêng của từng ví (dạng `99MM…`). Chủ dự án sẽ giải mã QR MoMo của mình để
 * xác nhận BIN + định dạng (và việc có cần tag 80 hay không) — sửa đúng MỘT chỗ này nếu khác. Không thêm vào `bank_bins` (dữ
 * liệu DB). Chỉ dùng khi người nhận có điền `vietQrAccountNo`; không có thì checkout chỉ hiện thông tin để chuyển tay.
 */
export const MOMO_VIETQR_BIN = "970454";

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

/** Chuẩn hoá cấu hình người dùng nhập (form) trước khi kiểm/lưu. Trường trống của `vietQrAccountNo` → bỏ. */
export function normalizeMomoManualConfig(input: { phone: string; accountName: string; vietQrAccountNo?: string | null }): {
  phone: string;
  accountName: string;
  vietQrAccountNo?: string;
} {
  const vietQrAccountNo = (input.vietQrAccountNo ?? "").replace(/\s+/g, "").toUpperCase();
  return {
    phone: normalizeVnMobilePhone(input.phone) ?? input.phone.trim(),
    accountName: normalizeAccountHolderName(input.accountName),
    ...(vietQrAccountNo ? { vietQrAccountNo } : {}),
  };
}

const momoManualConfigSchema = z.object({
  phone: z.string().refine((value) => normalizeVnMobilePhone(value) === value, "Số điện thoại MoMo không hợp lệ (10 số, bắt đầu bằng 0)."),
  accountName: z
    .string()
    .min(2, "Vui lòng nhập tên chủ ví.")
    .max(70)
    .regex(/^[A-Z0-9 ]+$/, "Tên chủ ví viết HOA không dấu, như trên ngân hàng."),
  vietQrAccountNo: z
    .string()
    .regex(/^[A-Z0-9]{6,30}$/, "Số tài khoản VietQR chỉ gồm chữ/số (6–30 ký tự).")
    .optional(),
});

async function createMomoManualCheckout(args: CreateCheckoutArgs<MomoManualConfig>): Promise<CheckoutWalletResult> {
  let qr: CheckoutWalletResult["qr"] = null;
  if (args.cfg.vietQrAccountNo) {
    const qrPayload = buildVietQrPayload({
      bankBin: MOMO_VIETQR_BIN,
      accountNo: args.cfg.vietQrAccountNo,
      amountVnd: args.amountVnd,
      content: args.reference,
    });
    qr = { qrPayload, qrImageDataUrl: await QRCode.toDataURL(qrPayload), bin: MOMO_VIETQR_BIN, accountNo: args.cfg.vietQrAccountNo };
  }
  return {
    kind: "WALLET",
    wallet: "MOMO",
    phone: args.cfg.phone,
    accountName: args.cfg.accountName,
    // Cùng luật MANUAL_QR: nội dung chuyển khoản = mã đơn / mã hoá đơn (đã mang tiền tố).
    content: args.reference,
    amountVnd: args.amountVnd,
    qr,
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
