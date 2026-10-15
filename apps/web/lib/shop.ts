import { cache } from "react";
import { z } from "zod";
import {
  computeRatingAverage,
  defaultShopSections,
  logger,
  parseShopSections,
  productPath,
  productTypeLabel,
  SHOP_CMS_SLUG,
  type ShopSection,
  type ShopSectionData,
  type ShopSectionType,
} from "@gieochu/core";
import { getPrismaClient, Prisma, withPublic, withSystemJob, type Tx } from "@gieochu/db";
import {
  fillProductIdsQuery,
  orderByPinned,
  PUBLIC_PRODUCT_WHERE,
  tenantLogoUrl,
  type HomeFeaturedProduct,
  type HomeFeaturedTenant,
} from "./home";
import { getPublicBucketBaseUrl } from "./product-cover";
import type { CurrentUser } from "./session";
import { PUBLIC_PRODUCT_SELECT, toPublicProducts, type PublicProductRow } from "./storefront";

/**
 * ADR-035 GĐ2 — loader trang Cửa hàng `/cua-hang` và trang tìm `/cua-hang/tai-lieu` (kế hoạch
 * `docs/ke-hoach-cua-hang-marketplace-2026-10-15.md` §4.2–4.4).
 *
 * Cổng dữ liệu:
 *  - Sản phẩm/đánh giá/đếm theo danh mục/aggregate tenant: **chỉ** trong `withPublic` (RLS `products` public ⇒
 *    PUBLISHED là cổng thật). "Công khai" = PUBLISHED **và** tenant ACTIVE (`PUBLIC_PRODUCT_WHERE`).
 *  - Không đọc `orders/order_items/entitlements` ở scope public (§7.9). Ngoại lệ duy nhất: `getTenantSales30d`
 *    chạy dưới `withSystemJob`, chỉ trả số đếm theo tenant (ADR-035 mục 4) — dùng để XẾP HẠNG gian hàng, không
 *    hiển thị công khai (chủ dự án chốt 2026-10-15).
 *  - `cms_pages`, `tenants` (tra chủ gian hàng) là L1 → `getPrismaClient()`.
 *  - Giá hiệu lực (khuyến mãi theo khung giờ) luôn tính lúc render qua `toPublicProducts` — không cache giá.
 */

// ───────────────────────── Kiểu dữ liệu (contract §4.2 — Phong dựng UI theo đây) ─────────────────────────

export interface ShopProduct extends HomeFeaturedProduct {
  /** Nhãn loại tài liệu tiếng Việt (`productTypeLabel`, @gieochu/core). */
  typeLabel: string;
}

export interface ShopCategory {
  id: string;
  slug: string;
  name: string;
  /** `DocumentCategory.imageUrl`; null → UI dùng icon mặc định. */
  imageUrl: string | null;
  /** Số tài liệu Công khai trong danh mục. */
  productCount: number;
}

export interface ShopCategoryShelf {
  category: ShopCategory;
  products: ShopProduct[];
  /** `/cua-hang/tai-lieu?danh-muc={slug}`. */
  href: string;
}

export interface ShopFeaturedTenant extends HomeFeaturedTenant {
  /**
   * Số bán 30 ngày — **chỉ dùng xếp hạng, UI KHÔNG hiển thị** (chủ dự án chốt 2026-10-15; thẻ hiện `soldCount` +
   * sao). Chế độ SALES_30D: số ≥ 0; chế độ TOP_RATED: null.
   */
  sales30d: number | null;
}

export const SHOP_SORTS = ["noi-bat", "ban-chay", "danh-gia-cao", "moi-nhat"] as const;
export type ShopSort = (typeof SHOP_SORTS)[number];
export const SHOP_DEFAULT_SORT: ShopSort = "noi-bat";

export const SHOP_SORT_LABELS: Record<ShopSort, string> = {
  "noi-bat": "Nổi bật",
  "ban-chay": "Bán chạy",
  "danh-gia-cao": "Đánh giá cao",
  "moi-nhat": "Mới nhất",
};

export interface ShopPageData {
  /** Đã parse, chỉ section `visible`, đúng thứ tự CMS. */
  sections: ShopSection[];
  heroChips: ShopCategory[];
  categories: ShopCategory[];
  featured: ShopProduct[];
  byCategory: ShopCategoryShelf[];
  bestSellers: ShopProduct[];
  topRated: ShopProduct[];
  featuredTenants: ShopFeaturedTenant[];
  newest: ShopProduct[];
  /** false với người đang là chủ một gian hàng. */
  showOpenStoreCta: boolean;
}

export interface ShopHeroAndCategories {
  heroChips: ShopCategory[];
  categories: ShopCategory[];
}

export interface ShopProductShelves {
  featured: ShopProduct[];
  byCategory: ShopCategoryShelf[];
  bestSellers: ShopProduct[];
  topRated: ShopProduct[];
  newest: ShopProduct[];
}

