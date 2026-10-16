import { QUEUE_NAMES } from "@gieochu/jobs";
import { logger } from "@gieochu/core";
import { runFileScan } from "./file-scan";
import { processPaymentEvent } from "./payment-process";
import type { FileScanJobData, PaymentProcessJobData } from "./jobs";

/**
 * ADR-036: the single definition of what each request-born queue does — shared by `worker.ts`
 * (long-lived pg-boss `work`, local/self-hosted only) and `lib/job-runner.ts` (`drainQueues`, run in
 * `after()` and the daily cron on Vercel). No `next/*` import here so `worker.ts` can load it under
 * plain Node. Each handler keeps its own RLS scope: `processPaymentEvent` → `withTenant(data.tenantId)`,
 * `runFileScan` → `withSystemJob` (unchanged from the worker).
 */
export const DRAINABLE_QUEUES = [QUEUE_NAMES.PAYMENT_PROCESS, QUEUE_NAMES.FILE_SCAN] as const;
export type DrainableQueueName = (typeof DRAINABLE_QUEUES)[number];

export const JOB_HANDLERS: { [K in DrainableQueueName]: (data: unknown) => Promise<void> } = {
  [QUEUE_NAMES.PAYMENT_PROCESS]: async (raw) => {
    const data = raw as PaymentProcessJobData;
    await processPaymentEvent(data);
    logger.info({ tenantId: data.tenantId, provider: data.provider }, "payment event processed");
  },
  [QUEUE_NAMES.FILE_SCAN]: async (raw) => {
    const data = raw as FileScanJobData;
    await runFileScan(data.productFileId);
    logger.info({ productFileId: data.productFileId }, "file scan ran");
  },
};
