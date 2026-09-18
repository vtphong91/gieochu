import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type {
  CreateCheckoutArgs,
  MomoConfig,
  NormalizedPaymentEvent,
  PaymentProvider,
  RawWebhookRequest,
  TestResult,
} from "../types";

const momoConfigSchema = z.object({
  partnerCode: z.string().min(1),
  accessKey: z.string().min(1),
  secretKey: z.string().min(1),
  environment: z.enum(["sandbox", "production"]),
});

function endpointFor(environment: MomoConfig["environment"], path: "create" | "query"): string {
  const host = environment === "production" ? "https://payment.momo.vn" : "https://test-payment.momo.vn";
  return `${host}/v2/gateway/api/${path}`;
}

/**
 * Raw signature field order verified against MoMo's official sample code
 * (github.com/momo-wallet/payment) — alphabetical key order, joined with "&".
 */
export function buildMomoCreateSignature(
  cfg: Pick<MomoConfig, "accessKey" | "partnerCode" | "secretKey">,
  params: {
    amount: number;
    extraData: string;
    ipnUrl: string;
    orderId: string;
    orderInfo: string;
    redirectUrl: string;
    requestId: string;
    requestType: string;
  },
): string {
  const raw =
    `accessKey=${cfg.accessKey}` +
    `&amount=${params.amount}` +
    `&extraData=${params.extraData}` +
    `&ipnUrl=${params.ipnUrl}` +
    `&orderId=${params.orderId}` +
    `&orderInfo=${params.orderInfo}` +
    `&partnerCode=${cfg.partnerCode}` +
    `&redirectUrl=${params.redirectUrl}` +
    `&requestId=${params.requestId}` +
    `&requestType=${params.requestType}`;
  return createHmac("sha256", cfg.secretKey).update(raw).digest("hex");
}

/** Same field set MoMo sends back in the IPN, alphabetically ordered (per official sample code). */
export function buildMomoIpnSignature(
  secretKey: string,
  params: {
    accessKey: string;
    amount: number | string;
    extraData: string;
    message: string;
    orderId: string;
    orderInfo: string;
    orderType: string;
    partnerCode: string;
    payType: string;
    requestId: string;
    responseTime: number | string;
    resultCode: number | string;
    transId: number | string;
  },
): string {
  const raw =
    `accessKey=${params.accessKey}` +
    `&amount=${params.amount}` +
    `&extraData=${params.extraData}` +
    `&message=${params.message}` +
    `&orderId=${params.orderId}` +
    `&orderInfo=${params.orderInfo}` +
    `&orderType=${params.orderType}` +
    `&partnerCode=${params.partnerCode}` +
    `&payType=${params.payType}` +
    `&requestId=${params.requestId}` +
    `&responseTime=${params.responseTime}` +
    `&resultCode=${params.resultCode}` +
    `&transId=${params.transId}`;
  return createHmac("sha256", secretKey).update(raw).digest("hex");
}

async function createMomoCheckout(args: CreateCheckoutArgs<MomoConfig>) {
  const requestId = `${args.reference}-${Date.now()}`;
  const extraData = "";
  const requestType = "captureWallet";

  const signature = buildMomoCreateSignature(args.cfg, {
    amount: args.amountVnd,
    extraData,
    ipnUrl: args.notifyUrl,
    orderId: args.reference,
    orderInfo: args.description,
    redirectUrl: args.returnUrl,
    requestId,
    requestType,
  });

  const response = await fetch(endpointFor(args.cfg.environment, "create"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      partnerCode: args.cfg.partnerCode,
      accessKey: args.cfg.accessKey,
      requestId,
      amount: args.amountVnd,
      orderId: args.reference,
      orderInfo: args.description,
      redirectUrl: args.returnUrl,
      ipnUrl: args.notifyUrl,
      extraData,
      requestType,
      signature,
      lang: "vi",
    }),
  });

  const body = (await response.json()) as { payUrl?: string; message?: string };
  if (!body.payUrl) {
    throw new Error(`MoMo createCheckout failed: ${body.message ?? "no payUrl returned"}`);
  }
  return { kind: "REDIRECT" as const, url: body.payUrl };
}

async function verifyMomoWebhook(req: RawWebhookRequest, cfg: MomoConfig): Promise<boolean> {
  let body: Record<string, unknown>;
  try {
    body = JSON.parse(req.rawBody);
  } catch {
    return false;
  }
  const signature = String(body.signature ?? "");
  const expected = buildMomoIpnSignature(cfg.secretKey, {
    accessKey: cfg.accessKey,
    amount: String(body.amount ?? ""),
    extraData: String(body.extraData ?? ""),
    message: String(body.message ?? ""),
    orderId: String(body.orderId ?? ""),
    orderInfo: String(body.orderInfo ?? ""),
    orderType: String(body.orderType ?? ""),
    partnerCode: String(body.partnerCode ?? ""),
    payType: String(body.payType ?? ""),
    requestId: String(body.requestId ?? ""),
    responseTime: String(body.responseTime ?? ""),
    resultCode: String(body.resultCode ?? ""),
    transId: String(body.transId ?? ""),
  });

  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function parseMomoWebhook(body: unknown): NormalizedPaymentEvent {
  const payload = body as {
    transId: number | string;
    orderId: string;
    amount: number;
    resultCode: number;
    responseTime: number;
  };
  return {
    providerEventId: String(payload.transId),
    reference: payload.orderId,
    amountVnd: payload.amount,
    occurredAt: new Date(payload.responseTime),
    success: payload.resultCode === 0,
    raw: body,
  };
}

async function testMomoConnection(cfg: MomoConfig): Promise<TestResult> {
  const requestId = `test-${Date.now()}`;
  const orderId = `test-${Date.now()}`;
  const signature = createHmac("sha256", cfg.secretKey)
    .update(`accessKey=${cfg.accessKey}&orderId=${orderId}&partnerCode=${cfg.partnerCode}&requestId=${requestId}`)
    .digest("hex");

  try {
    const response = await fetch(endpointFor(cfg.environment, "query"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ partnerCode: cfg.partnerCode, accessKey: cfg.accessKey, requestId, orderId, signature, lang: "vi" }),
    });
    const body = (await response.json()) as { resultCode?: number; message?: string };
    // A "transaction not found" style response still proves the credentials
    // and connection are valid — see §"M7".
    if (typeof body.resultCode === "number") {
      return { ok: true, message: body.message };
    }
    return { ok: false, message: "Phản hồi không hợp lệ từ MoMo." };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không kết nối được tới MoMo." };
  }
}

export const momoProvider: PaymentProvider<MomoConfig> = {
  id: "MOMO",
  validateConfig(input) {
    return momoConfigSchema.parse(input);
  },
  testConnection: testMomoConnection,
  createCheckout: createMomoCheckout,
  verifyWebhook: verifyMomoWebhook,
  parseWebhook: parseMomoWebhook,
};