/** Số thẻ mỗi trang của `/cua-hang/tai-lieu` (đề xuất Phong). */
export const SHOP_SEARCH_PAGE_SIZE = 24;
/** Độ dài tối đa từ khoá tìm (§4.1). */
export const SHOP_SEARCH_Q_MAX = 100;

export interface ShopSearchInput {
  q?: string;
  categorySlug?: string;
  sort: ShopSort;
  page: number;
  pageSize: typeof SHOP_SEARCH_PAGE_SIZE;
}

export interface ShopSearchResult {
  items: ShopProduct[];
  total: number;
  /** Trang thực tế đã trả (đã kẹp về 1…pageCount). */
  page: number;
  /** ≥ 1 (0 kết quả vẫn là 1 trang rỗng). */
  pageCount: number;
  /** Danh mục đang lọc; null = không lọc (không truyền, slug không tồn tại hoặc danh mục đã tắt). */
  category: ShopCategory | null;
}

// ───────────────────────── Đường dẫn ─────────────────────────

export const SHOP_PATH = "/cua-hang";
export const SHOP_SEARCH_PATH = "/cua-hang/tai-lieu";

/** Dựng `/cua-hang/tai-lieu?...` — bỏ tham số mặc định/trống (`sap-xep=noi-bat`, `trang=1`). */
export function shopSearchHref(params: { q?: string; categorySlug?: string; sort?: ShopSort; page?: number } = {}): string {
  const search = new URLSearchParams();
  if (params.q?.trim()) search.set("q", params.q.trim());
  if (params.categorySlug) search.set("danh-muc", params.categorySlug);
  if (params.sort && params.sort !== SHOP_DEFAULT_SORT) search.set("sap-xep", params.sort);
  if (params.page && params.page > 1) search.set("trang", String(Math.trunc(params.page)));
  const query = search.toString();
  return query ? `${SHOP_SEARCH_PATH}?${query}` : SHOP_SEARCH_PATH;
}

// ───────────────────────── searchParams của /cua-hang/tai-lieu ─────────────────────────

/** Chuẩn hoá từ khoá: NFC, trim, cắt 100 ký tự; rỗng → undefined. */
export function normalizeShopQuery(value: string | undefined | null): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = value.normalize("NFC").trim().slice(0, SHOP_SEARCH_Q_MAX).trim();
  return normalized.length > 0 ? normalized : undefined;
}

const firstValue = (value: unknown): unknown => (Array.isArray(value) ? value[0] : value);

/**
 * Parse phòng thủ `searchParams` (không bao giờ ném): `q` → `normalizeShopQuery`; `danh-muc` → slug dạng
 * `[a-z0-9-]` ≤100 ký tự, sai → bỏ (việc danh mục có tồn tại/đang bật do `searchShopProducts` quyết); `sap-xep`
 * lạ → `noi-bat`; `trang` không phải số nguyên ≥1 → 1 (vượt số trang → `searchShopProducts` kẹp về trang cuối).
 */
export const shopSearchParamsSchema = z.object({
  q: z.preprocess(firstValue, z.string().optional().catch(undefined)).transform((v) => normalizeShopQuery(v)),
  "danh-muc": z.preprocess(
    firstValue,
    z
      .string()
      .trim()
      .toLowerCase()
      .max(100)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .optional()
      .catch(undefined),
  ),
  "sap-xep": z.preprocess(firstValue, z.enum(SHOP_SORTS).catch(SHOP_DEFAULT_SORT)),
  trang: z.preprocess(firstValue, z.coerce.number().int().min(1).catch(1)),
});

export interface ShopSearchParams {
  q: string | undefined;
  categorySlug: string | undefined;
  sort: ShopSort;
  page: number;
}

export function parseShopSearchParams(searchParams: Record<string, string | string[] | undefined>): ShopSearchParams {
  const parsed = shopSearchParamsSchema.safeParse(searchParams ?? {});
  if (!parsed.success) return { q: undefined, categorySlug: undefined, sort: SHOP_DEFAULT_SORT, page: 1 };
  return { q: parsed.data.q, categorySlug: parsed.data["danh-muc"], sort: parsed.data["sap-xep"], page: parsed.data.trang };
}

// ───────────────────────── Cấu hình CMS ─────────────────────────

/**
 * Dòng `CmsPage` slug `shop` (L1) — đọc một lần mỗi request (`cache()`), dùng chung cho section + SEO.
 */
const loadShopCmsPage = cache(async function loadShopCmsPage() {
  return getPrismaClient().cmsPage.findUnique({
    where: { slug: SHOP_CMS_SLUG },
    select: { blocks: true, status: true, seoTitle: true, seoDescription: true },
  });
});

/**
 * Section hiển thị của `/cua-hang`: bản live (`blocks`) của `CmsPage` slug `shop` khi đã PUBLISHED; chưa có dòng /
 * chưa xuất bản / JSON không đọc được → cấu hình mặc định (ADR-035 bổ sung — không 404). Chỉ trả section `visible`.
 * `cache()` gộp trong một request (page + generateMetadata).
 */
