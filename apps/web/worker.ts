import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createJobQueue, QUEUE_NAMES } from "@gieochu/jobs";
import { createEmailSenderFromEnv, type EmailMessage } from "@gieochu/email";
import { getEnv } from "@gieochu/config";
import { logger } from "@gieochu/core";
import { runSubscriptionSweep } from "./lib/subscription-sweep";
import { runFileScan } from "./lib/file-scan";
import { runOrderSweep } from "./lib/order";
import { processPaymentEvent } from "./lib/payment-process";
import type { FileScanJobData, PaymentProcessJobData } from "./lib/jobs";

async function main() {
  loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

  const env = getEnv();
  const queue = createJobQueue(env.DIRECT_URL);
  const sender = createEmailSenderFromEnv(env);

  await queue.start();
  await queue.ensureQueue(QUEUE_NAMES.EMAIL_SEND);
  await queue.ensureQueue(QUEUE_NAMES.SUBSCRIPTION_SWEEP);
  await queue.schedule(QUEUE_NAMES.SUBSCRIPTION_SWEEP, "0 * * * *");
  await queue.ensureQueue(QUEUE_NAMES.FILE_SCAN);
  await queue.ensureQueue(QUEUE_NAMES.PAYMENT_PROCESS);
  await queue.ensureQueue(QUEUE_NAMES.ORDER_SWEEP);
  // Every 5 min, not hourly like subscription.sweep — ORDER_PENDING_TTL_MINUTES defaults to
  // 60, so an hourly cadence could leave an expired order showing PENDING for up to an hour.
  await queue.schedule(QUEUE_NAMES.ORDER_SWEEP, "*/5 * * * *");

  await queue.work<EmailMessage>(QUEUE_NAMES.EMAIL_SEND, async (message) => {
    await sender.send(message);
    logger.info({ to: message.to, subject: message.subject }, "email sent");
  });

  await queue.work<Record<string, never>>(QUEUE_NAMES.SUBSCRIPTION_SWEEP, async () => {
    await runSubscriptionSweep();
    logger.info("subscription sweep ran");
  });

  await queue.work<FileScanJobData>(QUEUE_NAMES.FILE_SCAN, async (data) => {
    await runFileScan(data.productFileId);
    logger.info({ productFileId: data.productFileId }, "file scan ran");
  });

  await queue.work<PaymentProcessJobData>(QUEUE_NAMES.PAYMENT_PROCESS, async (data) => {
    await processPaymentEvent(data);
    logger.info({ tenantId: data.tenantId, provider: data.provider }, "payment event processed");
  });

  await queue.work<Record<string, never>>(QUEUE_NAMES.ORDER_SWEEP, async () => {
    await runOrderSweep();
    logger.info("order sweep ran");
  });

  logger.info("worker started, listening for jobs");
}

main().catch((error) => {
  logger.error({ err: error }, "worker failed to start");
  process.exit(1);
});
