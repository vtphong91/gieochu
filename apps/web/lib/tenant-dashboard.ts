import {
  AppError,
  DISPLAY_TIME_ZONE,
  ErrorCodes,
  listDashboardBuckets,
  REMEDY_REFUND_SLA_DAYS,
  type DashboardGranularity,
  type DashboardPreset,
  type DashboardRange,
} from "@gieochu/core";
import { withTenant, type Tx } from "@gieochu/db";

/**
 * ADR-043 — số liệu dashboard Tổng quan gian hàng (`/studio/{slug}`), GĐ1 (dữ liệu). UI là GĐ2 (Phong).
 *
 * TIỀN ĐIỀU KIỆN: nơi gọi đã `requireTenantMember(slug)` với vai trò OWNER (trang dùng `requireTenantMemberPage`) và
 * truyền `tenant.id` lấy từ kết quả đó — KHÔNG lấy `tenantId` từ URL/query. Mọi truy vấn chạy trong MỘT transaction
 * `withTenant` (RLS L2 là lớp phòng thủ thứ hai, kèm điều kiện `"tenantId" = $1` tường minh để dùng index). Bảng L1 duy
 * nhất được đọc là `user_profiles` (họ tên khách trong bảng 10 đơn mới nhất, ADR-043 mục 3). Không đọc
 * `tenant_daily_stats` (L1 không RLS — ADR-043 mục 6).
 *
 * Định nghĩa (kỳ hiện tại `[start, end)`, kỳ trước `[prevStart, prevEnd)` — xem `resolveDashboardRange`, `@gieochu/core`):
 * - "Đơn đã thanh toán trong kỳ" = đơn có `paidAt` trong kỳ VÀ `totalVnd > 0`, MỌI trạng thái (gồm đơn sau này REFUNDED).
 *   Bổ sung ADR-043: đơn 0đ (nhận tài liệu miễn phí) KHÔNG tính vào gross/net/refunded, paidOrders, avgOrderVnd,
 *   distinctProductsSold, buyers/returning*, series — đếm riêng ở `sales.freeClaims` (`paidAt` trong kỳ, `totalVnd = 0`).
 * - `grossRevenueVnd` (doanh thu gộp) = Σ `totalVnd` (đã trừ giảm giá) của các đơn đó — cùng định nghĩa GMV ADR-037.
 * - `refundedVnd` = Σ `totalVnd` của các đơn đó hiện có `status = REFUNDED` — tính theo NGÀY KHÁCH TRẢ TIỀN (ADR-043 mục 1;
 *   `orders` không có `refundedAt`). `netRevenueVnd` = gross − refunded.
 * - `avgOrderVnd` = ⌊gross ÷ paidOrders⌋ (null khi 0 đơn).
 * - `distinctProductsSold` = số `productId` khác nhau trong `order_items` của các đơn đó.
 * - `newCustomers` = `tenant_customers.firstOrderAt` trong kỳ (cùng ADR-037 / `tenant_daily_stats`). LƯU Ý: dòng
 *   `tenant_customers` được tạo cả khi đơn đầu tiên là đơn 0đ, nên khách chỉ nhận tài liệu miễn phí VẪN tính là khách mới
 *   — giữ nguyên định nghĩa để khớp System Center (Bổ sung ADR-043).
 * - `buyers` = số khách khác nhau có đơn đã thanh toán trong kỳ. `returningCustomers` = trong số đó, khách có ≥ 2 đơn đã
 *   thanh toán (`paidAt` khác null, `totalVnd > 0`, mọi trạng thái kể cả đã hoàn) tại gian hàng tính tới HẾT KỲ (`paidAt < end`) — tức gồm
 *   cả đơn trước kỳ. `returningCustomerRate` = returning ÷ buyers (0–1, null khi buyers = 0). Kỳ trước tính tương tự
 *   với `prevEnd`.
 * - Đánh giá: `newReviews` = `createdAt` trong kỳ, mọi trạng thái. `avgRating`/`distribution` chỉ đánh giá VISIBLE tạo
 *   trong kỳ (ADR-043 mục 4). `hiddenInPeriod` = đang HIDDEN và `hiddenAt` trong kỳ. `unanswered`, `hiddenTotal`,
 *   `moderationLocked` là ảnh chụp hiện tại.
 * - Tài liệu: số theo trạng thái là ảnh chụp hiện tại; `downloads` = `download_events.createdAt` trong kỳ; top bán chạy =
 *   số đơn có `paidAt` trong kỳ, LOẠI đơn REFUNDED (Bổ sung ADR-043; vẫn gồm đơn 0đ) theo sản phẩm, rồi doanh thu dòng (`finalPriceVnd`); top đánh
 *   giá = cache `ratingSum/ratingCount` luỹ kế (chỉ VISIBLE), tối thiểu {@link TOP_RATED_MIN_REVIEWS} đánh giá.
 * - `pendingOrders` (PENDING chưa quá `expiresAt`, ADR-036) và `refundRequests` (ADR-039) là ảnh chụp hiện tại.
 *
 * Tiền: SUM trong SQL là BIGINT, trả về `number` nguyên VND — an toàn tới 2^53−1 ≈ 9 triệu tỷ đồng/kỳ/gian hàng; vượt
 * ngưỡng (không thực tế) → ném lỗi thay vì trả số sai.
 *
 * Cache: KHÔNG. Dữ liệu riêng từng gian hàng, chủ gian hàng cần thấy đúng ngay sau khi xác nhận/hoàn đơn; số lượt mở
 * trang thấp (chỉ OWNER) và chỉ 3 truy vấn tổng hợp + 2 `set_config` trong 1 transaction. `generatedAt` = lúc tính.
 */

