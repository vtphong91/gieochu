import {
  computeRatingAverage,
  HOME_FEATURED_LIMIT_MAX,
  HOME_FEATURED_LIMIT_MIN,
  HOME_PINNED_MAX,
  HOME_STAT_KEYS,
  productPath,
  type HomeSection,
  type HomeStatKey,
} from "@gieochu/core";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { Prisma, withPublic } from "@gieochu/db";
import { getPublicBucketBaseUrl } from "./product-cover";
import { PUBLIC_PRODUCT_SELECT, toPublicProducts, type PublicProduct } from "./storefront";

/**
 * ADR-033 — dữ liệu thật cho trang chủ hệ thống (`app/page.tsx`) và ô chọn ghim của editor CMS trang chủ.
 *
 * Quy ước "Công khai" dùng chung cho mọi loader ở đây: sản phẩm `PUBLISHED` **và** tenant `ACTIVE` (tenant
 * READ_ONLY/LOCKED không được quảng bá trên trang chủ — LOCKED còn 404 ở storefront).
 *
 * Cổng dữ liệu:
 *  - Mọi truy vấn chạy trong `withPublic` — RLS `products` (public ⇒ chỉ PUBLISHED) và `reviews` (public ⇒ VISIBLE của
 *    sản phẩm PUBLISHED) là cổng thật; `tenants`/`document_categories` là L1 không RLS nên đọc chung transaction được.
 *    (Không dùng `getPrismaClient()` trần: điều kiện quan hệ `products: { some }` trên tenant/danh mục chạm bảng L2 —
 *    ngoài scope sẽ thấy 0 dòng.)
 *  - **Không** đọc `orders/order_items/entitlements` (§7.9) — số đã bán chỉ lấy từ cột cache `products.soldCount`.
 */

const PUBLIC_PRODUCT_WHERE = { status: "PUBLISHED", tenant: { status: "ACTIVE" } } as const satisfies Prisma.ProductWhereInput;

// ───────────────────────── Số liệu nổi bật ─────────────────────────

export type HomeStats = Record<HomeStatKey, number>;

/**
 * ADR-033 mục 2: `tenants` = tenant ACTIVE có ≥1 tài liệu Công khai; `products` = số tài liệu Công khai; `sold` =
 * tổng `soldCount` của tài liệu Công khai; `reviews` = số đánh giá VISIBLE trên tài liệu Công khai. 0 → UI ẩn ô.
 */
export async function getHomeStats(): Promise<HomeStats> {
  return withPublic(async (tx) => {
    const [tenants, productAgg, reviews] = await Promise.all([
      tx.tenant.count({ where: { status: "ACTIVE", products: { some: { status: "PUBLISHED" } } } }),
      tx.product.aggregate({ where: PUBLIC_PRODUCT_WHERE, _count: { _all: true }, _sum: { soldCount: true } }),
      tx.review.count({ where: { status: "VISIBLE", product: PUBLIC_PRODUCT_WHERE } }),
    ]);
    return {
      tenants,
      products: productAgg._count._all,
      sold: productAgg._sum.soldCount ?? 0,
      reviews,
    };
  });
}

export interface HomeStatItem {
  key: HomeStatKey;
  label: string;
  value: number;
}

/** Ô số liệu cần render: bật trong CMS **và** giá trị > 0, đúng thứ tự `HOME_STAT_KEYS`. Rỗng → không render section. */
export function buildHomeStatItems(data: Extract<HomeSection, { type: "stats" }>["data"], stats: HomeStats): HomeStatItem[] {
  return HOME_STAT_KEYS.filter((key) => data.metrics[key].enabled && stats[key] > 0).map((key) => ({
    key,
    label: data.metrics[key].label,
    value: stats[key],
  }));
}

// ───────────────────────── Tìm tài liệu: danh mục ─────────────────────────

export interface HomeSearchCategory {
  id: string;
  name: string;
  slug: string;
  /** Số tài liệu Công khai trong danh mục (≥ 1). */
  productCount: number;
}

/** ADR-033 mục 3: danh mục `isActive` có ≥1 tài liệu Công khai — nhiều tài liệu trước, cùng số thì theo tên. */
export async function getHomeSearchCategories(): Promise<HomeSearchCategory[]> {
  const rows = await withPublic((tx) =>
    tx.documentCategory.findMany({
      where: { isActive: true, products: { some: PUBLIC_PRODUCT_WHERE } },
      select: { id: true, name: true, slug: true, _count: { select: { products: { where: PUBLIC_PRODUCT_WHERE } } } },
    }),
  );
  return rows
    .map((row) => ({ id: row.id, name: row.name, slug: row.slug, productCount: row._count.products }))
    .filter((row) => row.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, "vi"));
}

