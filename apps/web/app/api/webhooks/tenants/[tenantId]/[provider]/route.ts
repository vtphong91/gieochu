import { NextResponse } from "next/server";
import { decryptSecret, getProvider, type PaymentProviderId } from "@gieochu/payments";
import { logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { withSystemJob } from "@gieochu/db";

const VALID_PROVIDERS = new Set<PaymentProviderId>(["MANUAL_QR", "SEPAY", "MOMO"]);

/**
 * §"M7": verifies the signature and records the event for idempotency
 * (webhook_events). Matching the event to an Order and marking it PAID is
 * M8's job (no Order model exists yet) — this route intentionally stops
 * after accepting the webhook, per §7.4 "trả 2xx nhanh rồi xử lý nặng trong job".
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; provider: string }> },
) {
  const { tenantId, provider: providerParam } = await params;
  const providerId = providerParam.toUpperCase() as PaymentProviderId;

  if (!VALID_PROVIDERS.has(providerId) || providerId === "MANUAL_QR") {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const configRow = await withSystemJob((tx) =>
    tx.tenantPaymentConfig.findUnique({ where: { tenantId_provider: { tenantId, provider: providerId } } }),
  );
  if (!configRow || !configRow.isEnabled) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }

  const env = getEnv();
  const secrets = JSON.parse(decryptSecret(configRow.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<
    string,
    string
  >;
  const cfg = { ...(configRow.publicConfig as Record<string, unknown>), ...secrets };

  const provider = getProvider(providerId);
  const isValid = await provider.verifyWebhook({ headers, rawBody }, cfg as never);
  if (!isValid) {
    logger.warn({ tenantId, provider: providerId }, "tenant payment webhook rejected: invalid signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let parsedBody: unknown = {};
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    // some providers may post form-encoded bodies; out of scope for M7
  }
  const event = provider.parseWebhook(parsedBody);

  try {
    await withSystemJob((tx) =>
      tx.webhookEvent.create({
        data: { scope: "TENANT", provider: providerId, providerEventId: event.providerEventId, tenantId },
      }),
    );
  } catch {
    // Unique constraint violation => already processed this event (idempotent).
    return NextResponse.json({ success: true });
  }

  logger.info(
    { tenantId, provider: providerId, providerEventId: event.providerEventId },
    "tenant payment webhook accepted (order matching lands in M8)",
  );

  return NextResponse.json({ success: true });
}
