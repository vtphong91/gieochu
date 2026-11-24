import { createJobQueue, QUEUE_NAMES, type JobQueue, type SendJobOptions } from "@gieochu/jobs";
import { getEnv } from "@gieochu/config";
import type { PaymentProviderId } from "@gieochu/payments";

let queue: JobQueue | undefined;
let started: Promise<void> | undefined;

/**
 * Lazy singleton: the first call starts pg-boss and ensures the queue
 * exists. One per Node process / warm serverless instance (ADR-007); on
 * Vercel the same instance also drains the queue right after the response
 * (`lib/job-runner.ts`, ADR-036). A failed start is not cached — the next
 * call retries instead of reusing a rejected promise forever.
 */
export async function getStartedQueue(): Promise<JobQueue> {
  if (!queue) {
    // ADR-036: the web app never runs pg-boss's cron loop (it would turn `pgboss.schedule` rows into order.sweep/
    // subscription.sweep jobs nobody consumes on Vercel) nor its maintenance timer (unreliable in short-lived functions —
    // `/api/cron/daily` calls `supervise()` instead). Only worker.ts keeps both on.
    queue = createJobQueue(getEnv().DIRECT_URL, { schedule: false, supervise: false });
  }
  if (!started) {
    started = queue
      .start()
      .then(() => queue!.ensureQueue(QUEUE_NAMES.FILE_SCAN))
      .then(() => queue!.ensureQueue(QUEUE_NAMES.PAYMENT_PROCESS))
      .catch((error: unknown) => {
        started = undefined;
        throw error;
      });
  }
  await started;
  return queue;
}

/**
 * ADR-036: jobs are drained in a loop (`lib/job-runner.ts`) — with pg-boss's queue default
 * `retryDelay: 0` a failed job is fetchable again at once, so one transient error (DB/S3 hiccup) would
 * burn every retry inside the same drain. A delay + backoff spreads retries over later drains.
 */
const REQUEST_JOB_RETRY: SendJobOptions = { retryDelay: 60, retryBackoff: true };

export interface FileScanJobData {
  productFileId: string;
}

export async function enqueueFileScan(data: FileScanJobData): Promise<void> {
  const q = await getStartedQueue();
  await q.send(QUEUE_NAMES.FILE_SCAN, data, REQUEST_JOB_RETRY);
}

export interface PaymentProcessJobData {
  tenantId: string;
  provider: PaymentProviderId;
  providerEventId: string;
  reference: string | undefined;
  /**
   * ADR-059 bổ sung lần 2 + ADR-065: mọi mã đọc được theo thứ tự ưu tiên (mã thanh toán SePay `paymentRef`, rồi mã đơn) — job
   * chọn mã đầu tiên khớp một đơn (theo `paymentRef` hoặc `code`). Job cũ trong hàng đợi không có trường này → dùng `reference`.
   */
  referenceCandidates?: string[];
  amountVnd: number;
  /** From `NormalizedPaymentEvent.success` — a failed/reversed transfer event never matches an order. */
  success: boolean;
  rawPayload: unknown;
}

export async function enqueuePaymentProcess(data: PaymentProcessJobData): Promise<void> {
  const q = await getStartedQueue();
  await q.send(QUEUE_NAMES.PAYMENT_PROCESS, data, REQUEST_JOB_RETRY);
}
