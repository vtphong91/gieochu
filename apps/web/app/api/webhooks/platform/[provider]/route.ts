import { NextResponse } from "next/server";
import { decryptSecret, getProvider, sepayAccountMatches, type PaymentProviderId } from "@gieochu/payments";
import { logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma, withSystemJob } from "@gieochu/db";
import { markInvoicePaid, sepayInvoiceReferenceCandidates } from "../../../../../lib/subscription-billing";
import { getPlatformPaymentConfigRow } from "../../../../../lib/platform-payment";
import { notifyOwnerOfInvoiceStatus, runAfterResponseOrNow } from "../../../../../lib/payment-status-notify";

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

  // ADR-065: giao dịch của tài khoản ngân hàng KHÁC (cùng tài khoản SePay) — không phải tiền của cổng này. Trả 200 để SePay không
  // gửi lại; không ghi webhook_events/giao dịch.
  if (providerId === "SEPAY" && !sepayAccountMatches(parsedBody, String((cfg as { accountNo?: unknown }).accountNo ?? ""))) {
    logger.warn({ provider: providerId, providerEventId: event.providerEventId }, "platform payment webhook ignored: other bank account");
    return NextResponse.json({ success: true });
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
  // ADR-070 A3/A4 — tới đây chỉ khi `webhook_events` vừa ghi LẦN ĐẦU (lặp lại bị chặn ở trên) → mỗi sự kiện tối đa một email.
  let mismatchInvoiceId: string | null = null;
  let failedInvoiceId: string | null = null;
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
      } else if (invoice && invoice.status !== "PAID" && invoice.status !== "REFUNDED") {
        // A3: đúng mã hoá đơn chưa trả nhưng sai số tiền → báo chủ gian hàng (hoá đơn đã trả/hoàn: không báo).
        mismatchInvoiceId = invoice.id;
      }
    }
  } else if (providerId === "MOMO" && event.reference) {
    // A4: MoMo báo thất bại/huỷ (`resultCode ≠ 0`) cho hoá đơn còn chưa trả → báo chủ gian hàng thanh toán lại.
    const invoice = await prisma.subscriptionInvoice.findUnique({ where: { code: event.reference }, select: { id: true, status: true } });
    if (invoice && (invoice.status === "PENDING" || invoice.status === "EXPIRED")) failedInvoiceId = invoice.id;
  }

  // ADR-059 (B2): ghi giao dịch TRƯỚC khi áp hoá đơn — webhook_events đã ghi nên lần thử lại của cổng bị bỏ qua; nếu áp hoá đơn
  // lỗi giữa chừng, giao dịch vẫn còn (khớp, hoá đơn chưa thanh toán) để admin thấy ở tab "Giao dịch" thay vì mất dấu.
  await prisma.platformPaymentTransaction.create({
    data: { provider: providerId, amountVnd: event.amountVnd, rawPayload: parsedBody as Prisma.InputJsonValue, matchedInvoiceId },
  });
  // ADR-070: email gửi SAU response (không chờ SMTP trong webhook). A1 chỉ lên lịch khi `markInvoicePaid` thật sự áp hoá đơn.
  const deferred: Array<() => Promise<void>> = [];
  if (applyInvoiceId) {
    await markInvoicePaid(applyInvoiceId, { source: "PLATFORM_WEBHOOK", scheduleNotification: (task) => void deferred.push(task) });
  }
  if (mismatchInvoiceId) {
    const invoiceId = mismatchInvoiceId;
    deferred.push(() => notifyOwnerOfInvoiceStatus(invoiceId, "AMOUNT_MISMATCH", { receivedVnd: event.amountVnd }));
  }
  if (failedInvoiceId) {
    const invoiceId = failedInvoiceId;
    deferred.push(() => notifyOwnerOfInvoiceStatus(invoiceId, "PAYMENT_FAILED"));
  }
  await runAfterResponseOrNow(deferred);

  logger.info({ provider: providerId, providerEventId: event.providerEventId, matchedInvoiceId }, "platform payment webhook processed");

  return NextResponse.json({ success: true });
}
