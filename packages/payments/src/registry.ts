import { manualQrProvider } from "./providers/manual-qr";
import { sepayProvider } from "./providers/sepay";
import { momoProvider } from "./providers/momo";
import type { PaymentProvider, PaymentProviderId, PaymentScope } from "./types";

const PROVIDERS: Record<PaymentProviderId, PaymentProvider<never>> = {
  MANUAL_QR: manualQrProvider as PaymentProvider<never>,
  SEPAY: sepayProvider as PaymentProvider<never>,
  MOMO: momoProvider as PaymentProvider<never>,
};

/**
 * §"M7" "Chọn provider theo scope" — scope itself doesn't change which
 * provider implementation runs (MANUAL_QR/SEPAY/MOMO logic is scope-agnostic);
 * it only changes which config table the caller fetches from
 * (platform_payment_configs vs tenant_payment_configs, done by the caller —
 * see apps/web/lib/tenant-payment.ts).
 */
export function getProvider(id: PaymentProviderId): PaymentProvider<never> {
  const provider = PROVIDERS[id];
  if (!provider) {
    throw new Error(`Unknown payment provider: ${id}`);
  }
  return provider;
}

/**
 * §1.2: webhook path differs by scope even though the provider logic is the
 * same — /api/webhooks/platform/{provider} vs /api/webhooks/tenants/{tenantId}/{provider}.
 */
export function buildWebhookNotifyUrl(appUrl: string, scope: PaymentScope, providerId: PaymentProviderId): string {
  const providerSegment = providerId.toLowerCase();
  const path =
    scope.kind === "PLATFORM"
      ? `/api/webhooks/platform/${providerSegment}`
      : `/api/webhooks/tenants/${scope.tenantId}/${providerSegment}`;
  return `${appUrl}${path}`;
}
