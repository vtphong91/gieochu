/**
 * §1.2: the same provider library serves both Platform (M3) and Tenant (M8)
 * billing, but they never share tables/secrets/routes — every payment
 * function takes this scope explicitly.
 */
export type PaymentScope = { kind: "PLATFORM" } | { kind: "TENANT"; tenantId: string };

export type PaymentProviderId = "MANUAL_QR" | "SEPAY" | "MOMO";

export interface CheckoutQrResult {
  kind: "QR";
  qrPayload: string;
  qrImageDataUrl: string;
  bank: { bin: string; accountNo: string; accountName: string };
  content: string;
}

export interface CheckoutRedirectResult {
  kind: "REDIRECT";
  url: string;
}

export type CheckoutResult = CheckoutQrResult | CheckoutRedirectResult;

export interface NormalizedPaymentEvent {
  providerEventId: string;
  reference?: string;
  amountVnd: number;
  occurredAt: Date;
  success: boolean;
  raw: unknown;
}

/** What a webhook route hands to `verifyWebhook` — raw, pre-parse (§7.4). */
export interface RawWebhookRequest {
  headers: Record<string, string>;
  rawBody: string;
}

export interface TestResult {
  ok: boolean;
  message?: string;
}

export interface CreateCheckoutArgs<TConfig> {
  scope: PaymentScope;
  cfg: TConfig;
  /** order.code or invoice.code */
  reference: string;
  amountVnd: number;
  description: string;
  returnUrl: string;
  notifyUrl: string;
}

export interface PaymentProvider<TConfig = unknown> {
  readonly id: PaymentProviderId;
  validateConfig(input: unknown): TConfig;
  testConnection?(cfg: TConfig): Promise<TestResult>;
  createCheckout(args: CreateCheckoutArgs<TConfig>): Promise<CheckoutResult>;
  verifyWebhook(req: RawWebhookRequest, cfg: TConfig): Promise<boolean>;
  parseWebhook(body: unknown): NormalizedPaymentEvent;
}

export interface ManualQrConfig {
  bankBin: string;
  accountNo: string;
  accountName: string;
}

export interface SepayConfig extends ManualQrConfig {
  authType: "API_KEY" | "HMAC_SHA256";
  secret: string;
  /** matches the tenant's orderCodePrefix (or "SUB" for platform) — §"M7" */
  paymentPrefix: string;
}

export interface MomoConfig {
  partnerCode: string;
  accessKey: string;
  secretKey: string;
  environment: "sandbox" | "production";
}
