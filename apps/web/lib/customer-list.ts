import { z } from "zod";
import { AppError, ErrorCodes, notFound, resolveDashboardRange, type DashboardPreset } from "@gieochu/core";
import { Prisma, withTenant } from "@gieochu/db";
import { escapeLikePattern } from "./shop";
import { normalizeOrderSearchQuery, unaccentLikeSql, utcTimestampSql } from "./order";
import { audit } from "./audit";
import { CUSTOMER_NOTE_MAX_LENGTH, INACTIVE_CUSTOMER_DAYS } from "@gieochu/core/customer-list";

export { CUSTOMER_NOTE_MAX_LENGTH, INACTIVE_CUSTOMER_DAYS };

/**
 * ADR-048 — danh sách Khách hàng Studio (`/studio/{slug}/customers`), GĐ1 dữ liệu. UI là của Phong.
 *
 * TIỀN ĐIỀU KIỆN: nơi gọi đã `requireTenantMember(slug)` (OWNER) và truyền `tenant.id` lấy từ guard — không lấy tenantId
 * từ URL. Mọi truy vấn chạy trong MỘT `withTenant` + `"tenantId" = $1` tường minh. Bảng L1 đọc: `users.email`,
 * `user_profiles.fullName` (chỉ 2 trường — ADR-041, không SĐT/tỉnh).
 *
 * Định nghĩa (khớp ADR-043, tính lại từ `orders` — KHÔNG dùng cache `tenant_customers.ordersCount/totalSpentVnd`):
 * - **Khách của gian hàng** = user có ≥ 1 đơn `paidAt` khác null tại gian hàng (mọi số tiền, mọi trạng thái kể cả đã hoàn).
 *   Đơn chưa thanh toán (PENDING/EXPIRED/CANCELED) không làm ai thành khách.
 * - `paidOrders` = số đơn `totalVnd > 0` có `paidAt` (gồm đơn sau này hoàn — như "khách quay lại" ADR-043 lần 2).
 * - `freeClaims` = số đơn 0đ có `paidAt` (nhận tài liệu miễn phí).
 * - `spentVnd` = Σ `totalVnd` các đơn > 0đ có `paidAt` (GỘP, gồm đơn đã hoàn); `refundedVnd` = phần trong đó `REFUNDED`.
 * - `firstOrderAt` / `lastOrderAt` = min / max `paidAt` trên MỌI đơn đã thanh toán (gồm đơn 0đ) — cùng nghĩa với
 *   `tenant_customers.firstOrderAt` mà dashboard dùng cho "khách mới" (ADR-043).
 * - `hasRefundRequest` = khách đang có quyền tải `REFUND_REQUESTED` (ADR-039) tại gian hàng.
 * - `inactive` = `lastOrderAt` < now − {@link INACTIVE_CUSTOMER_DAYS} ngày (cùng điều kiện nhóm `lau-chua-quay-lai`).
 * - Hằng `CUSTOMER_NOTE_MAX_LENGTH` / `INACTIVE_CUSTOMER_DAYS` ở `@gieochu/core/customer-list` (client import được).
 * - Nhóm: `moi` = `firstOrderAt` trong kỳ (kỳ `ky` nếu có, không thì {@link NEW_CUSTOMER_DEFAULT_PRESET} = 30 ngày qua);
 *   `quay-lai` = `paidOrders ≥ 2`; `mien-phi` = `paidOrders = 0` (chỉ nhận miễn phí); `hoan-tien` = `hasRefundRequest`;
 *   `lau-chua-quay-lai` = `lastOrderAt` < now − {@link INACTIVE_CUSTOMER_DAYS} ngày.
 * - Bộ lọc kỳ `ky/tu/den` + `theo` (`mua-dau` mặc định | `mua-gan-nhat`): giữ khách có `firstOrderAt` / `lastOrderAt`
 *   trong kỳ. Không `ky` = mọi thời gian.
 * - Số liệu từng khách luôn là LUỸ KẾ tại gian hàng (không cắt theo kỳ).
 *
 * Phạm vi `stats`: tập khách khớp bộ lọc KỲ (`ky` + `theo`) — KHÔNG áp `q`, `nhom`, `san-pham`. Không có `ky` = toàn bộ
 * khách (khi đó `newCustomers` đếm theo 30 ngày qua — xem `stats.scope.newCustomersRange`). `groupCounts`: áp kỳ + `q` +
 * `san-pham`, không áp `nhom` (như `statusCounts` trang Đơn hàng).
 *
 * Truy vấn: 1 Prisma (dropdown tài liệu) + 2 SQL tổng hợp (thống kê/đếm nhóm, rồi đúng các khách của trang) — mọi giá trị
 * tham số hoá. Cache: không (như dashboard).
 */