// ───────────────────────── Giáo viên & Coach nổi bật ─────────────────────────

export interface HomeFeaturedTenant {
  id: string;
  slug: string;
  name: string;
  /** Logo đã qua transformation tối ưu (ADR-028) nếu là ảnh Cloudinary; null = chưa có logo (UI dùng chữ viết tắt). */
  logoUrl: string | null;
  /** Số tài liệu Công khai. */
  productCount: number;
  /** Điểm TB 1 chữ số thập phân gộp mọi tài liệu Công khai; null khi chưa có đánh giá. */
  ratingAvg: number | null;
  ratingCount: number;
  /** Tổng `soldCount` các tài liệu Công khai; 0 = UI ẩn "đã bán". */
  soldCount: number;
  /** Link storefront `/{slug}`. */
  href: string;
}

interface FeaturedTenantRow {
  id: string;
  slug: string;
  name: string;
  logoKey: string | null;
  productCount: number;
  ratingSum: number;
  ratingCount: number;
  soldCount: number;
}

export interface HomeFeaturedOptions {
  limit: number;
  pinnedIds: readonly string[];
}

function clampLimit(limit: number): number {
  return Math.min(Math.max(Math.trunc(limit) || HOME_FEATURED_LIMIT_MIN, HOME_FEATURED_LIMIT_MIN), HOME_FEATURED_LIMIT_MAX);
}

function normalizePinned(ids: readonly string[], limit: number): string[] {
  return [...new Set(ids.filter((id) => typeof id === "string" && id.length > 0))].slice(0, Math.min(limit, HOME_PINNED_MAX));
}

function orderByPinned<T extends { id: string }>(rows: T[], pinned: readonly string[]): T[] {
  const position = new Map(pinned.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => (position.get(a.id) ?? 0) - (position.get(b.id) ?? 0));
}

/**
 * Tổng hợp theo tenant ACTIVE có ≥1 tài liệu PUBLISHED (JOIN trong RLS public). `include` = chỉ các id này (ghim);
 * `exclude` = bỏ các id này, sắp xếp: có đánh giá trước → điểm TB giảm dần → số đánh giá → tenant mới nhất.
 */
function featuredTenantQuery(filter: { include: readonly string[] } | { exclude: readonly string[] }, take: number): Prisma.Sql {
  const condition =
    "include" in filter
      ? Prisma.sql`AND t."id" IN (${Prisma.join(filter.include)})`
      : filter.exclude.length > 0
        ? Prisma.sql`AND t."id" NOT IN (${Prisma.join(filter.exclude)})`
        : Prisma.empty;
  return Prisma.sql`
    SELECT t."id", t."slug", t."name", t."logoKey",
      COUNT(p."id")::int AS "productCount",
      COALESCE(SUM(p."ratingSum"), 0)::int AS "ratingSum",
      COALESCE(SUM(p."ratingCount"), 0)::int AS "ratingCount",
      COALESCE(SUM(p."soldCount"), 0)::int AS "soldCount"
    FROM "tenants" t
    JOIN "products" p ON p."tenantId" = t."id" AND p."status" = 'PUBLISHED'
    WHERE t."status" = 'ACTIVE' ${condition}
    GROUP BY t."id"
    ORDER BY (SUM(p."ratingCount") > 0) DESC,
      SUM(p."ratingSum")::numeric / NULLIF(SUM(p."ratingCount"), 0) DESC NULLS LAST,
      SUM(p."ratingCount") DESC,
      t."createdAt" DESC,
      t."id"
    LIMIT ${take}
  `;
}

function tenantLogoUrl(logoKey: string | null, publicBaseUrl: string | null): string | null {
  if (!logoKey || !publicBaseUrl) return null;
  return cloudinaryDeliveryUrl(`${publicBaseUrl}/${logoKey}`, { width: 160 });
}

/**
 * ADR-033 mục 4: tenant ghim trước (đúng thứ tự; bỏ id không còn ACTIVE/không còn tài liệu Công khai), rồi bù theo
 * điểm đánh giá (≥1 đánh giá) và mới nhất cho đủ `limit` (kẹp 3–12).
 */
