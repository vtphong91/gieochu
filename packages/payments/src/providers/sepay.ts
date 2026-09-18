import { timingSafeEqual, createHmac } from "node:crypto";
import { z } from "zod";
import QRCode from "qrcode";
import { buildVietQrPayload } from "../vietqr";
import type { CreateCheckoutArgs, NormalizedPaymentEvent, PaymentProvider, RawWebhookRequest, SepayConfig } from "../types";

const sepayConfigSchema = z.object({
  bankBin: z.string().regex(/^\d{6}$/, "Mã ngân hàng (BIN) phải gồm 6 chữ số."),
  accountNo: z.string().min(4).max(30),
  accountName: z.string().min(1),
  authType: z.enum(["API_KEY", "HMAC_SHA256"]),
  secret: z.string().min(1),
  paymentPrefix: z.string().min(1),
});

async function createSepayCheckout(args: CreateCheckoutArgs<SepayConfig>) {
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

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * §"M7": header names/format verified against SePay's official webhook docs
 * (Authorization: Apikey <key>; X-SePay-Signature: sha256=<hex>, signing
 * `{timestamp}.{rawBody}` — X-SePay-Timestamp holds the timestamp).
 */
async function verifySepayWebhook(req: RawWebhookRequest, cfg: SepayConfig): Promise<boolean> {
  if (cfg.authType === "API_KEY") {
    const header = req.headers["authorization"] ?? "";
    return safeEqual(header, `Apikey ${cfg.secret}`);
  }

  const signatureHeader = req.headers["x-sepay-signature"] ?? "";
  const timestamp = req.headers["x-sepay-timestamp"] ?? "";
  const expected = `sha256=${createHmac("sha256", cfg.secret).update(`${timestamp}.${req.rawBody}`).digest("hex")}`;
  return safeEqual(signatureHeader, expected);
}

interface SepayWebhookBody {
  id: number | string;
  code?: string | null;
  content?: string;
  transferType: "in" | "out";
  transferAmount: number;
  transactionDate: string;
}

/** Extracts the reference (order/invoice code) using `code` first, then a prefix search in `content` (§"M7"). */
export function extractSepayReference(body: SepayWebhookBody, paymentPrefix: string): string | undefined {
  const prefixPattern = new RegExp(`${paymentPrefix}[A-Z0-9]*`, "i");
  if (body.code) {
    const match = body.code.match(prefixPattern);
    if (match) return match[0].toUpperCase();
  }
  if (body.content) {
    const match = body.content.match(prefixPattern);
    if (match) return match[0].toUpperCase();
  }
  return undefined;
}

// `parseWebhook` matches the shared PaymentProvider interface (body only —
// no cfg), so it cannot know the tenant's paymentPrefix. Callers extract the
// reference separately via extractSepayReference(body, cfg.paymentPrefix).
function parseSepayWebhook(body: unknown): NormalizedPaymentEvent {
  const payload = body as SepayWebhookBody;
  return {
    providerEventId: String(payload.id),
    amountVnd: payload.transferAmount,
    occurredAt: new Date(`${payload.transactionDate.replace(" ", "T")}+07:00`),
    success: payload.transferType === "in",
    raw: body,
  };
}

export const sepayProvider: PaymentProvider<SepayConfig> = {
  id: "SEPAY",
  validateConfig(input) {
    return sepayConfigSchema.parse(input);
  },
  createCheckout: createSepayCheckout,
  verifyWebhook: verifySepayWebhook,
  parseWebhook: parseSepayWebhook,
};
