import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { createJobQueue, QUEUE_NAMES } from "@gieochu/jobs";
import { getEnv } from "@gieochu/config";
import { logger } from "@gieochu/core";
import { runSubscriptionSweep } from "./lib/subscription-sweep";
import { runOrderSweep } from "./lib/order";
import { JOB_HANDLERS } from "./lib/job-handlers";

// Email KHÔNG còn qua hàng đợi/worker — gửi đồng bộ ngay trong Server
// Action/route qua sendEmailNow() (lib/email-dispatch.ts). Quyết định đổi
// hướng: hàng đợi từng khiến email "biến mất" âm thầm nếu quên chạy
// `pnpm worker` (ghi job luôn thành công, không ai xử lý thì cũng không có
// lỗi nào hiện ra) — gửi trực tiếp cho phép thành công/thất bại phản hồi
// ngay cho người dùng. worker.ts vẫn cần chạy cho các job KHÔNG phải email
// (subscription sweep, file scan, payment process, order sweep).
//
// ADR-036: KHÔNG deploy lên Vercel — ở đó job xử lý trong app (lib/job-runner.ts: after() + cron
// /api/cron/daily). File này giữ cho chạy local/server riêng; handler payment/file dùng chung
// lib/job-handlers.ts với job-runner.

async function main() {
  loadEnv({ path: fileURLToPath(new URL("../../.env", import.meta.url)) });

  const env = getEnv();
  const queue = createJobQueue(env.DIRECT_URL);

  await queue.start();
  await queue.ensureQueue(QUEUE_NAMES.SUBSCRIPTION_SWEEP);
  await queue.schedule(QUEUE_NAMES.SUBSCRIPTION_SWEEP, "0 * * * *");
  await queue.ensureQueue(QUEUE_NAMES.FILE_SCAN);
  await queue.ensureQueue(QUEUE_NAMES.PAYMENT_PROCESS);
  await queue.ensureQueue(QUEUE_NAMES.ORDER_SWEEP);
  // Every 5 min, not hourly like subscription.sweep — the order pending TTL (SystemSettings
  // `orderPendingTtlMinutes`, ADR-032, default 60, min 15) is short enough that an hourly cadence could
  // leave an expired order showing PENDING for up to an hour. Jobs read SystemSettings/branding from DB
  // on every run (getSystemSettings()/getEffectiveBrand() — React cache() is a passthrough outside a
  // request), so System Center changes apply without restarting the worker.
  await queue.schedule(QUEUE_NAMES.ORDER_SWEEP, "*/5 * * * *");

  await queue.work<Record<string, never>>(QUEUE_NAMES.SUBSCRIPTION_SWEEP, async () => {
    await runSubscriptionSweep();
    logger.info("subscription sweep ran");
  });

  await queue.work<object>(QUEUE_NAMES.FILE_SCAN, JOB_HANDLERS[QUEUE_NAMES.FILE_SCAN]);

  await queue.work<object>(QUEUE_NAMES.PAYMENT_PROCESS, JOB_HANDLERS[QUEUE_NAMES.PAYMENT_PROCESS]);

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