export async function getHomeFeaturedTenants(options: HomeFeaturedOptions): Promise<HomeFeaturedTenant[]> {
  const limit = clampLimit(options.limit);
  const pinned = normalizePinned(options.pinnedIds, limit);

  const rows = await withPublic(async (tx) => {
    const pinnedRows = pinned.length ? await tx.$queryRaw<FeaturedTenantRow[]>(featuredTenantQuery({ include: pinned }, pinned.length)) : [];
    const ordered = orderByPinned(pinnedRows, pinned);
    const remaining = limit - ordered.length;
    const fill =
      remaining > 0
        ? await tx.$queryRaw<FeaturedTenantRow[]>(featuredTenantQuery({ exclude: ordered.map((r) => r.id) }, remaining))
        : [];
    return [...ordered, ...fill];
  });
  if (rows.length === 0) return [];

  const publicBaseUrl = rows.some((row) => row.logoKey) ? await getPublicBucketBaseUrl() : null;
  return rows.map((row) => ({
    id: row.id,
    slug: row.slug,
    name: row.name,
    logoUrl: tenantLogoUrl(row.logoKey, publicBaseUrl),
    productCount: row.productCount,
    ratingAvg: computeRatingAverage(row.ratingSum, row.ratingCount),
    ratingCount: row.ratingCount,
    soldCount: row.soldCount,
    href: `/${row.slug}`,
  }));
}

// ───────────────────────── Tài liệu nổi bật ─────────────────────────

export interface HomeFeaturedProduct extends PublicProduct {
  tenant: { slug: string; name: string };
  /** `productPath(tenant.slug, product.slug)` (ADR-030). */
  href: string;
}

/** Id tài liệu bù: Công khai, bỏ `exclude`; có đánh giá trước → điểm TB giảm dần → số đánh giá → mới nhất. */
function fillProductIdsQuery(exclude: readonly string[], take: number): Prisma.Sql {
  const condition = exclude.length > 0 ? Prisma.sql`AND p."id" NOT IN (${Prisma.join(exclude)})` : Prisma.empty;
  return Prisma.sql`
    SELECT p."id"
    FROM "products" p
    JOIN "tenants" t ON t."id" = p."tenantId"
    WHERE p."status" = 'PUBLISHED' AND t."status" = 'ACTIVE' ${condition}
    ORDER BY (p."ratingCount" > 0) DESC,
      p."ratingSum"::numeric / NULLIF(p."ratingCount", 0) DESC NULLS LAST,
      p."ratingCount" DESC,
      p."createdAt" DESC,
      p."id"
    LIMIT ${take}
  `;
}

/**
 * ADR-033 mục 4: tài liệu ghim trước (đúng thứ tự; bỏ id không còn Công khai), rồi bù theo điểm đánh giá (≥1 đánh
 * giá) và mới nhất cho đủ `limit` (kẹp 3–12). Giá hiệu lực/ảnh bìa đi cùng đường với thẻ storefront.
 */
export async function getHomeFeaturedProducts(options: HomeFeaturedOptions): Promise<HomeFeaturedProduct[]> {
  const limit = clampLimit(options.limit);
  const pinned = normalizePinned(options.pinnedIds, limit);

  const rows = await withPublic(async (tx) => {
    const validPinned = pinned.length
      ? (await tx.product.findMany({ where: { ...PUBLIC_PRODUCT_WHERE, id: { in: pinned } }, select: { id: true } })).map((r) => r.id)
      : [];
    const pinnedIds = pinned.filter((id) => validPinned.includes(id));
    const remaining = limit - pinnedIds.length;
    const fillIds = remaining > 0 ? (await tx.$queryRaw<{ id: string }[]>(fillProductIdsQuery(pinnedIds, remaining))).map((r) => r.id) : [];
    const ids = [...pinnedIds, ...fillIds];
    if (ids.length === 0) return [];

    const found = await tx.product.findMany({
      where: { ...PUBLIC_PRODUCT_WHERE, id: { in: ids } },
      select: { ...PUBLIC_PRODUCT_SELECT, tenant: { select: { slug: true, name: true } } },
    });
    return orderByPinned(found, ids);
  });

  const products = await toPublicProducts(rows);
  return products.map((product, index) => {
    const tenant = rows[index]!.tenant;
    return { ...product, tenant, href: productPath(tenant.slug, product.slug) };
  });
}

// ───────────────────────── Ô chọn ghim cho editor CMS (System Admin) ─────────────────────────

/** Tối đa lựa chọn trả về cho ô chọn ghim. */
export const HOME_PIN_OPTIONS_MAX = 200;

export interface HomeTenantOption {
  id: string;
  name: string;
  slug: string;
  /** Số tài liệu Công khai (0 khi không còn hợp lệ). */
  productCount: number;
  /** false = đang ghim nhưng không còn hiển thị được (tenant không ACTIVE hoặc không còn tài liệu Công khai). */
  eligible: boolean;
}

