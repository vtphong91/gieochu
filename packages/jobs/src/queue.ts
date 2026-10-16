import { PgBoss } from "pg-boss";

/**
 * Names of every pg-boss queue in the system (§"M11 — Email và Background
 * Jobs" danh sách job). Grows as later modules add their own jobs.
 */
export const QUEUE_NAMES = {
  /** §"M3" — hourly sweep: subscription GRACE/EXPIRED transitions, reminder emails, invoice expiry. */
  SUBSCRIPTION_SWEEP: "subscription.sweep",
  /** §"M5" — after `complete`: magic-byte + sha256 check, CLEAN or REJECTED. */
  FILE_SCAN: "file.scan",
  /** §"M8" — heavy webhook work runs here, after the webhook route already answered 200 (§7.4). */
  PAYMENT_PROCESS: "payment.process",
  /** §"M8" — hourly: orders past `expiresAt` move PENDING -> EXPIRED. */
  ORDER_SWEEP: "order.sweep",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

/** A job claimed by `fetch()` — pg-boss has already moved it to `active` (row lock, SKIP LOCKED), so no other fetcher gets it. */
export interface FetchedJob<T> {
  id: string;
  name: string;
  data: T;
}

/** Per-job retry policy, set at `send` time — leaves the queue's own (shared DB) config untouched. */
export interface SendJobOptions {
  retryLimit?: number;
  /** Seconds before a failed job becomes fetchable again (pg-boss queue default is 0 = immediately). */
  retryDelay?: number;
  /** Exponential backoff on top of `retryDelay`. */
  retryBackoff?: boolean;
}

/** Background loops of this pg-boss instance. Both default to true (pg-boss default) — `worker.ts` keeps that. */
export interface JobQueueOptions {
  /** Cron loop: turns rows of `pgboss.schedule` into jobs. ADR-036: off in the web app (nobody consumes sweep jobs there). */
  schedule?: boolean;
  /** Maintenance timer (expire stuck `active` jobs, retention). ADR-036: off in the web app — the daily cron calls `supervise()`. */
  supervise?: boolean;
}

export interface FetchJobsOptions {
  /** Max jobs claimed in one call (pg-boss default 1). */
  batchSize?: number;
}

/** Only the error's name/message go into the job's output column — never the stack or arbitrary props (may carry PII/secrets). */
function toJobFailureOutput(error: unknown): { name: string; message: string } {
  if (error instanceof Error) return { name: error.name, message: error.message };
  return { name: "Error", message: String(error) };
}

export interface JobQueue {
  /** Underlying pg-boss instance, for advanced use (schedule, fetch, etc). */
  readonly boss: PgBoss;
  start(): Promise<void>;
  stop(): Promise<void>;
  ensureQueue(name: QueueName): Promise<void>;
  send<T extends object>(name: QueueName, data: T, options?: SendJobOptions): Promise<string | null>;
  work<T extends object>(name: QueueName, handler: (data: T) => Promise<void>): Promise<void>;
  /** Registers a recurring job (cron, UTC) — idempotent to call on every worker start. */
  schedule(name: QueueName, cron: string): Promise<void>;
  /**
   * ADR-036: claims up to `batchSize` ready jobs (state created/retry) and marks them `active`. The caller MUST
   * settle every returned job with `complete()` or `fail()`; an unsettled job stays `active` until its expiration,
   * then pg-boss maintenance hands it back for retry.
   */
  fetch<T extends object>(name: QueueName, options?: FetchJobsOptions): Promise<FetchedJob<T>[]>;
  complete(name: QueueName, id: string): Promise<void>;
  /** Marks the job failed — pg-boss schedules a retry while `retryLimit` allows, otherwise it ends `failed`. */
  fail(name: QueueName, id: string, error: unknown): Promise<void>;
  /**
   * One on-demand maintenance pass for a queue (works with the timer off): `active` jobs past their expiration go back
   * to retry (or end `failed`), retention deletes old jobs. Never rebuilds indexes (no REINDEX on the shared DB).
   */
  supervise(name: QueueName): Promise<void>;
}

/**
 * pg-boss must connect directly (not through Neon's PgBouncer transaction
 * pooler) since it relies on session-level behavior — pass DIRECT_URL, not
 * DATABASE_URL. See docs/DECISIONS.md ADR-007.
 */
export function createJobQueue(directConnectionString: string, options: JobQueueOptions = {}): JobQueue {
  const boss = new PgBoss({
    connectionString: directConnectionString,
    schedule: options.schedule ?? true,
    supervise: options.supervise ?? true,
  });

  return {
    boss,
    async start() {
      await boss.start();
    },
    async stop() {
      await boss.stop();
    },
    async ensureQueue(name) {
      await boss.createQueue(name);
    },
    async send(name, data, options) {
      return options ? boss.send(name, data, options) : boss.send(name, data);
    },
    async work<T extends object>(name: QueueName, handler: (data: T) => Promise<void>) {
      await boss.work<T>(name, async (jobs) => {
        for (const job of jobs) {
          await handler(job.data);
        }
      });
    },
    async schedule(name, cron) {
      await boss.schedule(name, cron, null, { tz: "UTC" });
    },
    async fetch<T extends object>(name: QueueName, options: FetchJobsOptions = {}) {
      const jobs = await boss.fetch<T>(name, { batchSize: options.batchSize ?? 1 });
      return jobs.map((job) => ({ id: job.id, name: job.name, data: job.data }));
    },
    async complete(name, id) {
      await boss.complete(name, id);
    },
    async fail(name, id, error) {
      await boss.fail(name, id, toJobFailureOutput(error));
    },
    async supervise(name) {
      await boss.supervise(name, { reindex: false });
    },
  };
}
