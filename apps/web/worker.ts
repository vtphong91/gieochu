import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createJobQueue, QUEUE_NAMES } from "@gieochu/jobs";
import { createEmailSenderFromEnv, type EmailMessage } from "@gieochu/email";
import { getEnv } from "@gieochu/config";
import { logger } from "@gieochu/core";

async function main() {
  loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

  const env = getEnv();
  const queue = createJobQueue(env.DIRECT_URL);
  const sender = createEmailSenderFromEnv(env);

  await queue.start();
  await queue.ensureQueue(QUEUE_NAMES.EMAIL_SEND);

  await queue.work<EmailMessage>(QUEUE_NAMES.EMAIL_SEND, async (message) => {
    await sender.send(message);
    logger.info({ to: message.to, subject: message.subject }, "email sent");
  });

  logger.info("worker started, listening for jobs");
}

main().catch((error) => {
  logger.error({ err: error }, "worker failed to start");
  process.exit(1);
});