export const getShopCmsSections = cache(async function getShopCmsSections(): Promise<ShopSection[]> {
  const page = await loadShopCmsPage();
  const live = page?.status === "PUBLISHED" ? parseShopSections(page.blocks) : null;
  if (page?.status === "PUBLISHED" && !live) {
    logger.warn({ slug: SHOP_CMS_SLUG }, "shop: blocks bản live không đọc được, dùng cấu hình mặc định");
  }
  return (live ?? defaultShopSections()).filter((section) => section.visible);
});

export interface ShopSeo {
  /** `CmsPage.seoTitle` (slug `shop`, đã PUBLISHED); trống/chưa có → null. Chưa ghép tên thương hiệu. */
  title: string | null;
  /** `CmsPage.seoDescription`; trống/chưa có → null. */
  description: string | null;
  /** Tiêu đề section hero (bản live hoặc mặc định); hero đang ẩn → null. */
  heroTitle: string | null;
}

const blankToNull = (value: string | null | undefined): string | null => {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
};

/**
 * SEO của `/cua-hang` cho `generateMetadata`. Chỉ lấy `seoTitle/seoDescription` khi dòng đã PUBLISHED (dòng chưa
 * xuất bản = đang soạn, không lộ ra ngoài). Route tự ghép tên thương hiệu qua `getEffectiveBrand()`.
 */
export async function getShopSeo(): Promise<ShopSeo> {
  const [page, sections] = await Promise.all([loadShopCmsPage(), getShopCmsSections()]);
  const published = page?.status === "PUBLISHED";
  return {
    title: published ? blankToNull(page.seoTitle) : null,
    description: published ? blankToNull(page.seoDescription) : null,
    heroTitle: blankToNull(sectionData(sections, "hero")?.title),
  };
}

type ShopDataByType = { [K in ShopSectionType]: ShopSectionData<K> };

function sectionData<T extends ShopSectionType>(sections: readonly ShopSection[], type: T): ShopDataByType[T] | null {
  const section = sections.find((s) => s.type === type);
  // TS không thu hẹp union theo generic `T`; `type` đã khớp nên ép kiểu an toàn.
  return section ? (section.data as ShopDataByType[T]) : null;
}

// ───────────────────────── Số liệu hero ─────────────────────────

export interface ShopHeroStats {
  /** Số tài liệu Công khai (PUBLISHED + tenant ACTIVE). */
  productCount: number;
  /** Số tenant ACTIVE có ≥1 tài liệu Công khai. */
  tenantCount: number;
}

/** Hai phép đếm nhẹ trong một `withPublic` (một transaction). */
export async function getShopHeroStats(): Promise<ShopHeroStats> {
  return withPublic(async (tx) => {
    const productCount = await tx.product.count({ where: PUBLIC_PRODUCT_WHERE });
    const tenantCount = await tx.tenant.count({
      where: { status: "ACTIVE", products: { some: { status: "PUBLISHED" } } },
    });
    return { productCount, tenantCount };
  });
}

// ───────────────────────── Danh mục ─────────────────────────

/** Danh mục `isActive` có ≥1 tài liệu Công khai — số tài liệu ↓, rồi tên (giống `getHomeSearchCategories`). */
async function loadShopCategories(tx: Tx): Promise<ShopCategory[]> {
  const rows = await tx.documentCategory.findMany({
    where: { isActive: true, products: { some: PUBLIC_PRODUCT_WHERE } },
    select: {
      id: true,
      slug: true,
      name: true,
      imageUrl: true,
      _count: { select: { products: { where: PUBLIC_PRODUCT_WHERE } } },
    },
  });
  return rows
    .map((row) => ({ id: row.id, slug: row.slug, name: row.name, imageUrl: row.imageUrl, productCount: row._count.products }))
    .filter((row) => row.productCount > 0)
    .sort((a, b) => b.productCount - a.productCount || a.name.localeCompare(b.name, "vi"));
}

/** AUTO: `max` danh mục đầu theo số tài liệu; MANUAL: `categoryIds` theo thứ tự (bỏ id tắt/không còn tài liệu), tối đa `max`. */
function pickCategories(
  all: readonly ShopCategory[],
  pick: { mode: "AUTO" | "MANUAL"; categoryIds: readonly string[] },
  max: number,
): ShopCategory[] {
  if (pick.mode === "AUTO") return all.slice(0, max);
  const byId = new Map(all.map((c) => [c.id, c]));
  return pick.categoryIds.flatMap((id) => {
    const category = byId.get(id);
    return category ? [category] : [];
  }).slice(0, max);
}

/** Nhóm Suspense 1: chip hero + lưới danh mục. Section tắt → mảng rỗng (không truy vấn nếu cả hai tắt). */
export async function getShopHeroAndCategories(sections: readonly ShopSection[]): Promise<ShopHeroAndCategories> {
  const hero = sectionData(sections, "hero");
  const categoriesSection = sectionData(sections, "categories");
  if (!hero && !categoriesSection) return { heroChips: [], categories: [] };

  const all = await withPublic(loadShopCategories);
  return {
    heroChips: hero ? pickCategories(all, hero.popularChips, hero.popularChips.max) : [],
    categories: categoriesSection ? all : [],
  };
}