export const CUSTOMER_GROUPS = ["tat-ca", "moi", "quay-lai", "mien-phi", "hoan-tien", "lau-chua-quay-lai"] as const;
export type CustomerGroup = (typeof CUSTOMER_GROUPS)[number];
export const CUSTOMER_DATE_FIELDS = ["mua-dau", "mua-gan-nhat"] as const;
export type CustomerDateField = (typeof CUSTOMER_DATE_FIELDS)[number];
export const CUSTOMER_DEFAULT_DATE_FIELD: CustomerDateField = "mua-dau";
export const CUSTOMER_LIST_SORTS = ["gan-nhat", "moi-nhat", "chi-tieu-giam", "so-don-giam"] as const;
export type CustomerListSort = (typeof CUSTOMER_LIST_SORTS)[number];
export const CUSTOMER_LIST_DEFAULT_SORT: CustomerListSort = "gan-nhat";
export const CUSTOMER_LIST_PAGE_SIZES = [10, 20, 50, 100] as const;
export const CUSTOMER_LIST_DEFAULT_PAGE_SIZE = 20;
/** Nhóm "khách mới" khi không chọn kỳ. */
export const NEW_CUSTOMER_DEFAULT_PRESET: DashboardPreset = "30-ngay";

const DAY_MS = 86_400_000;

export interface CustomerListRange {
  key: DashboardPreset;
  label: string;
  /** `YYYY-MM-DD` (giờ VN) — chỉ có với `tuy-chon`. */
  customFrom: string | null;
  customTo: string | null;
  /** `YYYY-MM-DD` (giờ VN) — ngày đầu / ngày cuối bao gồm, cho ô `dd/mm/yyyy - dd/mm/yyyy`. */
  displayFrom: string;
  displayTo: string;
  /** UTC, nửa mở `[start, end)`. */
  start: Date;
  end: Date;
}

export interface CustomerListQuery {
  q: string | null;
  group: CustomerGroup;
  /** Bộ lọc kỳ; null = mọi thời gian. */
  range: CustomerListRange | null;
  /** Mốc mà `range` lọc theo. Giữ cả khi `range` null (để điền lại form). */
  dateField: CustomerDateField;
  /** Chỉ giữ khi tài liệu thuộc gian hàng và có trong đơn đã thanh toán (có trong `products`). */
  productId: string | null;
  sort: CustomerListSort;
  /** Trang YÊU CẦU (≥1). Trang thực tế ở `CustomerListPage.page`. */
  page: number;
  pageSize: number;
}

export interface CustomerListItem {
  userId: string;
  /** null khi khách chưa có hồ sơ. */
  fullName: string | null;
  email: string;
  paidOrders: number;
  freeClaims: number;
  spentVnd: number;
  refundedVnd: number;
  firstOrderAt: Date;
  lastOrderAt: Date;
  hasRefundRequest: boolean;
  /** Không có đơn đã thanh toán trong {@link INACTIVE_CUSTOMER_DAYS} ngày (= nhóm `lau-chua-quay-lai`). */
  inactive: boolean;
  /** Ghi chú của gian hàng (`tenant_customers.note`), null khi chưa có. Khách không bao giờ thấy. */
  note: string | null;
}

