import { createJobQueue, QUEUE_NAMES, type JobQueue } from "@gieochu/jobs";
import { getEnv } from "@gieochu/config";
import type { PaymentProviderId } from "@gieochu/payments";

let queue: JobQueue | undefined;
let started: Promise<void> | undefined;

/**
 * Lazy singleton: the first call starts pg-boss and ensures the queue
 * exists. Assumes one long-lived Node process (this app's dev/prod server,
 * not a serverless cold-start-per-request deployment) — see ADR-007.
 */
async function getStartedQueue(): Promise<JobQueue> {
  if (!queue) {
    queue = createJobQueue(getEnv().DIRECT_URL);
  }
  if (!started) {
    started = queue
      .start()
      .then(() => queue!.ensureQueue(QUEUE_NAMES.FILE_SCAN))
      .then(() => queue!.ensureQueue(QUEUE_NAMES.PAYMENT_PROCESS));
  }
  await started;
  return queue;
}

export interface FileScanJobData {
  productFileId: string;
}

export async function enqueueFileScan(data: FileScanJobData): Promise<void> {
  const q = await getStartedQueue();
  await q.send(QUEUE_NAMES.FILE_SCAN, data);
}

export interface PaymentProcessJobData {
  tenantId: string;
  provider: PaymentProviderId;
  providerEventId: string;
  reference: string | undefined;
  amountVnd: number;
  /** From `NormalizedPaymentEvent.success` — a failed/reversed transfer event never matches an order. */
  success: boolean;
  rawPayload: unknown;
}

export async function enqueuePaymentProcess(data: PaymentProcessJobData): Promise<void> {
  const q = await getStartedQueue();
  await q.send(QUEUE_NAMES.PAYMENT_PROCESS, data);
}
