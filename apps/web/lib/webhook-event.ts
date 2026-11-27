import { logger } from "@gieochu/core";
import { withSystemJob } from "@gieochu/db";
import type { PaymentProviderId } from "@gieochu/payments";

/**
 * ADR-074 mục 7: bảng `webhook_events` chống xử lý trùng cho cả hai webhook thanh toán (Platform `/api/webhooks/platform/[provider]`,
 * Tenant `/api/webhooks/tenants/[tenantId]/[provider]`) — mỗi route ghi đúng scope của mình, không chung dòng.
 *
 * Trước đây mọi lỗi khi ghi đều bị coi là "đã xử lý" (200), và một bước lỗi SAU khi ghi (tra tenant, đẩy job, ghi giao dịch) để lại
 * dòng sự kiện → lần gửi lại của cổng bị coi là trùng → mất giao dịch. Nay: chỉ lỗi trùng khoá unique (P2002) mới là "đã xử lý";
 * bước lỗi sau khi ghi thì xoá đúng dòng vừa tạo rồi ném tiếp (route trả 5xx) để cổng gửi lại.
 */
export interface WebhookEventKey {
  scope: "PLATFORM" | "TENANT";
  provider: PaymentProviderId;
  providerEventId: string;
  /** Chỉ scope TENANT. */
  tenantId?: string;
}

export interface RecordedWebhookEvent extends WebhookEventKey {
  id: string;
}

/** Prisma unique violation (P2002) — ở đây chỉ có thể là `@@unique([scope, provider, providerEventId])` của `webhook_events`. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * Ghi sự kiện lần đầu. Trả `null` khi sự kiện đã được ghi trước đó (trùng khoá — idempotent, route trả 200). Lỗi khác (mất kết nối
 * DB…) ném tiếp để route trả 5xx và cổng gửi lại.
 */
export async function recordWebhookEvent(key: WebhookEventKey): Promise<RecordedWebhookEvent | null> {
  try {
    const row = await withSystemJob((tx) =>
      tx.webhookEvent.create({
        data: { scope: key.scope, provider: key.provider, providerEventId: key.providerEventId, tenantId: key.tenantId ?? null },
        select: { id: true },
      }),
    );
    return { ...key, id: row.id };
  } catch (error) {
    if (isUniqueViolation(error)) return null;
    throw error;
  }
}

/**
 * Chạy các bước phải thành công trước khi sự kiện được coi là "đã nhận" (đẩy job / ghi giao dịch). Bước lỗi → xoá đúng dòng
 * `webhook_events` vừa ghi (theo id) rồi ném lại lỗi gốc, để lần gửi lại của cổng được xử lý như lần đầu. Xoá cũng lỗi → log `error`
 * kèm `providerEventId` (lần gửi lại sẽ bị coi là trùng — cần đối soát tay), vẫn ném lỗi gốc.
 */
export async function releaseWebhookEventOnFailure<T>(event: RecordedWebhookEvent, step: () => Promise<T>): Promise<T> {
  try {
    return await step();
  } catch (error) {
    const context = { scope: event.scope, provider: event.provider, providerEventId: event.providerEventId, tenantId: event.tenantId };
    logger.error({ ...context, err: error }, "payment webhook: step after recording the event failed — releasing webhook_events row so the provider retry is processed");
    try {
      await withSystemJob((tx) => tx.webhookEvent.deleteMany({ where: { id: event.id } }));
    } catch (deleteError) {
      logger.error(
        { ...context, webhookEventId: event.id, err: deleteError },
        "payment webhook: could not release webhook_events row — the provider retry will be treated as a duplicate, reconcile manually",
      );
    }
    throw error;
  }
}