export const TOP_SELLING_LIMIT = 5;
export const TOP_RATED_LIMIT = 5;
/** ADR-043 (Q9): sản phẩm cần ít nhất ngần này đánh giá đang hiển thị mới vào "top đánh giá". */
export const TOP_RATED_MIN_REVIEWS = 3;
export const LATEST_ORDERS_LIMIT = 10;
/** Nhãn thay họ tên khi khách chưa có hồ sơ (`user_profiles`). */
export const ANONYMOUS_CUSTOMER_LABEL = "Khách";

/** Một chỉ số theo kỳ: giá trị kỳ hiện tại + kỳ so sánh (UI tự tính %). */
export interface DashboardCompared<T = number> {
  current: T;
  previous: T;
}

export interface TenantDashboardRangeView {
  key: DashboardPreset;
  label: string;
  prevLabel: string;
  /** ISO-8601 UTC. */
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  granularity: DashboardGranularity;
  customFrom: string | null;
  customTo: string | null;
  /** `YYYY-MM-DD` giờ VN — ngày đầu / ngày cuối bao gồm của kỳ (ADR-043 lần 3, cho ô `dd/mm/yyyy - dd/mm/yyyy`). */
  displayFrom: string;
  displayTo: string;
  invalid: boolean;
}

export interface TenantDashboardSales {
  grossRevenueVnd: DashboardCompared;
  netRevenueVnd: DashboardCompared;
  refundedVnd: DashboardCompared;
  refundedOrders: DashboardCompared;
  paidOrders: DashboardCompared;
  avgOrderVnd: DashboardCompared<number | null>;
  distinctProductsSold: DashboardCompared;
  /** Bổ sung ADR-043: số đơn 0đ (nhận tài liệu miễn phí) có `paidAt` trong kỳ — không tính vào các chỉ số bán hàng khác. */
  freeClaims: DashboardCompared;
  /** Ảnh chụp hiện tại. */
  pendingOrders: number;
  /** Ảnh chụp hiện tại (ADR-039): REFUND_REQUESTED, và số quá hạn {@link REMEDY_REFUND_SLA_DAYS} ngày. */
  refundRequests: { pending: number; overdue: number };
}

export interface TenantDashboardCustomers {
  newCustomers: DashboardCompared;
  buyers: DashboardCompared;
  returningCustomers: DashboardCompared;
  /** 0–1; null khi `buyers = 0`. */
  returningCustomerRate: DashboardCompared<number | null>;
}

