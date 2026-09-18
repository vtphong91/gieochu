import { z } from "zod";
import QRCode from "qrcode";
import { buildVietQrPayload } from "../vietqr";
import type { CreateCheckoutArgs, ManualQrConfig, PaymentProvider } from "../types";

const manualQrConfigSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng (BIN) phải gồm 6 chữ số."),
  accountNo: z.string().min(4).max(30),
  accountName: z.string().min(1),
});

async function createManualQrCheckout(args: CreateCheckoutArgs<ManualQrConfig>) {
  const qrPayload = buildVietQrPayload({
    bankBin: args.cfg.bankBin,
    accountNo: args.cfg.accountNo,
    amountVnd: args.amountVnd,
    content: args.reference,
  });
  const qrImageDataUrl = await QRCode.toDataURL(qrPayload);
  return {
    kind: "QR" as const,
    qrPayload,
    qrImageDataUrl,
    bank: { bin: args.cfg.bankBin, accountNo: args.cfg.accountNo, accountName: args.cfg.accountName },
    content: args.reference,
  };
}

/** No webhook — owner confirms payment manually (§"M7"). */
export const manualQrProvider: PaymentProvider<ManualQrConfig> = {
  id: "MANUAL_QR",
  validateConfig(input) {
    return manualQrConfigSchema.parse(input);
  },
  createCheckout: createManualQrCheckout,
  async verifyWebhook() {
    return false;
  },
  parseWebhook() {
    throw new Error("MANUAL_QR has no webhook.");
  },
};