// ───────────────────────── Kệ tài liệu ─────────────────────────

const PUBLIC_PRODUCT_FROM = Prisma.sql`
  FROM "products" p
  JOIN "tenants" t ON t."id" = p."tenantId"
  WHERE p."status" = 'PUBLISHED' AND t."status" = 'ACTIVE'
`;

/** Có đánh giá trước → điểm TB ↓ → số đánh giá ↓ (cùng thứ tự `fillProductIdsQuery`, ADR-033). */
const RATING_ORDER = Prisma.sql`
  (p."ratingCount" > 0) DESC,
  p."ratingSum"::numeric / NULLIF(p."ratingCount", 0) DESC NULLS LAST,
  p."ratingCount" DESC
`;

const BEST_SELLER_ORDER = Prisma.sql`p."soldCount" DESC, p."ratingCount" DESC, p."createdAt" DESC, p."id"`;
const TOP_RATED_ORDER = Prisma.sql`p."ratingSum"::numeric / NULLIF(p."ratingCount", 0) DESC NULLS LAST, p."ratingCount" DESC, p."createdAt" DESC, p."id"`;
const NEWEST_ORDER = Prisma.sql`p."createdAt" DESC, p."id"`;
const FEATURED_ORDER = Prisma.sql`${RATING_ORDER}, p."createdAt" DESC, p."id"`;

async function queryIds(tx: Tx, query: Prisma.Sql): Promise<string[]> {
  return (await tx.$queryRaw<{ id: string }[]>(query)).map((row) => row.id);
}

/** Nổi bật: ghim (còn Công khai, đúng thứ tự) rồi bù như `fillProductIdsQuery` cho đủ `limit`. */
async function featuredIds(tx: Tx, data: ShopSectionData<"featured">): Promise<string[]> {
  const pinned = [...new Set(data.pinnedProductIds)].slice(0, data.limit);
  const valid = pinned.length
    ? new Set((await tx.product.findMany({ where: { ...PUBLIC_PRODUCT_WHERE, id: { in: pinned } }, select: { id: true } })).map((r) => r.id))
    : new Set<string>();
  const pinnedIds = pinned.filter((id) => valid.has(id));
  const remaining = data.limit - pinnedIds.length;
  const fill = remaining > 0 ? await queryIds(tx, fillProductIdsQuery(pinnedIds, remaining)) : [];
  return [...pinnedIds, ...fill];
}

/**
 * Theo danh mục: một truy vấn `ROW_NUMBER() OVER (PARTITION BY categoryId)`, mỗi khối ≤ `cards` thẻ, xếp bán chạy →
 * điểm → mới nhất (ADR-035 bổ sung). Trả `Map<categoryId, productId[]>`.
 */
async function byCategoryIds(tx: Tx, categoryIds: readonly string[], cards: number): Promise<Map<string, string[]>> {
  const result = new Map<string, string[]>();
  if (categoryIds.length === 0) return result;
  const rows = await tx.$queryRaw<{ id: string; categoryId: string }[]>(Prisma.sql`
    SELECT r."id", r."categoryId"
    FROM (
      SELECT p."id", p."categoryId",
        ROW_NUMBER() OVER (
          PARTITION BY p."categoryId"
          ORDER BY p."soldCount" DESC, ${RATING_ORDER}, p."createdAt" DESC, p."id"
        ) AS rn
      ${PUBLIC_PRODUCT_FROM}
        AND p."categoryId" IN (${Prisma.join(categoryIds)})
    ) r
    WHERE r.rn <= ${cards}::int
    ORDER BY r."categoryId", r.rn
  `);
  for (const row of rows) {
    const list = result.get(row.categoryId) ?? [];
    list.push(row.id);
    result.set(row.categoryId, list);
  }
  return result;
}

interface ShelfIds {
  featured: string[];
  byCategory: { category: ShopCategory; ids: string[] }[];
  bestSellers: string[];
  topRated: string[];
  newest: string[];
}

/**
 * Nhóm Suspense 2: các kệ tài liệu. Một `withPublic`: lấy id từng kệ (truy vấn nhẹ), gom id duy nhất, **một**
 * `findMany` chi tiết; `toPublicProducts` một lần (giá hiệu lực tính sau truy vấn). Một tài liệu được ở nhiều kệ.
 * Section tắt → kệ rỗng, không truy vấn.
 */
