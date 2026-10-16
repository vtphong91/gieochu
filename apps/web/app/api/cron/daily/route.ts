import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError, ErrorCodes, logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { QUEUE_NAMES } from "@gieochu/jobs";
import { getRequestId, handleApiError } from "../../../../lib/api-response";
import { runSubscriptionSweep } from "../../../../lib/subscription-sweep";
import { runOrderSweep } from "../../../../lib/order";
import { drainQueues, superviseQueues, type DrainQueuesResult } from "../../../../lib/job-runner";

// ADR-036: Vercel Cron (Hobby: once a day, vercel.json "0 20 * * *" = 03:00 Asia/Ho_Chi_Minh).
export const maxDuration = 60;
export const dynamic = "force-dynamic";

const QUEUE_DRAIN_BUDGET_MS = 40_000;
const DRAINED_QUEUES = [QUEUE_NAMES.PAYMENT_PROCESS, QUEUE_NAMES.FILE_SCAN] as const;

type StepResult<T> = { ok: true; result: T } | { ok: false };

/** Constant-time compare; a length mismatch is rejected up front (timingSafeEqual throws on unequal lengths). */
function isAuthorized(header: string | null, secret: string): boolean {
  if (!header) return false;
  const given = Buffer.from(header, "utf8");
  const expected = Buffer.from(`Bearer ${secret}`, "utf8");
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

async function runStep<T>(name: string, step: () => Promise<T>): Promise<StepResult<T>> {
  try {
    return { ok: true, result: await step() };
  } catch (error) {
    logger.error({ err: error, step: name }, "cron daily: step failed");
    return { ok: false };
  }
}

/**
 * ADR-036 daily job: subscription sweep, order sweep (both run directly, not via the queue), a pg-boss
 * maintenance pass (stuck `active` jobs back to retry), then a drain of leftover `payment.process`/`file.scan` jobs. Each step is isolated — one failing step never
 * skips the others. The response carries only counts (no tenant/order/customer data, §7.9).
 */
export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const secret = getEnv().CRON_SECRET;
    if (!secret) {
      throw new AppError({ code: "CRON_NOT_CONFIGURED", message: "Cron chưa được cấu hình.", httpStatus: 503 });
    }
    if (!isAuthorized(request.headers.get("authorization"), secret)) {
      throw new AppError({ code: ErrorCodes.UNAUTHORIZED, message: "Không có quyền truy cập", httpStatus: 401 });
    }

    const subscriptionSweep = await runStep("subscription.sweep", async () => {
      await runSubscriptionSweep();
      return {};
    });
    const orderSweep = await runStep("order.sweep", async () => ({ expired: await runOrderSweep() }));
    const queueMaintenance = await runStep("queue.supervise", () => superviseQueues(DRAINED_QUEUES));
    const queues = await runStep<DrainQueuesResult>("queue.drain", () =>
      drainQueues({ names: DRAINED_QUEUES, budgetMs: QUEUE_DRAIN_BUDGET_MS }),
    );

    const results = { subscriptionSweep, orderSweep, queueMaintenance, queues };
    const allOk = subscriptionSweep.ok && orderSweep.ok && queueMaintenance.ok && queues.ok;
    logger.info({ requestId, results }, "cron daily finished");

    if (!allOk) {
      return NextResponse.json(
        {
          error: { code: "CRON_STEP_FAILED", message: "Một hoặc nhiều bước cron thất bại — xem log.", requestId },
          results,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ ok: true, requestId, results });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
