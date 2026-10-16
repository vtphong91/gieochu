import { NextResponse } from "next/server";
import { decryptSecret, extractSepayReference, getProvider, type PaymentProviderId } from "@gieochu/payments";
import { logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { withSystemJob } from "@gieochu/db";
import { QUEUE_NAMES } from "@gieochu/jobs";
import { enqueuePaymentProcess } from "../../../../../../lib/jobs";
import { scheduleQueueDrain } from "../../../../../../lib/job-runner";

// ADR-036: after() runs inside this function's lifetime — leave room for the ~20s queue drain.
export const maxDuration = 60;

const VALID_PROVIDERS = new Set<PaymentProviderId>(["MANUAL_QR", "SEPAY", "MOMO"]);

/**
 * §"M7"/§"M8": verifies the signature, records the event for idempotency
 * (webhook_events), then enqueues `payment.process` with the already-parsed
 * event and returns 200 — order matching + `markOrderPaid()` happen in the
 * job, per §7.4 "trả 2xx nhanh rồi xử lý nặng trong job". ADR-036: no long-lived worker on Vercel —
 * the job is drained by `after()` once this 200 has been sent (and by the daily cron as a fallback).
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

  // SePay's parseWebhook can't know the tenant's paymentPrefix (no cfg param on the shared
  // interface) — extract the reference here, with cfg already decrypted above. MoMo's own
  // orderId already comes back as `event.reference` from parseWebhook.
  const reference =
    providerId === "SEPAY"
      ? extractSepayReference(parsedBody as Parameters<typeof extractSepayReference>[0], (cfg as { paymentPrefix: string }).paymentPrefix)
      : event.reference;

  await enqueuePaymentProcess({
    tenantId,
    provider: providerId,
    providerEventId: event.providerEventId,
    reference,
    amountVnd: event.amountVnd,
    success: event.success,
    rawPayload: parsedBody,
  });

  logger.info({ tenantId, provider: providerId, providerEventId: event.providerEventId, reference }, "tenant payment webhook enqueued for processing");

  // Runs after the response — never delays or fails the provider's 2xx (scheduleQueueDrain never throws).
  scheduleQueueDrain([QUEUE_NAMES.PAYMENT_PROCESS]);

  return NextResponse.json({ success: true });
}