export interface CustomerListStats {
  /** Phạm vi: `range` = bộ lọc kỳ đang áp (null = toàn bộ khách); `newCustomersRange` = kỳ dùng để đếm khách mới. */
  scope: { range: CustomerListRange | null; dateField: CustomerDateField; newCustomersRange: CustomerListRange };
  totalCustomers: number;
  /** Khách có `firstOrderAt` trong `newCustomersRange` (trong tập phạm vi). */
  newCustomers: number;
  /** `paidOrders ≥ 2`. */
  returningCustomers: number;
  /** Khách có `paidOrders ≥ 1`. */
  payingCustomers: number;
  /** returning ÷ paying (0–1); null khi paying = 0. */
  returningCustomerRate: number | null;
  spentVnd: number;
  refundedVnd: number;
  /** ⌊spentVnd ÷ payingCustomers⌋; null khi paying = 0. */
  avgSpentPerPayingCustomer: number | null;
  /** `paidOrders = 0` (chỉ nhận tài liệu miễn phí). */
  freeOnlyCustomers: number;
}

export type CustomerGroupCounts = Record<CustomerGroup, number>;

export interface CustomerListPage {
  items: CustomerListItem[];
  /** Số khách khớp TOÀN BỘ bộ lọc. */
  total: number;
  /** Trang thực tế (kẹp về [1, pageCount]). */
  page: number;
  pageSize: number;
  /** ≥ 1. */
  pageCount: number;
  stats: CustomerListStats;
  groupCounts: CustomerGroupCounts;
  /** Tài liệu của gian hàng có trong ít nhất 1 đơn đã thanh toán, sắp theo tên — cho dropdown. */
  products: { id: string; title: string }[];
  query: CustomerListQuery;
}

export type CustomerListSearchParams = Record<string, string | string[] | undefined>;

const firstQueryValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);
const groupParamSchema = z.preprocess(firstQueryValue, z.enum(CUSTOMER_GROUPS));
const dateFieldParamSchema = z.preprocess(firstQueryValue, z.enum(CUSTOMER_DATE_FIELDS));
const sortParamSchema = z.preprocess(firstQueryValue, z.enum(CUSTOMER_LIST_SORTS));
const pageParamSchema = z.preprocess(firstQueryValue, z.coerce.number().int().min(1).max(1_000_000));
const pageSizeParamSchema = z.preprocess(firstQueryValue, z.coerce.number().int());
const idParamSchema = z.preprocess(firstQueryValue, z.string().regex(/^[a-z0-9]{1,64}$/));

function toRange(resolved: ReturnType<typeof resolveDashboardRange>): CustomerListRange {
  return {
    key: resolved.key,
    label: resolved.label,
    customFrom: resolved.customFrom,
    customTo: resolved.customTo,
    displayFrom: resolved.displayFrom,
    displayTo: resolved.displayTo,
    start: resolved.start,
    end: resolved.end,
  };
}

/**
 * Parse phòng thủ `searchParams` (không bao giờ ném). Tham số: `q`, `nhom`, `ky`/`tu`/`den` (như dashboard ADR-043; thiếu
 * hoặc sai → mọi thời gian), `theo`, `san-pham`, `sap-xep`, `trang`, `so-dong` (10/20/50/100).
 */
export function parseCustomerListQuery(sp: CustomerListSearchParams, now = new Date()): CustomerListQuery {
  const group = groupParamSchema.safeParse(sp.nhom);
  const dateField = dateFieldParamSchema.safeParse(sp.theo);
  const sort = sortParamSchema.safeParse(sp["sap-xep"]);
  const page = pageParamSchema.safeParse(sp.trang);
  const size = pageSizeParamSchema.safeParse(sp["so-dong"]);
  const productId = idParamSchema.safeParse(sp["san-pham"]);

  let range: CustomerListRange | null = null;
  const ky = firstQueryValue(sp.ky);
  if (typeof ky === "string" && ky !== "") {
    const resolved = resolveDashboardRange({ ky, tu: sp.tu, den: sp.den, now });
    if (!resolved.invalid) range = toRange(resolved);
  }

  return {
    q: normalizeOrderSearchQuery(sp.q),
    group: group.success ? group.data : "tat-ca",
    range,
    dateField: dateField.success ? dateField.data : CUSTOMER_DEFAULT_DATE_FIELD,
    productId: productId.success ? productId.data : null,
    sort: sort.success ? sort.data : CUSTOMER_LIST_DEFAULT_SORT,
    page: page.success ? page.data : 1,
    pageSize:
      size.success && (CUSTOMER_LIST_PAGE_SIZES as readonly number[]).includes(size.data) ? size.data : CUSTOMER_LIST_DEFAULT_PAGE_SIZE,
  };
}

