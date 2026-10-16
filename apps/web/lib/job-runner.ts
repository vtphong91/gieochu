import { after } from "next/server";
import { logger } from "@gieochu/core";
import { getStartedQueue } from "./jobs";
import { JOB_HANDLERS, type DrainableQueueName } from "./job-handlers";

export interface DrainQueuesOptions {
  /** Queues drained one after another, in this order, sharing one time budget. */
  names: readonly DrainableQueueName[];
  /**
   * Soft time budget: checked before every fetch — a batch already claimed is always finished
   * (never left `active` until expiry), so the real run time can exceed this by one batch.
   */
  budgetMs: number;
  /** Jobs claimed per fetch. Small on purpose: a claimed batch must be finished inside the function's maxDuration. */
  batchSize?: number;
}

export interface DrainQueuesResult {
  /** Jobs whose handler finished and that were marked `complete`. */
  processed: number;
  /** Jobs whose handler threw and that were marked `fail` (pg-boss retries them while `retryLimit` allows). */
  failed: number;
  /** True when the loop stopped on the time budget rather than on empty queues — jobs may remain. */
  budgetExhausted: boolean;
}

const DEFAULT_BATCH_SIZE = 5;

/**
 * ADR-036: processes queued jobs in-process (no long-lived worker on Vercel). pg-boss `fetch` claims
 * jobs with row locks (SKIP LOCKED), so concurrent drains (several `after()` + the cron) never get the
 * same job. One bad job (eg. tenant no longer exists) is `fail`ed + logged and the loop moves on.
 * Errors talking to the queue itself are logged and end the drain early — never thrown.
 */
export async function drainQueues(options: DrainQueuesOptions): Promise<DrainQueuesResult> {
  const startedAt = Date.now();
  const batchSize = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const result: DrainQueuesResult = { processed: 0, failed: 0, budgetExhausted: false };
  const outOfBudget = () => Date.now() - startedAt >= options.budgetMs;

  try {
    const queue = await getStartedQueue();

    for (const name of options.names) {
      const handler = JOB_HANDLERS[name];
      for (;;) {
        if (outOfBudget()) {
          result.budgetExhausted = true;
          return result;
        }

        const jobs = await queue.fetch<object>(name, { batchSize });
        if (jobs.length === 0) break;

        for (const job of jobs) {
          try {
            await handler(job.data);
          } catch (error) {
            result.failed += 1;
            logger.error({ err: error, queue: name, jobId: job.id }, "job failed");
            try {
              await queue.fail(name, job.id, error);
            } catch (failError) {
              // Job stays `active` until expiry, then pg-boss maintenance retries it.
              logger.error({ err: failError, queue: name, jobId: job.id }, "could not mark job failed");
            }
            continue;
          }

          try {
            await queue.complete(name, job.id);
            result.processed += 1;
          } catch (completeError) {
            // Handler already ran; the job re-runs after expiry — handlers are idempotent
            // (processPaymentEvent: unique transaction + PAID no-op; runFileScan: scanStatus check).
            logger.error({ err: completeError, queue: name, jobId: job.id }, "could not mark job complete");
          }
        }
      }
    }
  } catch (error) {
    logger.error({ err: error, queues: options.names }, "queue drain aborted");
  }

  return result;
}

/**
 * ADR-036: one manual pg-boss maintenance pass per queue (the web app runs pg-boss with the maintenance timer off).
 * Returns `active` jobs past their expiration — eg. a drain cut off by the function timeout — to retry/failed, so the
 * drain that follows can pick them up. Throws on error (the cron wraps it in its own step).
 */
export async function superviseQueues(names: readonly DrainableQueueName[]): Promise<{ queues: number }> {
  const queue = await getStartedQueue();
  for (const name of names) {
    await queue.supervise(name);
  }
  return { queues: names.length };
}

/**
 * Schedules `drainQueues` to run after the current response is sent (`after()` from next/server).
 * Must be called from a route handler / server action. Outside a request scope (eg. a test calling
 * the route function directly) `after()` throws synchronously — that is logged and swallowed, the job
 * stays queued for the next drain (cron). Never throws, so it can't turn a 2xx response into a 500.
 */
export function scheduleQueueDrain(names: readonly DrainableQueueName[], budgetMs = 20_000): void {
  try {
    after(async () => {
      try {
        const summary = await drainQueues({ names, budgetMs });
        logger.info({ queues: names, ...summary }, "after(): queue drain finished");
      } catch (error) {
        logger.error({ err: error, queues: names }, "after(): queue drain failed");
      }
    });
  } catch (error) {
    logger.warn({ err: error, queues: names }, "after() unavailable — job left for the next drain");
  }
}
