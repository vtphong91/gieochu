import { AppError, DISPLAY_TIME_ZONE, ErrorCodes, logger } from "@gieochu/core";
import { withSystemJob, type Tx } from "@gieochu/db";

/**
 * ADR-037 (M12b chốt định nghĩa số liệu) — job `stats.aggregate`: tổng hợp `tenant_daily_stats` theo tenant + ngày giờ
 * Việt Nam (`Asia/Ho_Chi_Minh`). Chạy trong cron hằng ngày `/api/cron/daily` (ADR-036), dưới `withSystemJob` (đọc
 * `orders`/`tenant_customers`/`download_events` của mọi tenant — RLS cho phép scope `system_job`).
 *
 * Định nghĩa số liệu (ngày D = ngày giờ VN):
 * - `ordersPaid` / `gmvVnd`: đơn có `paidAt` rơi vào D, KHÔNG lọc trạng thái (GMV gộp — đơn hoàn tiền sau này vẫn tính
 *   vào ngày đã trả; hoàn tiền không trừ ngược). `gmvVnd` = SUM(`totalVnd`) (đã trừ giảm giá), BIGINT.
 * - `newCustomers`: dòng `tenant_customers` được tạo trong D. Bảng này KHÔNG có cột `createdAt`; dòng chỉ được tạo khi
 *   đơn đầu tiên của khách tại tenant chuyển PAID (`lib/order.ts` — upsert cùng lúc đặt `firstOrderAt = paidAt`, các
 *   lần sau giữ nguyên `firstOrderAt`) → dùng `firstOrderAt` làm thời điểm tạo dòng.
 * - `downloads`: dòng `download_events` có `createdAt` trong D.
 *
 * Cột thời gian là TIMESTAMP(3) không múi giờ, lưu UTC → quy đổi bằng `(col AT TIME ZONE 'UTC') AT TIME ZONE '<VN>'`
 * rồi `::date`; không phụ thuộc TimeZone của phiên. Biên lọc tính sẵn bằng UTC để dùng được so sánh trực tiếp.
 *
 * Ngày không có hoạt động: KHÔNG tạo dòng (dashboard coi thiếu = 0). Dòng đã có trong khoảng tính lại nhưng nay không còn
 * hoạt động (vd dữ liệu nguồn bị xoá) được đưa về 0 trong cùng transaction — kết quả luôn khớp nguồn, idempotent.
 *
 * Không lưu email, tên hay mã đơn — chỉ số đếm/tổng (§7.9, đặc tả M12).
 */

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const MS_PER_DAY = 86_400_000;
/** Mỗi transaction tổng hợp tối đa ngần này ngày (giữ dưới timeout transaction tương tác mặc định của Prisma). */
const WINDOW_DAYS = 31;
/** Backfill khi bảng trống: tối đa 400 ngày tính cả hôm nay (ADR-037). */
export const MAX_BACKFILL_DAYS = 400;
const WRITE_CHUNK = 500;
const LOCK_KEY = "stats.aggregate";

export interface TenantDailyStatRow {
  tenantId: string;
  /** YYYY-MM-DD (ngày giờ VN). */
  date: string;
  ordersPaid: number;
  /** BIGINT dạng chuỗi (không mất chính xác khi vượt 2^53). */
  gmvVnd: string;
  newCustomers: number;
  downloads: number;
}

const VN_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Ngày giờ VN của một thời điểm, dạng YYYY-MM-DD. */
export function vnDateString(at: Date): string {
  return VN_DATE_FORMAT.format(at);
}

