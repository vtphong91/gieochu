import { NextResponse } from "next/server";
import { decryptSecret, extractSepayReference, getProvider, type PaymentProviderId } from "@gieochu/payments";
import { logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma, withSystemJob } from "@gieochu/db";
import { markInvoicePaid } from "../../../../../lib/subscription-billing";

const VALID_PROVIDERS = new Set<PaymentProviderId>(["SEPAY", "MOMO"]);

/**
 * §"M3" webhook sequence diagram. Always records a `platform_payment_transactions`
 * row for a signature-valid event (matched or not — "lệch số tiền hoặc
 * không tìm thấy → lưu UNMATCHED để admin xử lý"), and always answers 200 on
 * a valid signature (only a bad signature gets 401, same as M7 — avoids
 * retry storms from the provider on data mismatches that aren't auth errors).
 */
export async function POST(request: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider: providerParam } = await params;
  const providerId = providerParam.toUpperCase() as PaymentProviderId;

  if (!VALID_PROVIDERS.has(providerId)) {
    return NextResponse.json({ error: "unsupported_provider" }, { status: 404 });
  }

  const rawBody = await request.text();
  const headers: Record<string, string> = {};
  request.headers.forEach((value, key) => {
    headers[key.toLowerCase()] = value;
  });

  const prisma = getPrismaClient();
  const configRow = await prisma.platformPaymentConfig.findUnique({ where: { provider: providerId } });
  if (!configRow || !configRow.isEnabled) {
    return NextResponse.json({ error: "not_configured" }, { status: 404 });
  }

  const env = getEnv();
  const secrets = JSON.parse(decryptSecret(configRow.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>;
  const cfg = { ...(configRow.publicConfig as Record<string, unknown>), ...secrets };

  const provider = getProvider(providerId);
  const isValid = await provider.verifyWebhook({ headers, rawBody }, cfg as never);
  if (!isValid) {
    logger.warn({ provider: providerId }, "platform payment webhook rejected: invalid signature");
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let parsedBody: unknown = {};
  try {
    parsedBody = JSON.parse(rawBody);
  } catch {
    // some providers may post form-encoded bodies; out of scope for M3
  }
  const event = provider.parseWebhook(parsedBody);

  try {
    await withSystemJob((tx) =>
      tx.webhookEvent.create({
        data: { scope: "PLATFORM", provider: providerId, providerEventId: event.providerEventId },
      }),
    );
  } catch {
    // Unique constraint violation => already processed this event (idempotent).
    return NextResponse.json({ success: true });
  }

  let matchedInvoiceId: string | null = null;
  if (event.success) {
    const referenceCode =
      providerId === "SEPAY"
        ? extractSepayReference(parsedBody as Parameters<typeof extractSepayReference>[0], String((cfg as { paymentPrefix?: string }).paymentPrefix ?? "SUB"))
        : event.reference;

    if (referenceCode) {
      const invoice = await prisma.subscriptionInvoice.findUnique({ where: { code: referenceCode } });
      if (invoice && invoice.amountVnd === event.amountVnd) {
        matchedInvoiceId = invoice.id;
        if (invoice.status === "PENDING") {
          await markInvoicePaid(invoice.id);
        }
      }
    }
  }

  await prisma.platformPaymentTransaction.create({
    data: { provider: providerId, amountVnd: event.amountVnd, rawPayload: parsedBody as Prisma.InputJsonValue, matchedInvoiceId },
  });

  logger.info({ provider: providerId, providerEventId: event.providerEventId, matchedInvoiceId }, "platform payment webhook processed");

  return NextResponse.json({ success: true });
}