export async function getShopProductShelves(sections: readonly ShopSection[]): Promise<ShopProductShelves> {
  const featured = sectionData(sections, "featured");
  const byCategory = sectionData(sections, "byCategory");
  const bestSellers = sectionData(sections, "bestSellers");
  const topRated = sectionData(sections, "topRated");
  const newest = sectionData(sections, "newest");
  const empty: ShopProductShelves = { featured: [], byCategory: [], bestSellers: [], topRated: [], newest: [] };
  if (!featured && !byCategory && !bestSellers && !topRated && !newest) return empty;

  const { ids, rows } = await withPublic(async (tx) => {
    const shelf: ShelfIds = { featured: [], byCategory: [], bestSellers: [], topRated: [], newest: [] };

    if (featured) shelf.featured = await featuredIds(tx, featured);
    if (byCategory) {
      const blocks = pickCategories(await loadShopCategories(tx), byCategory, byCategory.blockCount);
      const idsByCategory = await byCategoryIds(
        tx,
        blocks.map((c) => c.id),
        byCategory.cardsPerBlock,
      );
      shelf.byCategory = blocks.map((category) => ({ category, ids: idsByCategory.get(category.id) ?? [] }));
    }
    if (bestSellers) {
      shelf.bestSellers = await queryIds(
        tx,
        Prisma.sql`SELECT p."id" ${PUBLIC_PRODUCT_FROM} AND p."soldCount" > 0 ORDER BY ${BEST_SELLER_ORDER} LIMIT ${bestSellers.limit}::int`,
      );
    }
    if (topRated) {
      // So sánh số nguyên (ADR-035 mục 3): ratingSum*10 ≥ minAvgTenths*ratingCount — không float.
      shelf.topRated = await queryIds(
        tx,
        Prisma.sql`SELECT p."id" ${PUBLIC_PRODUCT_FROM}
          AND p."ratingCount" >= ${topRated.minReviews}::int
          AND p."ratingSum" * 10 >= ${topRated.minAvgTenths}::int * p."ratingCount"
          ORDER BY ${TOP_RATED_ORDER} LIMIT ${topRated.limit}::int`,
      );
    }
    if (newest) {
      shelf.newest = await queryIds(tx, Prisma.sql`SELECT p."id" ${PUBLIC_PRODUCT_FROM} ORDER BY ${NEWEST_ORDER} LIMIT ${newest.limit}::int`);
    }

    const unique = [
      ...new Set([...shelf.featured, ...shelf.byCategory.flatMap((b) => b.ids), ...shelf.bestSellers, ...shelf.topRated, ...shelf.newest]),
    ];
    const found = unique.length
      ? await tx.product.findMany({
          where: { ...PUBLIC_PRODUCT_WHERE, id: { in: unique } },
          select: { ...PUBLIC_PRODUCT_SELECT, tenant: { select: { slug: true, name: true } } },
        })
      : [];
    return { ids: shelf, rows: found };
  });

  const byId = await toShopProductMap(rows);
  const resolve = (list: readonly string[]): ShopProduct[] =>
    list.flatMap((id) => {
      const product = byId.get(id);
      return product ? [product] : [];
    });

  return {
    featured: resolve(ids.featured),
    byCategory: ids.byCategory
      .map(({ category, ids: blockIds }) => ({ category, products: resolve(blockIds), href: shopSearchHref({ categorySlug: category.slug }) }))
      .filter((block) => block.products.length > 0),
    bestSellers: resolve(ids.bestSellers),
    topRated: resolve(ids.topRated),
    newest: resolve(ids.newest),
  };
}

type ShopProductRow = PublicProductRow & { tenant: { slug: string; name: string } };

async function toShopProductMap(rows: ShopProductRow[]): Promise<Map<string, ShopProduct>> {
  const products = await toPublicProducts(rows);
  const map = new Map<string, ShopProduct>();
  products.forEach((product, index) => {
    const tenant = rows[index]!.tenant;
    map.set(product.id, {
      ...product,
      tenant,
      href: productPath(tenant.slug, product.slug),
      typeLabel: productTypeLabel(product.type),
    });
  });
  return map;
}

// ───────────────────────── Số bán 30 ngày theo tenant (system_job) ─────────────────────────

const SALES_30D_TTL_MS = 5 * 60 * 1000;
let sales30dCache: { value: ReadonlyMap<string, number>; expiresAt: number } | null = null;
let sales30dInflight: Promise<ReadonlyMap<string, number>> | null = null;

/**
 * Toàn bộ số đếm 30 ngày theo tenant — dòng `order_items` của đơn FULFILLED có `paidAt` trong 30 ngày, loại dòng có
 * entitlement đã thu hồi (cùng công thức `recomputeProductSoldCounts`; đơn REFUNDED không phải FULFILLED nên không
 * tính). Cache trong bộ nhớ theo khoá cố định (mỗi instance server), TTL 5 phút.
 */