export interface TenantDashboardReviews {
  newReviews: DashboardCompared;
  /** Trung bình 1 chữ số thập phân; null khi không có đánh giá VISIBLE trong kỳ. */
  avgRating: DashboardCompared<number | null>;
  /** Số đánh giá VISIBLE trong kỳ theo sao: index 0 = 1 sao … index 4 = 5 sao. */
  distribution: [number, number, number, number, number];
  hiddenInPeriod: DashboardCompared;
  /** Ảnh chụp hiện tại. */
  unanswered: number;
  hiddenTotal: number;
  moderationLocked: number;
}

export interface TenantDashboardTopSelling {
  productId: string;
  /** Tên hiện tại của sản phẩm. */
  title: string;
  /** Số đơn đã thanh toán trong kỳ có sản phẩm này. */
  orders: number;
  revenueVnd: number;
  /** `products.soldCount` — luỹ kế (ADR-033), hiện kèm nhãn "từ trước tới nay". */
  soldAllTime: number;
}

export interface TenantDashboardTopRated {
  productId: string;
  title: string;
  /** 1 chữ số thập phân. */
  avgRating: number;
  reviewCount: number;
}

export interface TenantDashboardProducts {
  /** Ảnh chụp hiện tại. `moderationLocked` đếm riêng (sản phẩm khoá vẫn nằm trong một trong 3 trạng thái). */
  published: number;
  draft: number;
  archived: number;
  moderationLocked: number;
  downloads: DashboardCompared;
  topSelling: TenantDashboardTopSelling[];
  topRated: TenantDashboardTopRated[];
}

export interface TenantDashboardSeriesPoint {
  /** Giờ VN `YYYY-MM-DDTHH:MM` đầu bucket. */
  key: string;
  /** ISO-8601 UTC đầu bucket. */
  start: string;
  /** "14:00" · "18/10" · "10/2026". */
  label: string;
  /** Bucket chưa tới (vd giờ sau thời điểm hiện tại với "Hôm nay") — giá trị luôn 0, UI nên để trống. */
  future: boolean;
  grossRevenueVnd: number;
  netRevenueVnd: number;
  paidOrders: number;
}

export interface TenantDashboardLatestOrder {
  id: string;
  code: string;
  /** Họ tên khách (`user_profiles.fullName`), hoặc {@link ANONYMOUS_CUSTOMER_LABEL}. KHÔNG có email (ADR-043 mục 3). */
  customerFullName: string;
  /** Đơn giá dòng đầu tiên của đơn (mỗi đơn 1 sản phẩm). 0 nếu đơn không có dòng. */
  unitPriceVnd: number;
  totalVnd: number;
}

export interface TenantDashboard {
  range: TenantDashboardRangeView;
  /** ISO-8601 UTC — "Cập nhật lúc". */
  generatedAt: string;
  sales: TenantDashboardSales;
  customers: TenantDashboardCustomers;
  reviews: TenantDashboardReviews;
  products: TenantDashboardProducts;
  /** Đủ bucket theo `range.granularity`, cũ → mới; bucket không có đơn = 0. */
  series: TenantDashboardSeriesPoint[];
  /** 10 đơn mới nhất theo `createdAt`, mọi trạng thái, KHÔNG lọc theo kỳ. */
  latestOrders: TenantDashboardLatestOrder[];
}

const DAY_MS = 86_400_000;

/** BIGINT/NUMERIC dạng chuỗi → số nguyên an toàn. */
function toInt(value: string | number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new AppError({ code: ErrorCodes.INTERNAL_ERROR, message: "Số liệu vượt giới hạn hiển thị.", httpStatus: 500 });
  }
  return n;
}

function round1(value: number | string | null): number | null {
  if (value === null) return null;
  return Math.round(Number(value) * 10) / 10;
}

function ratio(part: number, whole: number): number | null {
  return whole > 0 ? part / whole : null;
}