/** Cộng/trừ ngày trên chuỗi YYYY-MM-DD (lịch thuần, không múi giờ). */
export function addDays(date: string, days: number): string {
  return new Date(Date.parse(`${date}T00:00:00.000Z`) + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Số ngày từ `from` đến `to` (to - from). */
function diffDays(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00.000Z`) - Date.parse(`${from}T00:00:00.000Z`)) / MS_PER_DAY);
}

function assertDate(value: string, field: string): void {
  if (!DATE_RE.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)) || addDays(value, 0) !== value) {
    throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: `${field} không hợp lệ (YYYY-MM-DD)`, httpStatus: 400 });
  }
}

/** Bảng `tenant_daily_stats` chưa tồn tại (code lên trước migration M12b) — P2021 (Prisma) hoặc 42P01 (raw query). */
export function isStatsTableMissing(error: unknown): boolean {
  if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2021") return true;
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /42P01|tenant_daily_stats.*does not exist|does not exist.*tenant_daily_stats/i.test(text);
}

/**
 * SQL tổng hợp từ bảng nguồn cho khoảng ngày VN [fromDate, toDate] — chỉ SELECT, trả 1 dòng cho mỗi (tenant, ngày) có
 * ít nhất 1 hoạt động. `tenantIds` (tuỳ chọn) giới hạn tenant — dùng cho integration test để không ghi đè dòng của
 * tenant khác trên DB dùng chung (ADR-034); cron luôn gọi không lọc.
 */
async function selectAggregates(tx: Tx, fromDate: string, toDate: string, tenantIds: readonly string[] | null) {
  const tz = DISPLAY_TIME_ZONE;
  const filterTenants = tenantIds !== null;
  const ids = tenantIds ? [...tenantIds] : [];
  return tx.$queryRaw<TenantDailyStatRow[]>`
    WITH bounds AS (
      SELECT
        ((${fromDate}::date)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC' AS start_utc,
        ((${toDate}::date + 1)::timestamp AT TIME ZONE ${tz}) AT TIME ZONE 'UTC' AS end_utc
    ),
    paid AS (
      SELECT o."tenantId" AS tenant_id,
             ((o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date AS d,
             COUNT(*)::int AS orders_paid,
             SUM(o."totalVnd")::bigint AS gmv
      FROM "orders" o, bounds b
      WHERE o."paidAt" >= b.start_utc AND o."paidAt" < b.end_utc
        AND (NOT ${filterTenants} OR o."tenantId" = ANY(${ids}::text[]))
      GROUP BY 1, 2
    ),
    customers AS (
      SELECT c."tenantId" AS tenant_id,
             ((c."firstOrderAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date AS d,
             COUNT(*)::int AS n
      FROM "tenant_customers" c, bounds b
      WHERE c."firstOrderAt" >= b.start_utc AND c."firstOrderAt" < b.end_utc
        AND (NOT ${filterTenants} OR c."tenantId" = ANY(${ids}::text[]))
      GROUP BY 1, 2
    ),
    dl AS (
      SELECT e."tenantId" AS tenant_id,
             ((e."createdAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date AS d,
             COUNT(*)::int AS n
      FROM "download_events" e, bounds b
      WHERE e."createdAt" >= b.start_utc AND e."createdAt" < b.end_utc
        AND (NOT ${filterTenants} OR e."tenantId" = ANY(${ids}::text[]))
      GROUP BY 1, 2
    ),
    keys AS (
      SELECT tenant_id, d FROM paid
      UNION SELECT tenant_id, d FROM customers
      UNION SELECT tenant_id, d FROM dl
    )
    SELECT k.tenant_id AS "tenantId",
           to_char(k.d, 'YYYY-MM-DD') AS "date",
           COALESCE(p.orders_paid, 0)::int AS "ordersPaid",
           COALESCE(p.gmv, 0)::text AS "gmvVnd",
           COALESCE(c.n, 0)::int AS "newCustomers",
           COALESCE(x.n, 0)::int AS "downloads"
    FROM keys k
    LEFT JOIN paid p ON p.tenant_id = k.tenant_id AND p.d = k.d
    LEFT JOIN customers c ON c.tenant_id = k.tenant_id AND c.d = k.d
    LEFT JOIN dl x ON x.tenant_id = k.tenant_id AND x.d = k.d
    ORDER BY 2, 1
  `;
}

/** Ghi kết quả của 1 cửa sổ ngày trong transaction hiện tại: đưa dòng cũ trong khoảng về 0, rồi upsert số mới. */
async function writeWindow(
  tx: Tx,
  fromDate: string,
  toDate: string,
  tenantIds: readonly string[] | null,
  rows: readonly TenantDailyStatRow[],
): Promise<void> {
  const filterTenants = tenantIds !== null;
  const ids = tenantIds ? [...tenantIds] : [];
  // Dòng đã có trong khoảng nhưng không còn hoạt động → 0 (dòng còn hoạt động được ghi đè ngay bên dưới, cùng
  // transaction nên nơi đọc không bao giờ thấy trạng thái 0 tạm thời). `now()` quy UTC vì cột không múi giờ.
  await tx.$executeRaw`
    UPDATE "tenant_daily_stats"
    SET "ordersPaid" = 0, "gmvVnd" = 0, "newCustomers" = 0, "downloads" = 0, "updatedAt" = (now() AT TIME ZONE 'UTC')
    WHERE "date" BETWEEN ${fromDate}::date AND ${toDate}::date
      AND (NOT ${filterTenants} OR "tenantId" = ANY(${ids}::text[]))
      AND ("ordersPaid" <> 0 OR "gmvVnd" <> 0 OR "newCustomers" <> 0 OR "downloads" <> 0)
  `;

  for (let i = 0; i < rows.length; i += WRITE_CHUNK) {
    const chunk = rows.slice(i, i + WRITE_CHUNK);
    // 1) Dòng mới: createMany để Prisma sinh id cuid2 (@default(cuid(2))); dòng đã có bị bỏ qua (ON CONFLICT DO NOTHING).
    await tx.tenantDailyStat.createMany({
      data: chunk.map((row) => ({
        tenantId: row.tenantId,
        date: new Date(`${row.date}T00:00:00.000Z`),
        ordersPaid: row.ordersPaid,
        gmvVnd: BigInt(row.gmvVnd),
        newCustomers: row.newCustomers,
        downloads: row.downloads,
      })),
      skipDuplicates: true,
    });
    // 2) Mọi dòng của chunk (cả dòng vừa tạo): ghi đè số liệu theo khoá (tenantId, date) — upsert idempotent.
    await tx.$executeRaw`
      UPDATE "tenant_daily_stats" AS s
      SET "ordersPaid" = v.orders_paid,
          "gmvVnd" = v.gmv,
          "newCustomers" = v.new_customers,
          "downloads" = v.downloads,
          "updatedAt" = (now() AT TIME ZONE 'UTC')
      FROM unnest(
        ${chunk.map((r) => r.tenantId)}::text[],
        ${chunk.map((r) => r.date)}::date[],
        ${chunk.map((r) => r.ordersPaid)}::int[],
        ${chunk.map((r) => r.gmvVnd)}::bigint[],
        ${chunk.map((r) => r.newCustomers)}::int[],
        ${chunk.map((r) => r.downloads)}::int[]
      ) AS v(tenant_id, d, orders_paid, gmv, new_customers, downloads)
      WHERE s."tenantId" = v.tenant_id AND s."date" = v.d
    `;
  }
}

export interface AggregateTenantDailyStatsInput {
  /** Ngày VN đầu khoảng (YYYY-MM-DD), tính cả ngày này. */
  fromDate: string;
  /** Ngày VN cuối khoảng (YYYY-MM-DD), tính cả ngày này. */
  toDate: string;
  /** Chỉ tính các tenant này (integration test). Bỏ trống = mọi tenant (cron). */
  tenantIds?: readonly string[];
}

/**
 * Tính lại `tenant_daily_stats` cho khoảng ngày VN [fromDate, toDate] và upsert. Khoảng dài được chia cửa sổ
 * {@link WINDOW_DAYS} ngày, mỗi cửa sổ 1 transaction `withSystemJob` có advisory lock (2 lần chạy chồng nhau được tuần
 * tự hoá). Trả tổng số dòng (tenant, ngày) có hoạt động đã upsert. Bảng chưa tồn tại → ném lỗi (nơi gọi xử lý).
 */
export async function aggregateTenantDailyStats(input: AggregateTenantDailyStatsInput): Promise<number> {
  assertDate(input.fromDate, "fromDate");
  assertDate(input.toDate, "toDate");
  if (input.fromDate > input.toDate) {
    throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: "fromDate phải ≤ toDate", httpStatus: 400 });
  }
  if (diffDays(input.fromDate, input.toDate) + 1 > MAX_BACKFILL_DAYS) {
    throw new AppError({ code: ErrorCodes.VALIDATION_ERROR, message: `Khoảng tối đa ${MAX_BACKFILL_DAYS} ngày`, httpStatus: 400 });
  }
  const tenantIds = input.tenantIds ? [...new Set(input.tenantIds)] : null;
  if (tenantIds !== null && tenantIds.length === 0) return 0;

  let upserted = 0;
  for (let windowStart = input.fromDate; windowStart <= input.toDate; windowStart = addDays(windowStart, WINDOW_DAYS)) {
    const candidateEnd = addDays(windowStart, WINDOW_DAYS - 1);
    const windowEnd = candidateEnd < input.toDate ? candidateEnd : input.toDate;
    upserted += await withSystemJob(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${LOCK_KEY}))`;
      const rows = await selectAggregates(tx, windowStart, windowEnd, tenantIds);
      await writeWindow(tx, windowStart, windowEnd, tenantIds, rows);
      return rows.length;
    });
  }
  return upserted;
}

export interface StatsAggregationResult {
  /** true khi bảng `tenant_daily_stats` chưa có (code lên trước migration M12b) — bước cron coi là bỏ qua, không lỗi. */
  skipped: boolean;
  /** true khi bảng trống và lần chạy này backfill từ ngày có dữ liệu sớm nhất. */
  backfilled: boolean;
  fromDate: string | null;
  toDate: string | null;
  upserted: number;
}

/** Ngày VN sớm nhất có hoạt động ở bất kỳ nguồn nào; null khi chưa có dữ liệu. */
async function findEarliestActivityDate(tx: Tx): Promise<string | null> {
  const tz = DISPLAY_TIME_ZONE;
  const rows = await tx.$queryRaw<Array<{ earliest: string | null }>>`
    SELECT to_char(((LEAST(
      (SELECT MIN("paidAt") FROM "orders"),
      (SELECT MIN("firstOrderAt") FROM "tenant_customers"),
      (SELECT MIN("createdAt") FROM "download_events")
    ) AT TIME ZONE 'UTC') AT TIME ZONE ${tz})::date, 'YYYY-MM-DD') AS earliest
  `;
  return rows[0]?.earliest ?? null;
}

/**
 * Bước `stats.aggregate` của cron hằng ngày (ADR-037 mục 5): tính lại **hôm qua + hôm nay** theo giờ VN. Bảng trống →
 * backfill từ ngày có dữ liệu sớm nhất (không quá {@link MAX_BACKFILL_DAYS} ngày tính cả hôm nay) đến hôm nay.
 */
export async function runStatsAggregation(now: Date = new Date()): Promise<StatsAggregationResult> {
  const today = vnDateString(now);
  const yesterday = addDays(today, -1);
  try {
    const plan = await withSystemJob(async (tx) => {
      const existing = await tx.$queryRaw<Array<{ present: boolean }>>`
        SELECT EXISTS (SELECT 1 FROM "tenant_daily_stats") AS present
      `;
      if (existing[0]?.present) return { fromDate: yesterday, backfilled: false };
      const earliest = await findEarliestActivityDate(tx);
      const floor = addDays(today, -(MAX_BACKFILL_DAYS - 1));
      if (!earliest || earliest >= yesterday) return { fromDate: yesterday, backfilled: false };
      return { fromDate: earliest < floor ? floor : earliest, backfilled: true };
    });
    const upserted = await aggregateTenantDailyStats({ fromDate: plan.fromDate, toDate: today });
    return { skipped: false, backfilled: plan.backfilled, fromDate: plan.fromDate, toDate: today, upserted };
  } catch (error) {
    if (isStatsTableMissing(error)) {
      logger.warn("stats.aggregate: bảng tenant_daily_stats chưa có (migration M12b chưa áp) — bỏ qua");
      return { skipped: true, backfilled: false, fromDate: null, toDate: null, upserted: 0 };
    }
    throw error;
  }
}