async function loadAllTenantSales30d(): Promise<ReadonlyMap<string, number>> {
  const now = Date.now();
  if (sales30dCache && sales30dCache.expiresAt > now) return sales30dCache.value;
  if (sales30dInflight) return sales30dInflight;

  sales30dInflight = withSystemJob((tx) =>
    tx.$queryRaw<{ tenantId: string; sales: number }[]>(Prisma.sql`
      SELECT o."tenantId", COUNT(oi."id")::int AS "sales"
      FROM "orders" o
      JOIN "order_items" oi ON oi."orderId" = o."id"
      WHERE o."status" = 'FULFILLED'
        AND o."paidAt" >= now() - interval '30 days'
        AND NOT EXISTS (
          SELECT 1 FROM "entitlements" e
          WHERE e."orderItemId" = oi."id" AND e."revokedAt" IS NOT NULL
        )
      GROUP BY o."tenantId"
    `),
  )
    .then((rows) => {
      const value = new Map(rows.map((row) => [row.tenantId, row.sales]));
      sales30dCache = { value, expiresAt: Date.now() + SALES_30D_TTL_MS };
      return value as ReadonlyMap<string, number>;
    })
    .finally(() => {
      sales30dInflight = null;
    });
  return sales30dInflight;
}

/**
 * ADR-035 mục 4 — số bán 30 ngày của các tenant **đã được server lọc** (tenant Công khai), không nhận tham số từ
 * client. Chỉ trả `Map<tenantId, number>` (không có tenant trong map = 0). Không dùng cho route admin (§7.9).
 * Lỗi DB → log và trả map rỗng (xếp hạng rơi về tổng đã bán → đánh giá → mới; trang không vỡ), không cache lỗi.
 */
export async function getTenantSales30d(tenantIds: readonly string[]): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (tenantIds.length === 0) return result;
  let all: ReadonlyMap<string, number>;
  try {
    all = await loadAllTenantSales30d();
  } catch (error) {
    logger.error({ err: error }, "shop: tính số bán 30 ngày theo gian hàng thất bại");
    return result;
  }
  for (const id of new Set(tenantIds)) {
    const sales = all.get(id);
    if (sales && sales > 0) result.set(id, sales);
  }
  return result;
}

// ───────────────────────── Gian hàng nổi bật ─────────────────────────

interface ShopTenantRow {
  id: string;
  slug: string;
  name: string;
  logoKey: string | null;
  productCount: number;
  ratingSum: number;
  ratingCount: number;
  soldCount: number;
}

const TENANT_AGG_SELECT = Prisma.sql`
  SELECT t."id", t."slug", t."name", t."logoKey",
    COUNT(p."id")::int AS "productCount",
    COALESCE(SUM(p."ratingSum"), 0)::int AS "ratingSum",
    COALESCE(SUM(p."ratingCount"), 0)::int AS "ratingCount",
    COALESCE(SUM(p."soldCount"), 0)::int AS "soldCount"
  FROM "tenants" t
  JOIN "products" p ON p."tenantId" = t."id" AND p."status" = 'PUBLISHED'
`;

const TENANT_RATING_ORDER = Prisma.sql`
  SUM(p."ratingSum")::numeric / NULLIF(SUM(p."ratingCount"), 0) DESC NULLS LAST,
  SUM(p."ratingCount") DESC
`;

function excludeTenants(ids: readonly string[]): Prisma.Sql {
  return ids.length ? Prisma.sql`AND t."id" NOT IN (${Prisma.join(ids)})` : Prisma.empty;
}

/**
 * SALES_30D: bán 30 ngày ↓ → tổng đã bán ↓ → điểm TB ↓ → số đánh giá ↓ → tenant mới ↓ (tenant chưa bán trong 30 ngày
 * tự thành phần bù — ADR-035 bổ sung). Số 30 ngày (do server tính) truyền vào dưới dạng bảng `VALUES` tham số hoá.
 */
function salesRankedTenantQuery(sales: ReadonlyMap<string, number>, exclude: readonly string[], take: number): Prisma.Sql {
  const entries = [...sales.entries()];
  const salesJoin = entries.length
    ? Prisma.sql`LEFT JOIN (VALUES ${Prisma.join(entries.map(([id, n]) => Prisma.sql`(${id}, ${n}::int)`))}) AS s("tenantId", "sales") ON s."tenantId" = t."id"`
    : Prisma.sql`LEFT JOIN (SELECT NULL::text AS "tenantId", 0 AS "sales" WHERE false) AS s ON s."tenantId" = t."id"`;
  return Prisma.sql`
    ${TENANT_AGG_SELECT}
    ${salesJoin}
    WHERE t."status" = 'ACTIVE' ${excludeTenants(exclude)}
    GROUP BY t."id", s."sales"
    ORDER BY COALESCE(s."sales", 0) DESC,
      SUM(p."soldCount") DESC,
      ${TENANT_RATING_ORDER},
      t."createdAt" DESC,
      t."id"
    LIMIT ${take}::int
  `;
}