/**
 * Dựng query string (không có `?`) từ bộ lọc đã chuẩn hoá + phần thay đổi. Bỏ giá trị mặc định (`nhom=tat-ca`,
 * `theo=mua-dau`, `sap-xep=gan-nhat`, trang 1, 20 dòng). `theo` chỉ ghi khi có kỳ. Đổi bộ lọc mà không truyền `page`
 * → về trang 1. `range` truyền dạng URL (`{ ky, tu?, den? }`) hoặc null (mọi thời gian).
 */
export function buildCustomerListSearch(
  query: CustomerListQuery,
  patch: Partial<Omit<CustomerListQuery, "range">> & { range?: { ky: DashboardPreset; tu?: string; den?: string } | null } = {},
): string {
  const next = { ...query, ...patch };
  const params = new URLSearchParams();
  if (next.q) params.set("q", next.q);
  if (next.group !== "tat-ca") params.set("nhom", next.group);
  const range =
    "range" in patch
      ? patch.range
      : query.range
        ? { ky: query.range.key, tu: query.range.customFrom ?? undefined, den: query.range.customTo ?? undefined }
        : null;
  if (range) {
    params.set("ky", range.ky);
    if (range.ky === "tuy-chon" && range.tu && range.den) {
      params.set("tu", range.tu);
      params.set("den", range.den);
    }
    if (next.dateField !== CUSTOMER_DEFAULT_DATE_FIELD) params.set("theo", next.dateField);
  }
  if (next.productId) params.set("san-pham", next.productId);
  if (next.sort !== CUSTOMER_LIST_DEFAULT_SORT) params.set("sap-xep", next.sort);
  if (next.pageSize !== CUSTOMER_LIST_DEFAULT_PAGE_SIZE) params.set("so-dong", String(next.pageSize));
  const filterChanged = Object.keys(patch).some((k) => k !== "page");
  const page = "page" in patch ? (patch.page ?? 1) : filterChanged ? 1 : query.page;
  if (page > 1) params.set("trang", String(page));
  return params.toString();
}

/** BIGINT dạng chuỗi → số nguyên an toàn (VND). */
function toInt(value: string | number | bigint | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(n)) {
    throw new AppError({ code: ErrorCodes.INTERNAL_ERROR, message: "Số liệu vượt giới hạn hiển thị.", httpStatus: 500 });
  }
  return n;
}

/** Thứ tự danh sách (alias `s`); luôn kết thúc bằng `uid` để phân trang ổn định. */
function customerOrderBySql(sort: CustomerListSort): Prisma.Sql {
  switch (sort) {
    case "moi-nhat":
      return Prisma.sql`s.first_at DESC, s.uid ASC`;
    case "chi-tieu-giam":
      return Prisma.sql`s.spent DESC, s.last_at DESC, s.uid ASC`;
    case "so-don-giam":
      return Prisma.sql`s.paid_orders DESC, s.spent DESC, s.last_at DESC, s.uid ASC`;
    case "gan-nhat":
      return Prisma.sql`s.last_at DESC, s.uid ASC`;
  }
}

function groupConditionSql(group: CustomerGroup, inactiveBefore: Prisma.Sql): Prisma.Sql {
  switch (group) {
    case "tat-ca":
      return Prisma.sql`TRUE`;
    case "moi":
      return Prisma.sql`s.is_new`;
    case "quay-lai":
      return Prisma.sql`s.paid_orders >= 2`;
    case "mien-phi":
      return Prisma.sql`s.paid_orders = 0`;
    case "hoan-tien":
      return Prisma.sql`s.has_refund`;
    case "lau-chua-quay-lai":
      return Prisma.sql`s.last_at < ${inactiveBefore}`;
  }
}