interface MetricsRow {
  free_cur: number;
  free_prev: number;
  gross_cur: string;
  gross_prev: string;
  refunded_cur: string;
  refunded_prev: string;
  refunded_orders_cur: number;
  refunded_orders_prev: number;
  paid_cur: number;
  paid_prev: number;
  buyers_cur: number;
  buyers_prev: number;
  products_cur: number;
  products_prev: number;
  returning_cur: number;
  returning_prev: number;
  new_customers_cur: number;
  new_customers_prev: number;
  pending_orders: number;
  refund_pending: number;
  refund_overdue: number;
  reviews_new_cur: number;
  reviews_new_prev: number;
  reviews_avg_cur: number | null;
  reviews_avg_prev: number | null;
  r1: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
  reviews_unanswered: number;
  reviews_hidden_cur: number;
  reviews_hidden_prev: number;
  reviews_hidden_total: number;
  reviews_locked: number;
  products_published: number;
  products_draft: number;
  products_archived: number;
  products_locked: number;
  downloads_cur: number;
  downloads_prev: number;
}

interface Bounds {
  tenantId: string;
  start: string;
  end: string;
  prevStart: string;
  prevEnd: string;
  now: string;
  overdueBefore: string;
}

/** Truy vấn 1: mọi chỉ số tổng (kỳ hiện tại + kỳ trước + ảnh chụp) trong một câu SELECT. */
async function selectMetrics(tx: Tx, b: Bounds): Promise<MetricsRow> {
  const rows = await tx.$queryRaw<MetricsRow[]>`
    WITH b AS (
      SELECT (${b.start}::timestamptz AT TIME ZONE 'UTC') AS s,
             (${b.end}::timestamptz AT TIME ZONE 'UTC') AS e,
             (${b.prevStart}::timestamptz AT TIME ZONE 'UTC') AS ps,
             (${b.prevEnd}::timestamptz AT TIME ZONE 'UTC') AS pe,
             (${b.now}::timestamptz AT TIME ZONE 'UTC') AS n,
             (${b.overdueBefore}::timestamptz AT TIME ZONE 'UTC') AS od
    ),
    paid AS (
      SELECT o."id", o."customerId", o."totalVnd", (o."status" = 'REFUNDED') AS refunded,
             (o."paidAt" >= b.s AND o."paidAt" < b.e) AS cur, (o."totalVnd" = 0) AS free
      FROM "orders" o, b
      WHERE o."tenantId" = ${b.tenantId} AND o."paidAt" IS NOT NULL
        AND ((o."paidAt" >= b.s AND o."paidAt" < b.e) OR (o."paidAt" >= b.ps AND o."paidAt" < b.pe))
    ),
    sales AS (
      SELECT COALESCE(SUM("totalVnd") FILTER (WHERE cur AND NOT free), 0)::bigint::text AS gross_cur,
             COALESCE(SUM("totalVnd") FILTER (WHERE NOT cur AND NOT free), 0)::bigint::text AS gross_prev,
             COALESCE(SUM("totalVnd") FILTER (WHERE cur AND NOT free AND refunded), 0)::bigint::text AS refunded_cur,
             COALESCE(SUM("totalVnd") FILTER (WHERE NOT cur AND NOT free AND refunded), 0)::bigint::text AS refunded_prev,
             COUNT(*) FILTER (WHERE cur AND NOT free AND refunded)::int AS refunded_orders_cur,
             COUNT(*) FILTER (WHERE NOT cur AND NOT free AND refunded)::int AS refunded_orders_prev,
             COUNT(*) FILTER (WHERE cur AND NOT free)::int AS paid_cur,
             COUNT(*) FILTER (WHERE NOT cur AND NOT free)::int AS paid_prev,
             COUNT(DISTINCT "customerId") FILTER (WHERE cur AND NOT free)::int AS buyers_cur,
             COUNT(DISTINCT "customerId") FILTER (WHERE NOT cur AND NOT free)::int AS buyers_prev,
             COUNT(*) FILTER (WHERE cur AND free)::int AS free_cur,
             COUNT(*) FILTER (WHERE NOT cur AND free)::int AS free_prev
      FROM paid
    ),
    sold AS (
      SELECT COUNT(DISTINCT i."productId") FILTER (WHERE p.cur AND NOT p.free)::int AS products_cur,
             COUNT(DISTINCT i."productId") FILTER (WHERE NOT p.cur AND NOT p.free)::int AS products_prev
      FROM paid p JOIN "order_items" i ON i."orderId" = p."id"
    ),
    per_customer AS (
      SELECT o."customerId",
             bool_or(o."paidAt" >= b.s AND o."paidAt" < b.e) AS buyer_cur,
             bool_or(o."paidAt" >= b.ps AND o."paidAt" < b.pe) AS buyer_prev,
             COUNT(*) AS paid_until_end,
             COUNT(*) FILTER (WHERE o."paidAt" < b.pe) AS paid_until_prev_end
      FROM "orders" o, b
      WHERE o."tenantId" = ${b.tenantId} AND o."paidAt" IS NOT NULL AND o."paidAt" < b.e AND o."totalVnd" > 0
      GROUP BY o."customerId"
    ),
    returning_customers AS (
      SELECT COUNT(*) FILTER (WHERE buyer_cur AND paid_until_end >= 2)::int AS returning_cur,
             COUNT(*) FILTER (WHERE buyer_prev AND paid_until_prev_end >= 2)::int AS returning_prev
      FROM per_customer
    ),
    new_customers AS (
      SELECT COUNT(*) FILTER (WHERE c."firstOrderAt" >= b.s AND c."firstOrderAt" < b.e)::int AS new_customers_cur,
             COUNT(*) FILTER (WHERE c."firstOrderAt" >= b.ps AND c."firstOrderAt" < b.pe)::int AS new_customers_prev
      FROM "tenant_customers" c, b
      WHERE c."tenantId" = ${b.tenantId} AND c."firstOrderAt" >= b.ps AND c."firstOrderAt" < b.e
    ),
    snapshot AS (
      SELECT (SELECT COUNT(*) FROM "orders" o
               WHERE o."tenantId" = ${b.tenantId} AND o."status" = 'PENDING' AND o."expiresAt" >= b.n)::int AS pending_orders,
             (SELECT COUNT(*) FROM "entitlements" en
               WHERE en."tenantId" = ${b.tenantId} AND en."remedyStatus" = 'REFUND_REQUESTED')::int AS refund_pending,
             (SELECT COUNT(*) FROM "entitlements" en
               WHERE en."tenantId" = ${b.tenantId} AND en."remedyStatus" = 'REFUND_REQUESTED'
                 AND en."remedyChosenAt" < b.od)::int AS refund_overdue
      FROM b
    ),
    rv AS (
      SELECT COUNT(*) FILTER (WHERE r."createdAt" >= b.s AND r."createdAt" < b.e)::int AS reviews_new_cur,
             COUNT(*) FILTER (WHERE r."createdAt" >= b.ps AND r."createdAt" < b.pe)::int AS reviews_new_prev,
             (AVG(r."rating") FILTER (WHERE r."status" = 'VISIBLE' AND r."createdAt" >= b.s AND r."createdAt" < b.e))::float8 AS reviews_avg_cur,
             (AVG(r."rating") FILTER (WHERE r."status" = 'VISIBLE' AND r."createdAt" >= b.ps AND r."createdAt" < b.pe))::float8 AS reviews_avg_prev,
             COUNT(*) FILTER (WHERE r."status" = 'VISIBLE' AND r."createdAt" >= b.s AND r."createdAt" < b.e AND r."rating" = 1)::int AS r1,
             COUNT(*) FILTER (WHERE r."status" = 'VISIBLE' AND r."createdAt" >= b.s AND r."createdAt" < b.e AND r."rating" = 2)::int AS r2,
             COUNT(*) FILTER (WHERE r."status" = 'VISIBLE' AND r."createdAt" >= b.s AND r."createdAt" < b.e AND r."rating" = 3)::int AS r3,
             COUNT(*) FILTER (WHERE r."status" = 'VISIBLE' AND r."createdAt" >= b.s AND r."createdAt" < b.e AND r."rating" = 4)::int AS r4,
             COUNT(*) FILTER (WHERE r."status" = 'VISIBLE' AND r."createdAt" >= b.s AND r."createdAt" < b.e AND r."rating" = 5)::int AS r5,
             COUNT(*) FILTER (WHERE r."status" = 'VISIBLE' AND r."reply" IS NULL)::int AS reviews_unanswered,
             COUNT(*) FILTER (WHERE r."status" = 'HIDDEN' AND r."hiddenAt" >= b.s AND r."hiddenAt" < b.e)::int AS reviews_hidden_cur,
             COUNT(*) FILTER (WHERE r."status" = 'HIDDEN' AND r."hiddenAt" >= b.ps AND r."hiddenAt" < b.pe)::int AS reviews_hidden_prev,
             COUNT(*) FILTER (WHERE r."status" = 'HIDDEN')::int AS reviews_hidden_total,
             COUNT(*) FILTER (WHERE r."moderationLockedAt" IS NOT NULL)::int AS reviews_locked
      FROM "reviews" r, b
      WHERE r."tenantId" = ${b.tenantId}
    ),
    pr AS (
      SELECT COUNT(*) FILTER (WHERE p."status" = 'PUBLISHED')::int AS products_published,
             COUNT(*) FILTER (WHERE p."status" = 'DRAFT')::int AS products_draft,
             COUNT(*) FILTER (WHERE p."status" = 'ARCHIVED')::int AS products_archived,
             COUNT(*) FILTER (WHERE p."moderationLockedAt" IS NOT NULL)::int AS products_locked
      FROM "products" p
      WHERE p."tenantId" = ${b.tenantId}
    ),
    dl AS (
      SELECT COUNT(*) FILTER (WHERE d."createdAt" >= b.s AND d."createdAt" < b.e)::int AS downloads_cur,
             COUNT(*) FILTER (WHERE d."createdAt" >= b.ps AND d."createdAt" < b.pe)::int AS downloads_prev
      FROM "download_events" d, b
      WHERE d."tenantId" = ${b.tenantId} AND d."createdAt" >= b.ps AND d."createdAt" < b.e
    )
    SELECT * FROM sales, sold, returning_customers, new_customers, snapshot, rv, pr, dl
  `;
  const row = rows[0];
  if (!row) throw new AppError({ code: ErrorCodes.INTERNAL_ERROR, message: "Không tính được số liệu.", httpStatus: 500 });
  return row;
}