/** TOP_RATED: tổng số đánh giá ≥ `minReviews`; điểm TB tổng ↓ → số đánh giá ↓ → tenant mới ↓. Không bù tenant chưa đạt. */
function topRatedTenantQuery(minReviews: number, exclude: readonly string[], take: number): Prisma.Sql {
  return Prisma.sql`
    ${TENANT_AGG_SELECT}
    WHERE t."status" = 'ACTIVE' ${excludeTenants(exclude)}
    GROUP BY t."id"
    HAVING SUM(p."ratingCount") >= ${minReviews}::int
    ORDER BY ${TENANT_RATING_ORDER}, t."createdAt" DESC, t."id"
    LIMIT ${take}::int
  `;
}

/**
 * Nhóm Suspense 3: gian hàng nổi bật — tenant ACTIVE có ≥1 tài liệu Công khai; ghim trước (đúng thứ tự, bỏ id không
 * còn hợp lệ), rồi xếp theo chế độ CMS cho đủ `limit`.
 */
export async function getShopFeaturedTenants(sections: readonly ShopSection[]): Promise<ShopFeaturedTenant[]> {
  const data = sectionData(sections, "featuredTenants");
  if (!data) return [];
  const limit = data.limit;
  const pinned = [...new Set(data.pinnedTenantIds)].slice(0, limit);

  // Bước 1 (public): tenant ghim hợp lệ + danh sách id tenant Công khai (để hỏi số 30 ngày đúng tập đã lọc).
  const { pinnedRows, eligibleIds } = await withPublic(async (tx) => {
    const pinnedFound = pinned.length
      ? await tx.$queryRaw<ShopTenantRow[]>(Prisma.sql`
          ${TENANT_AGG_SELECT}
          WHERE t."status" = 'ACTIVE' AND t."id" IN (${Prisma.join(pinned)})
          GROUP BY t."id"
        `)
      : [];
    const eligible =
      data.mode === "SALES_30D"
        ? await queryIds(
            tx,
            Prisma.sql`SELECT t."id" FROM "tenants" t WHERE t."status" = 'ACTIVE'
              AND EXISTS (SELECT 1 FROM "products" p WHERE p."tenantId" = t."id" AND p."status" = 'PUBLISHED')`,
          )
        : [];
    return { pinnedRows: orderByPinned(pinnedFound, pinned), eligibleIds: eligible };
  });

  // Bước 2 (system_job, có cache): số bán 30 ngày — chỉ cho tenant đã lọc ở bước 1.
  const sales = data.mode === "SALES_30D" ? await getTenantSales30d([...new Set([...pinnedRows.map((r) => r.id), ...eligibleIds])]) : null;

  // Bước 3 (public): bù cho đủ `limit`.
  const remaining = limit - pinnedRows.length;
  const exclude = pinnedRows.map((r) => r.id);
  const fill =
    remaining > 0
      ? await withPublic((tx) =>
          tx.$queryRaw<ShopTenantRow[]>(
            sales ? salesRankedTenantQuery(sales, exclude, remaining) : topRatedTenantQuery(data.minReviews, exclude, remaining),
          ),
        )
      : [];

  const rows = [...pinnedRows, ...fill];
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
    sales30d: sales ? (sales.get(row.id) ?? 0) : null,
  }));
}

// ───────────────────────── CTA mở gian hàng ─────────────────────────

/**
 * Ẩn CTA "Mở gian hàng" với người đã là chủ một gian hàng (`tenants.ownerId`, L1 — cùng cách `resolveLandingPath`).
 * Giới hạn: thành viên STAFF chưa được xét — `tenant_members` có RLS chỉ cho scope tenant/system_job và hiện chưa có
 * luồng nào tạo STAFF.
 */
export async function shouldShowOpenStoreCta(viewer: Pick<CurrentUser, "userId"> | null): Promise<boolean> {
  if (!viewer) return true;
  const owned = await getPrismaClient().tenant.findUnique({ where: { ownerId: viewer.userId }, select: { id: true } });
  return owned === null;
}

// ───────────────────────── Gộp cho trang `/cua-hang` ─────────────────────────

/** Tiện ích gộp (không Suspense): chạy song song 3 nhóm + CTA. `sections` lấy từ `getShopCmsSections()`. */
export async function getShopPageData(sections: ShopSection[], viewer: CurrentUser | null): Promise<ShopPageData> {
  const hasCta = sections.some((s) => s.type === "ctaOpenStore");
  const [heroAndCategories, shelves, featuredTenants, showOpenStoreCta] = await Promise.all([
    getShopHeroAndCategories(sections),
    getShopProductShelves(sections),
    getShopFeaturedTenants(sections),
    hasCta ? shouldShowOpenStoreCta(viewer) : Promise.resolve(false),
  ]);
  return { sections, ...heroAndCategories, ...shelves, featuredTenants, showOpenStoreCta };
}

// ───────────────────────── Tìm kiếm `/cua-hang/tai-lieu` ─────────────────────────

const LIKE_ESCAPE = "\\";

/** Escape ký tự đặc biệt của LIKE (`\` trước, rồi `%`, `_`) — dùng với `ESCAPE '\'`. */
export function escapeLikePattern(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `${LIKE_ESCAPE}${ch}`);
}