/** ISO-8601 UTC từ cột `timestamp(3)` (lưu UTC, không múi giờ). */
function isoSql(column: Prisma.Sql): Prisma.Sql {
  return Prisma.sql`to_char(${column}, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
}

interface StatsRow {
  total_customers: number;
  new_customers: number;
  returning_customers: number;
  paying_customers: number;
  free_only_customers: number;
  spent: string;
  refunded: string;
  g_all: number;
  g_new: number;
  g_returning: number;
  g_free: number;
  g_refund: number;
  g_inactive: number;
}

interface PageRow {
  userId: string;
  fullName: string | null;
  email: string;
  paidOrders: number;
  freeClaims: number;
  spent: string;
  refunded: string;
  firstAt: string;
  lastAt: string;
  hasRefund: boolean;
  inactive: boolean;
  note: string | null;
}

/**
 * ADR-048 — danh sách khách Studio. Xem định nghĩa ở đầu file. Trang vượt số trang → kẹp về trang cuối.
 * Tìm `q` KHÔNG DẤU trên email / họ tên (`gieochu_unaccent(lower(...)) LIKE ... ESCAPE '\'`, `%`/`_`/`\` được escape).
 */
export async function listCustomersPage(tenantId: string, sp: CustomerListSearchParams): Promise<CustomerListPage> {
  const now = new Date();
  const parsed = parseCustomerListQuery(sp, now);
  const newRange = parsed.range ?? toRange(resolveDashboardRange({ ky: NEW_CUSTOMER_DEFAULT_PRESET, now }));
  const inactiveBefore = utcTimestampSql(new Date(now.getTime() - INACTIVE_CUSTOMER_DAYS * DAY_MS));

  return withTenant(tenantId, async (tx) => {
    const products = await tx.product.findMany({
      where: { tenantId, orderItems: { some: { order: { tenantId, paidAt: { not: null } } } } },
      select: { id: true, title: true },
      orderBy: [{ title: "asc" }, { id: "asc" }],
    });
    const productId = parsed.productId && products.some((p) => p.id === parsed.productId) ? parsed.productId : null;

    const rangeColumn = parsed.dateField === "mua-gan-nhat" ? Prisma.sql`c.last_at` : Prisma.sql`c.first_at`;
    const inRange = parsed.range
      ? Prisma.sql`(${rangeColumn} >= ${utcTimestampSql(parsed.range.start)} AND ${rangeColumn} < ${utcTimestampSql(parsed.range.end)})`
      : Prisma.sql`TRUE`;

    const searchParts: Prisma.Sql[] = [];
    if (parsed.q) {
      const escaped = escapeLikePattern(parsed.q);
      searchParts.push(Prisma.sql`(
        EXISTS (SELECT 1 FROM "users" u WHERE u."id" = c.uid AND ${unaccentLikeSql(Prisma.sql`u."email"`, escaped)})
        OR EXISTS (SELECT 1 FROM "user_profiles" up WHERE up."userId" = c.uid AND ${unaccentLikeSql(Prisma.sql`up."fullName"`, escaped)})
      )`);
    }
    if (productId) {
      searchParts.push(Prisma.sql`EXISTS (
        SELECT 1 FROM "order_items" oi JOIN "orders" o2 ON o2."id" = oi."orderId"
        WHERE o2."tenantId" = ${tenantId} AND o2."customerId" = c.uid AND o2."paidAt" IS NOT NULL AND oi."productId" = ${productId}
      )`);
    }
    const inSearch = searchParts.length > 0 ? Prisma.join(searchParts, " AND ") : Prisma.sql`TRUE`;

    const customersCte = Prisma.sql`
      WITH c AS (
        SELECT o."customerId" AS uid,
               count(*) FILTER (WHERE o."totalVnd" > 0)::int AS paid_orders,
               count(*) FILTER (WHERE o."totalVnd" = 0)::int AS free_claims,
               COALESCE(SUM(o."totalVnd") FILTER (WHERE o."totalVnd" > 0), 0)::bigint AS spent,
               COALESCE(SUM(o."totalVnd") FILTER (WHERE o."totalVnd" > 0 AND o."status" = 'REFUNDED'), 0)::bigint AS refunded,
               min(o."paidAt") AS first_at,
               max(o."paidAt") AS last_at
        FROM "orders" o
        WHERE o."tenantId" = ${tenantId} AND o."paidAt" IS NOT NULL
        GROUP BY o."customerId"
      ), s AS (
        SELECT c.*,
               EXISTS (
                 SELECT 1 FROM "entitlements" e
                 WHERE e."tenantId" = ${tenantId} AND e."userId" = c.uid AND e."remedyStatus" = 'REFUND_REQUESTED'
               ) AS has_refund,
               ${inRange} AS in_range,
               ${inSearch} AS in_search,
               (c.first_at >= ${utcTimestampSql(newRange.start)} AND c.first_at < ${utcTimestampSql(newRange.end)}) AS is_new
        FROM c
      )`;

    const statsRows = await tx.$queryRaw<StatsRow[]>(Prisma.sql`
      ${customersCte}
      SELECT count(*) FILTER (WHERE s.in_range)::int AS total_customers,
             count(*) FILTER (WHERE s.in_range AND s.is_new)::int AS new_customers,
             count(*) FILTER (WHERE s.in_range AND s.paid_orders >= 2)::int AS returning_customers,
             count(*) FILTER (WHERE s.in_range AND s.paid_orders >= 1)::int AS paying_customers,
             count(*) FILTER (WHERE s.in_range AND s.paid_orders = 0)::int AS free_only_customers,
             COALESCE(SUM(s.spent) FILTER (WHERE s.in_range), 0)::bigint::text AS spent,
             COALESCE(SUM(s.refunded) FILTER (WHERE s.in_range), 0)::bigint::text AS refunded,
             count(*) FILTER (WHERE s.in_range AND s.in_search)::int AS g_all,
             count(*) FILTER (WHERE s.in_range AND s.in_search AND s.is_new)::int AS g_new,
             count(*) FILTER (WHERE s.in_range AND s.in_search AND s.paid_orders >= 2)::int AS g_returning,
             count(*) FILTER (WHERE s.in_range AND s.in_search AND s.paid_orders = 0)::int AS g_free,
             count(*) FILTER (WHERE s.in_range AND s.in_search AND s.has_refund)::int AS g_refund,
             count(*) FILTER (WHERE s.in_range AND s.in_search AND s.last_at < ${inactiveBefore})::int AS g_inactive
      FROM s
    `);
    const m = statsRows[0];
    if (!m) throw new AppError({ code: ErrorCodes.INTERNAL_ERROR, message: "Không đọc được số liệu khách hàng.", httpStatus: 500 });

    const groupCounts: CustomerGroupCounts = {
      "tat-ca": m.g_all,
      moi: m.g_new,
      "quay-lai": m.g_returning,
      "mien-phi": m.g_free,
      "hoan-tien": m.g_refund,
      "lau-chua-quay-lai": m.g_inactive,
    };
    const total = groupCounts[parsed.group];
    const pageCount = Math.max(1, Math.ceil(total / parsed.pageSize));
    const page = Math.min(parsed.page, pageCount);

    const rows =
      total > 0
        ? await tx.$queryRaw<PageRow[]>(Prisma.sql`
            ${customersCte}
            SELECT s.uid AS "userId",
                   up."fullName" AS "fullName",
                   u."email" AS "email",
                   s.paid_orders AS "paidOrders",
                   s.free_claims AS "freeClaims",
                   s.spent::text AS "spent",
                   s.refunded::text AS "refunded",
                   ${isoSql(Prisma.sql`s.first_at`)} AS "firstAt",
                   ${isoSql(Prisma.sql`s.last_at`)} AS "lastAt",
                   s.has_refund AS "hasRefund",
                   (s.last_at < ${inactiveBefore}) AS "inactive",
                   tc."note" AS "note"
            FROM s
            JOIN "users" u ON u."id" = s.uid
            LEFT JOIN "user_profiles" up ON up."userId" = s.uid
            LEFT JOIN "tenant_customers" tc ON tc."tenantId" = ${tenantId} AND tc."userId" = s.uid
            WHERE s.in_range AND s.in_search AND ${groupConditionSql(parsed.group, inactiveBefore)}
            ORDER BY ${customerOrderBySql(parsed.sort)}
            LIMIT ${parsed.pageSize}::int OFFSET ${(page - 1) * parsed.pageSize}::int
          `)
        : [];

    const spentVnd = toInt(m.spent);
    return {
      items: rows.map((row) => ({
        userId: row.userId,
        fullName: row.fullName?.trim() ? row.fullName.trim() : null,
        email: row.email,
        paidOrders: row.paidOrders,
        freeClaims: row.freeClaims,
        spentVnd: toInt(row.spent),
        refundedVnd: toInt(row.refunded),
        firstOrderAt: new Date(row.firstAt),
        lastOrderAt: new Date(row.lastAt),
        hasRefundRequest: row.hasRefund,
        inactive: row.inactive,
        note: row.note,
      })),
      total,
      page,
      pageSize: parsed.pageSize,
      pageCount,
      stats: {
        scope: { range: parsed.range, dateField: parsed.dateField, newCustomersRange: newRange },
        totalCustomers: m.total_customers,
        newCustomers: m.new_customers,
        returningCustomers: m.returning_customers,
        payingCustomers: m.paying_customers,
        returningCustomerRate: m.paying_customers > 0 ? m.returning_customers / m.paying_customers : null,
        spentVnd,
        refundedVnd: toInt(m.refunded),
        avgSpentPerPayingCustomer: m.paying_customers > 0 ? Math.floor(spentVnd / m.paying_customers) : null,
        freeOnlyCustomers: m.free_only_customers,
      },
      groupCounts,
      products,
      query: { ...parsed, productId, page },
    };
  });
}

// ───────────────────────── ADR-048 mục 4: ghi chú khách ─────────────────────────

const noteSchema = z
  .string()
  .transform((value) => value.normalize("NFC").trim())
  .pipe(z.string().max(CUSTOMER_NOTE_MAX_LENGTH, `Ghi chú tối đa ${CUSTOMER_NOTE_MAX_LENGTH} ký tự.`));
const customerIdSchema = z.string().regex(/^[a-z0-9]{1,64}$/);

/**
 * Ghi/sửa/xoá ghi chú khách (`tenant_customers.note`, L2). NFC + trim, ≤ {@link CUSTOMER_NOTE_MAX_LENGTH} ký tự, rỗng → null.
 * Khách phải thuộc gian hàng: dòng `tenant_customers` (tạo khi khách có đơn đã thanh toán đầu tiên) tồn tại dưới
 * `withTenant(tenantId)` — khách tenant khác / không tồn tại → 404. Audit `CUSTOMER_NOTE_UPDATED` sau commit, metadata chỉ
 * `customerUserId` (không nội dung); nội dung không đổi thì không ghi DB/audit.
 */
export async function updateCustomerNote(
  tenantId: string,
  userId: string,
  note: unknown,
  actorId: string | null = null,
): Promise<{ note: string | null }> {
  if (!customerIdSchema.safeParse(userId).success) throw notFound("Không tìm thấy khách hàng.");
  const parsed = noteSchema.safeParse(typeof note === "string" ? note : "");
  if (!parsed.success) {
    throw new AppError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: parsed.error.issues[0]?.message ?? "Ghi chú không hợp lệ.",
      httpStatus: 400,
    });
  }
  const value = parsed.data === "" ? null : parsed.data;

  const changed = await withTenant(tenantId, async (tx) => {
    const existing = await tx.tenantCustomer.findUnique({
      where: { tenantId_userId: { tenantId, userId } },
      select: { note: true },
    });
    if (!existing) throw notFound("Không tìm thấy khách hàng.");
    if (existing.note === value) return false;
    await tx.tenantCustomer.update({ where: { tenantId_userId: { tenantId, userId } }, data: { note: value } });
    return true;
  });

  if (changed) {
    await audit.log({
      actorId,
      scope: "TENANT",
      tenantId,
      action: "CUSTOMER_NOTE_UPDATED",
      targetType: "TenantCustomer",
      targetId: userId,
      metadata: { customerUserId: userId },
    });
  }
  return { note: value };
}