interface SeriesRow {
  bucket: string;
  gross: string;
  refunded: string;
  paid: number;
}

/** Truy vấn 2: doanh thu gộp / đã hoàn / số đơn theo bucket giờ VN của kỳ hiện tại. */
async function selectSeries(tx: Tx, b: Bounds, granularity: DashboardGranularity): Promise<SeriesRow[]> {
  const tz = DISPLAY_TIME_ZONE;
  return tx.$queryRaw<SeriesRow[]>`
    SELECT to_char(date_trunc(${granularity}::text, (o."paidAt" AT TIME ZONE 'UTC') AT TIME ZONE ${tz}), 'YYYY-MM-DD"T"HH24:MI') AS bucket,
           SUM(o."totalVnd")::bigint::text AS gross,
           COALESCE(SUM(o."totalVnd") FILTER (WHERE o."status" = 'REFUNDED'), 0)::bigint::text AS refunded,
           COUNT(*)::int AS paid
    FROM "orders" o
    WHERE o."tenantId" = ${b.tenantId} AND o."totalVnd" > 0
      AND o."paidAt" >= (${b.start}::timestamptz AT TIME ZONE 'UTC')
      AND o."paidAt" < (${b.end}::timestamptz AT TIME ZONE 'UTC')
    GROUP BY 1
  `;
}