/** `gieochu_unaccent(lower(col)) LIKE '%' || gieochu_unaccent(lower($q)) || '%' ESCAPE '\'` (ADR-035 mục 5). */
function unaccentLike(column: Prisma.Sql, escapedQuery: string): Prisma.Sql {
  return Prisma.sql`public.gieochu_unaccent(lower(${column})) LIKE '%' || public.gieochu_unaccent(lower(${escapedQuery})) || '%' ESCAPE ${LIKE_ESCAPE}`;
}

function searchOrder(sort: ShopSort, titleMatch: Prisma.Sql | null): Prisma.Sql {
  switch (sort) {
    case "ban-chay":
      return BEST_SELLER_ORDER;
    case "danh-gia-cao":
      return TOP_RATED_ORDER;
    case "moi-nhat":
      return NEWEST_ORDER;
    case "noi-bat":
      // Có `q`: khớp tiêu đề trước (ADR-035 bổ sung), rồi như kệ Nổi bật.
      return titleMatch ? Prisma.sql`(CASE WHEN ${titleMatch} THEN 0 ELSE 1 END), ${FEATURED_ORDER}` : FEATURED_ORDER;
  }
}

/**
 * Tìm/lọc/sắp xếp tài liệu Công khai cho `/cua-hang/tai-lieu` — toàn bộ trong một `withPublic`. Khớp không dấu trên
 * tiêu đề, mô tả ngắn, tên gian hàng, tên danh mục (đang bật). `categorySlug` không tồn tại/đã tắt → bỏ lọc,
 * `category: null`. `page` vượt số trang → trang cuối.
 */
export async function searchShopProducts(input: ShopSearchInput): Promise<ShopSearchResult> {
  const q = normalizeShopQuery(input.q);
  const sort: ShopSort = (SHOP_SORTS as readonly string[]).includes(input.sort) ? input.sort : SHOP_DEFAULT_SORT;
  const pageSize = SHOP_SEARCH_PAGE_SIZE;
  const requestedPage = Number.isInteger(input.page) && input.page >= 1 ? input.page : 1;

  const { category, total, page, ids, rows } = await withPublic(async (tx) => {
    const categoryRow = input.categorySlug
      ? await tx.documentCategory.findFirst({
          where: { slug: input.categorySlug, isActive: true },
          select: { id: true, slug: true, name: true, imageUrl: true, _count: { select: { products: { where: PUBLIC_PRODUCT_WHERE } } } },
        })
      : null;
    const category: ShopCategory | null = categoryRow
      ? { id: categoryRow.id, slug: categoryRow.slug, name: categoryRow.name, imageUrl: categoryRow.imageUrl, productCount: categoryRow._count.products }
      : null;

    const escaped = q ? escapeLikePattern(q) : null;
    const titleMatch = escaped ? unaccentLike(Prisma.sql`p."title"`, escaped) : null;
    const conditions: Prisma.Sql[] = [Prisma.sql`p."status" = 'PUBLISHED'`, Prisma.sql`t."status" = 'ACTIVE'`];
    if (category) conditions.push(Prisma.sql`p."categoryId" = ${category.id}`);
    if (escaped && titleMatch) {
      conditions.push(Prisma.sql`(
        ${titleMatch}
        OR ${unaccentLike(Prisma.sql`p."summary"`, escaped)}
        OR ${unaccentLike(Prisma.sql`t."name"`, escaped)}
        OR (c."isActive" AND ${unaccentLike(Prisma.sql`c."name"`, escaped)})
      )`);
    }
    const from = Prisma.sql`
      FROM "products" p
      JOIN "tenants" t ON t."id" = p."tenantId"
      LEFT JOIN "document_categories" c ON c."id" = p."categoryId"
      WHERE ${Prisma.join(conditions, " AND ")}
    `;

    const countRows = await tx.$queryRaw<{ total: number }[]>(Prisma.sql`SELECT COUNT(*)::int AS "total" ${from}`);
    const total = countRows[0]?.total ?? 0;
    const pageCount = Math.max(1, Math.ceil(total / pageSize));
    const page = Math.min(requestedPage, pageCount);
    const ids =
      total > 0
        ? await queryIds(
            tx,
            Prisma.sql`SELECT p."id" ${from} ORDER BY ${searchOrder(sort, titleMatch)} LIMIT ${pageSize}::int OFFSET ${(page - 1) * pageSize}::int`,
          )
        : [];
    const rows = ids.length
      ? await tx.product.findMany({
          where: { ...PUBLIC_PRODUCT_WHERE, id: { in: ids } },
          select: { ...PUBLIC_PRODUCT_SELECT, tenant: { select: { slug: true, name: true } } },
        })
      : [];
    return { category, total, page, ids, rows };
  });

  const byId = await toShopProductMap(rows);
  return {
    items: ids.flatMap((id) => {
      const product = byId.get(id);
      return product ? [product] : [];
    }),
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / pageSize)),
    category,
  };
}
