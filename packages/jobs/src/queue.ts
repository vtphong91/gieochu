import { PgBoss } from "pg-boss";

/**
 * Names of every pg-boss queue in the system (§"M11 — Email và Background
 * Jobs" danh sách job). Grows as later modules add their own jobs.
 */
export const QUEUE_NAMES = {
  EMAIL_SEND: "email.send",
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface JobQueue {
  /** Underlying pg-boss instance, for advanced use (schedule, fetch, etc). */
  readonly boss: PgBoss;
  start(): Promise<void>;
  stop(): Promise<void>;
  ensureQueue(name: QueueName): Promise<void>;
  send<T extends object>(name: QueueName, data: T): Promise<string | null>;
  work<T extends object>(name: QueueName, handler: (data: T) => Promise<void>): Promise<void>;
}

/**
 * pg-boss must connect directly (not through Neon's PgBouncer transaction
 * pooler) since it relies on session-level behavior — pass DIRECT_URL, not
 * DATABASE_URL. See docs/DECISIONS.md ADR-007.
 */
export function createJobQueue(directConnectionString: string): JobQueue {
  const boss = new PgBoss(directConnectionString);

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
    async send(name, data) {
      return boss.send(name, data);
    },
    async work<T extends object>(name: QueueName, handler: (data: T) => Promise<void>) {
      await boss.work<T>(name, async (jobs) => {
        for (const job of jobs) {
          await handler(job.data);
        }
      });
    },
  };
}