interface ListsRow {
  top_selling: Array<{ productId: string; title: string; orders: number; revenueVnd: number | string; soldAllTime: number }> | null;
  top_rated: Array<{ productId: string; title: string; ratingSum: number; ratingCount: number }> | null;
  latest: Array<{ id: string; code: string; fullName: string | null; unitPriceVnd: number | null; totalVnd: number }> | null;
}

/** Truy vấn 3: top bán chạy trong kỳ, top đánh giá (luỹ kế), 10 đơn mới nhất — gom bằng json_agg để 1 vòng. */
async function selectLists(tx: Tx, b: Bounds): Promise<ListsRow> {
  const rows = await tx.$queryRaw<ListsRow[]>`
    SELECT
      (SELECT json_agg(t ORDER BY t."orders" DESC, t."revenueVnd" DESC, t."title" ASC) FROM (
         SELECT p."id" AS "productId", p."title" AS "title",
                COUNT(DISTINCT o."id")::int AS "orders",
                SUM(i."finalPriceVnd")::bigint AS "revenueVnd",
                p."soldCount" AS "soldAllTime"
         FROM "orders" o
         JOIN "order_items" i ON i."orderId" = o."id"
         JOIN "products" p ON p."id" = i."productId"
         WHERE o."tenantId" = ${b.tenantId} AND o."status" <> 'REFUNDED'
           AND o."paidAt" >= (${b.start}::timestamptz AT TIME ZONE 'UTC')
           AND o."paidAt" < (${b.end}::timestamptz AT TIME ZONE 'UTC')
         GROUP BY p."id", p."title", p."soldCount"
         ORDER BY 3 DESC, 4 DESC, 2 ASC
         LIMIT ${TOP_SELLING_LIMIT}
       ) t) AS top_selling,
      (SELECT json_agg(t ORDER BY t."ratingSum"::float8 / t."ratingCount" DESC, t."ratingCount" DESC, t."title" ASC) FROM (
         SELECT p."id" AS "productId", p."title" AS "title", p."ratingSum" AS "ratingSum", p."ratingCount" AS "ratingCount"
         FROM "products" p
         WHERE p."tenantId" = ${b.tenantId} AND p."ratingCount" >= ${TOP_RATED_MIN_REVIEWS}
         ORDER BY p."ratingSum"::float8 / p."ratingCount" DESC, p."ratingCount" DESC, p."title" ASC
         LIMIT ${TOP_RATED_LIMIT}
       ) t) AS top_rated,
      (SELECT json_agg(t ORDER BY t."createdAt" DESC, t."id" DESC) FROM (
         SELECT o."id", o."code", o."createdAt", up."fullName" AS "fullName", o."totalVnd" AS "totalVnd",
                (SELECT i."unitPriceVnd" FROM "order_items" i WHERE i."orderId" = o."id"
                  ORDER BY i."createdAt" ASC, i."id" ASC LIMIT 1) AS "unitPriceVnd"
         FROM "orders" o
         LEFT JOIN "user_profiles" up ON up."userId" = o."customerId"
         WHERE o."tenantId" = ${b.tenantId}
         ORDER BY o."createdAt" DESC, o."id" DESC
         LIMIT ${LATEST_ORDERS_LIMIT}
       ) t) AS latest
  `;
  return rows[0] ?? { top_selling: null, top_rated: null, latest: null };
}

