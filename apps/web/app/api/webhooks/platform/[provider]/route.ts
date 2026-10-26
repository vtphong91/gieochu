import { NextResponse } from "next/server";
import { decryptSecret, getProvider, type PaymentProviderId } from "@gieochu/payments";
import { logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma, withSystemJob } from "@gieochu/db";
import { markInvoicePaid, sepayInvoiceReferenceCandidates } from "../../../../../lib/subscription-billing";
import { getPlatformPaymentConfigRow } from "../../../../../lib/platform-payment";

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
  const configRow = await getPlatformPaymentConfigRow(providerId);
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

  // ADR-059 bổ sung lần 2: body không phải JSON / thiếu trường bắt buộc → 400 + log (trước đây TypeError → 500).
  let parsedBody: unknown;
  let event: ReturnType<typeof provider.parseWebhook>;
  try {
    parsedBody = JSON.parse(rawBody);
    event = provider.parseWebhook(parsedBody);
  } catch (error) {
    logger.warn({ provider: providerId, err: error }, "platform payment webhook rejected: invalid body");
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

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
  let applyInvoiceId: string | null = null;
  if (event.success) {
    // ADR-059 bổ sung lần 2: thử tiền tố đã cấu hình rồi `SUB` (hoá đơn cũ), đúng độ dài mã hoá đơn; lấy mã đầu tiên có hoá đơn.
    const candidates =
      providerId === "SEPAY" ? sepayInvoiceReferenceCandidates(parsedBody, (cfg as { paymentPrefix?: unknown }).paymentPrefix) : event.reference ? [event.reference] : [];

    if (candidates.length > 0) {
      const found = await prisma.subscriptionInvoice.findMany({ where: { code: { in: candidates } } });
      const invoice = candidates.map((code) => found.find((row) => row.code === code)).find((row) => row !== undefined);
      if (invoice && invoice.amountVnd === event.amountVnd) {
        matchedInvoiceId = invoice.id;
        if (invoice.status === "PENDING") applyInvoiceId = invoice.id;
      }
    }
  }

  // ADR-059 (B2): ghi giao dịch TRƯỚC khi áp hoá đơn — webhook_events đã ghi nên lần thử lại của cổng bị bỏ qua; nếu áp hoá đơn
  // lỗi giữa chừng, giao dịch vẫn còn (khớp, hoá đơn chưa thanh toán) để admin thấy ở tab "Giao dịch" thay vì mất dấu.
  await prisma.platformPaymentTransaction.create({
    data: { provider: providerId, amountVnd: event.amountVnd, rawPayload: parsedBody as Prisma.InputJsonValue, matchedInvoiceId },
  });
  if (applyInvoiceId) await markInvoicePaid(applyInvoiceId);

  logger.info({ provider: providerId, providerEventId: event.providerEventId, matchedInvoiceId }, "platform payment webhook processed");

  return NextResponse.json({ success: true });
}
