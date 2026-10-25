import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError, ErrorCodes, logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { QUEUE_NAMES } from "@gieochu/jobs";
import { getRequestId, handleApiError } from "../../../../lib/api-response";
import { runSubscriptionSweep } from "../../../../lib/subscription-sweep";
import { runOrderSweep } from "../../../../lib/order";
import { drainQueues, superviseQueues, type DrainQueuesResult } from "../../../../lib/job-runner";
import { audit } from "../../../../lib/audit";
import { runStatsAggregation } from "../../../../lib/tenant-stats";
import { purgeExpiredAbuseReportIps } from "../../../../lib/abuse-report";
import { purgeStaleRefreshTokens } from "../../../../lib/account-sessions";
import { purgeExpiredDownloadEvents } from "../../../../lib/download";

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
 * maintenance pass (stuck `active` jobs back to retry), the audit-log retention purge (ADR-037, rows > 12 months), the
 * `tenant_daily_stats` aggregation (ADR-037 M12b, yesterday + today in Vietnam time), the abuse-report IP retention
 * (ADR-038, `ip = NULL` on reports > 12 months — reports themselves are kept), the refresh-token purge (ADR-053, rows
 * expired/revoked > 90 days), the download-log purge (ADR-054, `download_events` > 12 months), then a
 * drain of leftover `payment.process`/`file.scan` jobs. Each step is isolated — one failing step never
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
    // ADR-037 mục 3: giữ audit log 12 tháng. Bảng chưa có (trước migration M12a) → { skipped: true }, không lỗi.
    // Chạy trước queue.drain (bước đó dùng phần lớn ngân sách thời gian của route).
    const auditPurge = await runStep("audit.purge", () => audit.purgeExpired());
    // ADR-037 (M12b): tính lại tenant_daily_stats cho hôm qua + hôm nay (giờ VN); bảng trống → backfill ≤ 400 ngày.
    // Bảng chưa có (trước migration M12b) → { skipped: true }, không lỗi. Kết quả chỉ là số đếm (§7.9).
    const statsAggregate = await runStep("stats.aggregate", () => runStatsAggregation());
    // ADR-038 mục 3: xoá IP của báo cáo vi phạm cũ hơn 12 tháng (giữ báo cáo). Bảng chưa có → { skipped: true }.
    const reportIpPurge = await runStep("abuse_report.ip_purge", () => purgeExpiredAbuseReportIps());
    // ADR-053 mục 4: xoá bản ghi phiên hết hạn / đã thu hồi quá 90 ngày.
    const sessionPurge = await runStep("refresh_tokens.purge", () => purgeStaleRefreshTokens());
    // ADR-054 mục 8: xoá nhật ký tải (có IP) cũ hơn 12 tháng — L2, chạy qua withSystemJob.
    const downloadPurge = await runStep("download_events.purge", () => purgeExpiredDownloadEvents());
    const queues = await runStep<DrainQueuesResult>("queue.drain", () =>
      drainQueues({ names: DRAINED_QUEUES, budgetMs: QUEUE_DRAIN_BUDGET_MS }),
    );

    const results = { subscriptionSweep, orderSweep, queueMaintenance, queues, auditPurge, statsAggregate, reportIpPurge, sessionPurge, downloadPurge };
    const allOk =
      subscriptionSweep.ok &&
      orderSweep.ok &&
      queueMaintenance.ok &&
      queues.ok &&
      auditPurge.ok &&
      statsAggregate.ok &&
      reportIpPurge.ok &&
      sessionPurge.ok &&
      downloadPurge.ok;
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