export async function getTenantDashboard(input: { tenantId: string; range: DashboardRange; now?: Date }): Promise<TenantDashboard> {
  const { tenantId, range } = input;
  const now = input.now ?? new Date();
  const bounds: Bounds = {
    tenantId,
    start: range.start.toISOString(),
    end: range.end.toISOString(),
    prevStart: range.prevStart.toISOString(),
    prevEnd: range.prevEnd.toISOString(),
    now: now.toISOString(),
    overdueBefore: new Date(now.getTime() - REMEDY_REFUND_SLA_DAYS * DAY_MS).toISOString(),
  };

  // Truy vấn tuần tự trong cùng transaction (Prisma interactive transaction dùng 1 kết nối).
  const { metrics, seriesRows, lists } = await withTenant(tenantId, async (tx) => {
    const metrics = await selectMetrics(tx, bounds);
    const seriesRows = await selectSeries(tx, bounds, range.granularity);
    const lists = await selectLists(tx, bounds);
    return { metrics, seriesRows, lists };
  });

  const m = metrics;
  const grossCur = toInt(m.gross_cur);
  const grossPrev = toInt(m.gross_prev);
  const refundedCur = toInt(m.refunded_cur);
  const refundedPrev = toInt(m.refunded_prev);

  const seriesByKey = new Map(seriesRows.map((r) => [r.bucket, r]));
  const series: TenantDashboardSeriesPoint[] = listDashboardBuckets(range).map((bucket) => {
    const row = seriesByKey.get(bucket.key);
    const gross = toInt(row?.gross);
    return {
      key: bucket.key,
      start: bucket.start.toISOString(),
      label: bucket.label,
      future: bucket.future,
      grossRevenueVnd: gross,
      netRevenueVnd: gross - toInt(row?.refunded),
      paidOrders: row?.paid ?? 0,
    };
  });

  return {
    range: {
      key: range.key,
      label: range.label,
      prevLabel: range.prevLabel,
      start: bounds.start,
      end: bounds.end,
      prevStart: bounds.prevStart,
      prevEnd: bounds.prevEnd,
      granularity: range.granularity,
      customFrom: range.customFrom,
      customTo: range.customTo,
      displayFrom: range.displayFrom,
      displayTo: range.displayTo,
      invalid: range.invalid,
    },
    generatedAt: now.toISOString(),
    sales: {
      grossRevenueVnd: { current: grossCur, previous: grossPrev },
      netRevenueVnd: { current: grossCur - refundedCur, previous: grossPrev - refundedPrev },
      refundedVnd: { current: refundedCur, previous: refundedPrev },
      refundedOrders: { current: m.refunded_orders_cur, previous: m.refunded_orders_prev },
      paidOrders: { current: m.paid_cur, previous: m.paid_prev },
      avgOrderVnd: {
        current: m.paid_cur > 0 ? Math.floor(grossCur / m.paid_cur) : null,
        previous: m.paid_prev > 0 ? Math.floor(grossPrev / m.paid_prev) : null,
      },
      distinctProductsSold: { current: m.products_cur ?? 0, previous: m.products_prev ?? 0 },
      freeClaims: { current: m.free_cur, previous: m.free_prev },
      pendingOrders: m.pending_orders,
      refundRequests: { pending: m.refund_pending, overdue: m.refund_overdue },
    },
    customers: {
      newCustomers: { current: m.new_customers_cur, previous: m.new_customers_prev },
      buyers: { current: m.buyers_cur, previous: m.buyers_prev },
      returningCustomers: { current: m.returning_cur, previous: m.returning_prev },
      returningCustomerRate: { current: ratio(m.returning_cur, m.buyers_cur), previous: ratio(m.returning_prev, m.buyers_prev) },
    },
    reviews: {
      newReviews: { current: m.reviews_new_cur, previous: m.reviews_new_prev },
      avgRating: { current: round1(m.reviews_avg_cur), previous: round1(m.reviews_avg_prev) },
      distribution: [m.r1, m.r2, m.r3, m.r4, m.r5],
      hiddenInPeriod: { current: m.reviews_hidden_cur, previous: m.reviews_hidden_prev },
      unanswered: m.reviews_unanswered,
      hiddenTotal: m.reviews_hidden_total,
      moderationLocked: m.reviews_locked,
    },
    products: {
      published: m.products_published,
      draft: m.products_draft,
      archived: m.products_archived,
      moderationLocked: m.products_locked,
      downloads: { current: m.downloads_cur, previous: m.downloads_prev },
      topSelling: (lists.top_selling ?? []).map((t) => ({
        productId: t.productId,
        title: t.title,
        orders: t.orders,
        revenueVnd: toInt(t.revenueVnd),
        soldAllTime: t.soldAllTime,
      })),
      topRated: (lists.top_rated ?? []).map((t) => ({
        productId: t.productId,
        title: t.title,
        avgRating: round1(t.ratingSum / t.ratingCount) ?? 0,
        reviewCount: t.ratingCount,
      })),
    },
    series,
    latestOrders: (lists.latest ?? []).map((o) => ({
      id: o.id,
      code: o.code,
      customerFullName: o.fullName?.trim() ? o.fullName.trim() : ANONYMOUS_CUSTOMER_LABEL,
      unitPriceVnd: toInt(o.unitPriceVnd),
      totalVnd: toInt(o.totalVnd),
    })),
  };
}
