import { createJobQueue, QUEUE_NAMES, type JobQueue } from "@gieochu/jobs";
import { getEnv } from "@gieochu/config";
import type { EmailMessage } from "@gieochu/email";

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
    started = queue.start().then(() => queue!.ensureQueue(QUEUE_NAMES.EMAIL_SEND));
  }
  await started;
  return queue;
}

export async function enqueueEmail(message: EmailMessage): Promise<void> {
  const q = await getStartedQueue();
  await q.send(QUEUE_NAMES.EMAIL_SEND, message);
}
