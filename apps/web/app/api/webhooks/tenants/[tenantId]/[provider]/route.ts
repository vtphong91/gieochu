import { NextResponse } from "next/server";
import {
  decryptSecret,
  extractSepayPaymentCodes,
  extractSepayReferences,
  getProvider,
  sepayAccountMatches,
  type PaymentProviderId,
  type SepayWebhookBody,
} from "@gieochu/payments";
import { logger, ORDER_CODE_SUFFIX_LENGTH } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withSystemJob } from "@gieochu/db";
import { QUEUE_NAMES } from "@gieochu/jobs";
import { enqueuePaymentProcess } from "../../../../../../lib/jobs";
import { scheduleQueueDrain } from "../../../../../../lib/job-runner";
import { getRequestId, handleApiError } from "../../../../../../lib/api-response";
import { recordWebhookEvent, releaseWebhookEventOnFailure } from "../../../../../../lib/webhook-event";

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
  context: { params: Promise<{ tenantId: string; provider: string }> },
) {
  // ADR-074 mục 7: lỗi không lường trước (DB, giải mã, hàng đợi) → 5xx dạng `{ error: { code, message, requestId } }`, cổng gửi lại.
  const requestId = getRequestId(request);
  try {
    return await handleTenantWebhook(request, context);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}

async function handleTenantWebhook(
  request: Request,
  { params }: { params: Promise<{ tenantId: string; provider: string }> },
): Promise<NextResponse> {
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

  // ADR-059 bổ sung lần 2: body không phải JSON / thiếu trường bắt buộc → 400 + log (trước đây TypeError → 500). Form-encoded
  // vẫn ngoài phạm vi (BACKLOG). Chữ ký đã hợp lệ ở trên nên log được coi là đáng tin để điều tra.
  let parsedBody: unknown;
  let event: ReturnType<typeof provider.parseWebhook>;
  try {
    parsedBody = JSON.parse(rawBody);
    event = provider.parseWebhook(parsedBody);
  } catch (error) {
    logger.warn({ tenantId, provider: providerId, err: error }, "tenant payment webhook rejected: invalid body");
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  // ADR-065: giao dịch của tài khoản ngân hàng KHÁC (cùng tài khoản SePay) — không phải tiền của cổng này. Trả 200 để SePay không
  // gửi lại; không ghi webhook_events/giao dịch.
  if (providerId === "SEPAY" && !sepayAccountMatches(parsedBody, String((cfg as { accountNo?: unknown }).accountNo ?? ""))) {
    logger.warn({ tenantId, provider: providerId, providerEventId: event.providerEventId }, "tenant payment webhook ignored: other bank account");
    return NextResponse.json({ success: true });
  }

  // ADR-074 mục 7: chỉ trùng khoá unique (P2002) mới là "đã xử lý" → 200; lỗi ghi khác ném ra → 5xx, cổng gửi lại.
  const recorded = await recordWebhookEvent({ scope: "TENANT", provider: providerId, providerEventId: event.providerEventId, tenantId });
  if (!recorded) {
    return NextResponse.json({ success: true });
  }

  // ADR-074 mục 7: mọi bước tới khi job được đẩy thành công — lỗi thì xoá đúng dòng webhook_events vừa ghi rồi trả 5xx, để lần
  // gửi lại của cổng không bị coi là trùng (trước đây job mất hẳn).
  const reference = await releaseWebhookEventOnFailure(recorded, async () => {
    // SePay's parseWebhook can't know the tenant's paymentPrefix (no cfg param on the shared interface) — extract the reference
    // here, with cfg already decrypted above. MoMo's own orderId already comes back as `event.reference` from parseWebhook.
    // ADR-065: ưu tiên mã thanh toán (`orders.paymentRef` = tiền tố SePay + 8 chữ số — đúng tiền tố `tenantSepayPrefix` dùng lúc
    // sinh, tức tiền tố cấu hình hoặc tiền tố mã đơn), sau đó mới tới mã đơn (khách tự gõ mã đơn vào nội dung CK).
    let referenceCandidates: string[] = [];
    if (providerId === "SEPAY") {
      const tenant = await getPrismaClient().tenant.findUnique({ where: { id: tenantId }, select: { orderCodePrefix: true } });
      const body = parsedBody as SepayWebhookBody;
      const orderCodePrefix = tenant?.orderCodePrefix ?? "";
      const paymentCodes = extractSepayPaymentCodes(body, [(cfg as { paymentPrefix?: unknown }).paymentPrefix, orderCodePrefix]);
      const orderCodes = orderCodePrefix ? extractSepayReferences(body, [orderCodePrefix], { codeLength: ORDER_CODE_SUFFIX_LENGTH }) : [];
      referenceCandidates = [...new Set([...paymentCodes, ...orderCodes])];
    } else if (event.reference) {
      referenceCandidates = [event.reference];
    }
    const firstReference = referenceCandidates[0];

    await enqueuePaymentProcess({
      tenantId,
      provider: providerId,
      providerEventId: event.providerEventId,
      reference: firstReference,
      referenceCandidates,
      amountVnd: event.amountVnd,
      success: event.success,
      rawPayload: parsedBody,
    });
    return firstReference;
  });

  logger.info({ tenantId, provider: providerId, providerEventId: event.providerEventId, reference }, "tenant payment webhook enqueued for processing");

  // Runs after the response — never delays or fails the provider's 2xx (scheduleQueueDrain never throws).
  scheduleQueueDrain([QUEUE_NAMES.PAYMENT_PROCESS]);

  return NextResponse.json({ success: true });
}