export interface HomeProductOption {
  id: string;
  title: string;
  tenantName: string;
  tenantSlug: string;
}

export interface HomePinOptionsQuery {
  /** Lọc theo tên (không phân biệt hoa thường); trống = tất cả. */
  search?: string;
  /** Id đang ghim — luôn được trả về kèm (tenant: có cờ `eligible`; tài liệu: chỉ những id còn Công khai). */
  includeIds?: readonly string[];
}

function normalizeSearch(search: string | undefined): string | undefined {
  const value = search?.trim().slice(0, 100);
  return value ? value : undefined;
}

/**
 * Tenant cho ô ghim "Giáo viên & Coach nổi bật": tenant ACTIVE có ≥1 tài liệu Công khai (tên A→Z, tối đa 200) +
 * các id đang ghim (kể cả đã hết hợp lệ, `eligible:false`) để admin gỡ. Chỉ thông tin công khai (tên/slug/số tài liệu
 * Công khai) — không đọc gì của đơn hàng/khách (§7.9). Caller phải `requireRole("SYSTEM_ADMIN")`.
 */
export async function listHomeTenantOptions(query: HomePinOptionsQuery = {}): Promise<HomeTenantOption[]> {
  const search = normalizeSearch(query.search);
  const includeIds = [...new Set(query.includeIds ?? [])].slice(0, HOME_PINNED_MAX);

  return withPublic(async (tx) => {
    const select = {
      id: true,
      name: true,
      slug: true,
      status: true,
      _count: { select: { products: { where: { status: "PUBLISHED" as const } } } },
    } as const;
    const [eligibleRows, pinnedRows] = await Promise.all([
      tx.tenant.findMany({
        where: {
          status: "ACTIVE",
          products: { some: { status: "PUBLISHED" } },
          ...(search ? { name: { contains: search, mode: "insensitive" as const } } : {}),
        },
        select,
        orderBy: { name: "asc" },
        take: HOME_PIN_OPTIONS_MAX,
      }),
      includeIds.length ? tx.tenant.findMany({ where: { id: { in: includeIds } }, select }) : Promise.resolve([]),
    ]);

    const byId = new Map<string, HomeTenantOption>();
    for (const row of [...orderByPinned(pinnedRows, includeIds), ...eligibleRows]) {
      if (byId.has(row.id)) continue;
      const productCount = row._count.products;
      byId.set(row.id, {
        id: row.id,
        name: row.name,
        slug: row.slug,
        productCount,
        eligible: row.status === "ACTIVE" && productCount > 0,
      });
    }
    return [...byId.values()];
  });
}

/**
 * Tài liệu cho ô ghim "Tài liệu nổi bật": tài liệu Công khai (mới nhất trước, tối đa 200), lọc theo tên nếu có, + các
 * id đang ghim còn Công khai. Id ghim không có trong kết quả = không còn Công khai (RLS public không cho đọc bản
 * nháp — admin không xem được tài liệu riêng tư của tenant, §7.9) → UI hiện "không còn công khai" để gỡ.
 * Caller phải `requireRole("SYSTEM_ADMIN")`.
 */
export async function listHomeProductOptions(query: HomePinOptionsQuery = {}): Promise<HomeProductOption[]> {
  const search = normalizeSearch(query.search);
  const includeIds = [...new Set(query.includeIds ?? [])].slice(0, HOME_PINNED_MAX);
  const select = { id: true, title: true, tenant: { select: { name: true, slug: true } } } as const;

  const rows = await withPublic(async (tx) => {
    const [latest, pinned] = await Promise.all([
      tx.product.findMany({
        where: { ...PUBLIC_PRODUCT_WHERE, ...(search ? { title: { contains: search, mode: "insensitive" as const } } : {}) },
        select,
        orderBy: [{ createdAt: "desc" }, { id: "asc" }],
        take: HOME_PIN_OPTIONS_MAX,
      }),
      includeIds.length ? tx.product.findMany({ where: { ...PUBLIC_PRODUCT_WHERE, id: { in: includeIds } }, select }) : Promise.resolve([]),
    ]);
    return [...orderByPinned(pinned, includeIds), ...latest];
  });

  const byId = new Map<string, HomeProductOption>();
  for (const row of rows) {
    if (byId.has(row.id)) continue;
    byId.set(row.id, { id: row.id, title: row.title, tenantName: row.tenant.name, tenantSlug: row.tenant.slug });
  }
  return [...byId.values()];
}
