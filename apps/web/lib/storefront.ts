import { z } from "zod";
import {
  calculateOrderPricing,
  computeRatingAverage,
  defaultStorefrontPostsSection,
  defaultStorefrontReviewsSection,
  defaultStorefrontSections,
  isValidSocialLink,
  logger,
  storefrontSectionsSchema,
  STOREFRONT_PRODUCTS_LIMIT_MAX,
  type SocialLinkKey,
  type StorefrontSection,
} from "@gieochu/core";
import { getPrismaClient, withPublic, type ProductType, type Tenant } from "@gieochu/db";
import { getPublicBucketBaseUrl, resolveProductCoverUrl } from "./product-cover";

/**
 * §4.3 storefront resolution: not tenant-scoped (we don't know the tenant id
 * yet), and RLS is not enabled on `tenants` itself — only child tables like
 * `products` are tenant-scoped/RLS-protected. A plain unique lookup is safe.
 */
export async function findTenantBySlugForStorefront(slug: string) {
  const prisma = getPrismaClient();
  return prisma.tenant.findUnique({ where: { slug } });
}

/** §4.3: resolves a renamed slug (changed ≤ 1×/30 days) to a 301 target. */
export async function findSlugRedirectTarget(oldSlug: string): Promise<string | null> {
  const prisma = getPrismaClient();
  const history = await prisma.tenantSlugHistory.findUnique({
    where: { oldSlug },
    include: { tenant: true },
  });
  return history?.tenant.slug ?? null;
}

function toPublicUrl(publicBaseUrl: string | null, key: string | null): string | null {
  return key && publicBaseUrl ? `${publicBaseUrl}/${key}` : null;
}

export interface PublicProduct {
  id: string;
  slug: string;
  title: string;
  /** ADR-027: mô tả ngắn văn bản thuần (≤300 ký tự) cho thẻ tài liệu; null = chưa có. */
  summary: string | null;
  description: string | null;
  type: ProductType;
  tags: string[];
  /** Giá niêm yết, VND nguyên. */
  priceVnd: number;
  /** Giá áp dụng lúc render (đã tính sale theo khung giờ), VND nguyên — tính ở server bằng calculateOrderPricing. */
  effectivePriceVnd: number;
  /** true khi effectivePriceVnd < priceVnd. */
  onSale: boolean;
  /** ADR-027: ảnh bìa hiệu lực — Cloudinary `coverImageUrl`, fallback R2 `coverImageKey`; null nếu không có. */
  coverUrl: string | null;
  /** ADR-029 mục 3: điểm TB làm tròn 1 chữ số từ cache số nguyên; null khi chưa có đánh giá (thẻ hiện sao từ 1 đánh giá). */
  ratingAvg: number | null;
  ratingCount: number;
}

/**
 * Goes through withPublic so the RLS policy on `products` — which requires
 * app.scope='public' AND status='PUBLISHED' — is the actual gate, not just
 * this query's WHERE clause.
 */
const PUBLIC_PRODUCT_SELECT = {
  id: true,
  slug: true,
  title: true,
  summary: true,
  description: true,
  type: true,
  tags: true,
  coverImageKey: true,
  coverImageUrl: true,
  priceVnd: true,
  salePriceVnd: true,
  saleStartsAt: true,
  saleEndsAt: true,
  ratingSum: true,
  ratingCount: true,
} as const;

interface PublicProductRow {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  description: string | null;
  type: ProductType;
  tags: string[];
  coverImageKey: string | null;
  coverImageUrl: string | null;
  priceVnd: number;
  salePriceVnd: number | null;
  saleStartsAt: Date | null;
  saleEndsAt: Date | null;
  ratingSum: number;
  ratingCount: number;
}

export async function getPublishedProducts(tenantId: string): Promise<PublicProduct[]> {
  const rows = await withPublic((tx) =>
    tx.product.findMany({
      where: { tenantId, status: "PUBLISHED" },
      select: PUBLIC_PRODUCT_SELECT,
      orderBy: { createdAt: "desc" },
    }),
  );
  return toPublicProducts(rows);
}

async function toPublicProducts(rows: PublicProductRow[]): Promise<PublicProduct[]> {
  if (rows.length === 0) return [];

  // Chỉ đọc cấu hình storage khi còn sản phẩm dùng ảnh bìa R2 cũ.
  const publicBaseUrl = rows.some((row) => row.coverImageKey) ? await getPublicBucketBaseUrl() : null;
  const now = new Date();

  return rows.map((row) => {
    // Same pricing path as the product detail page — never a client-supplied price (§7.5).
    const pricing = calculateOrderPricing(
      [
        {
          productId: row.id,
          title: row.title,
          priceVnd: row.priceVnd,
          salePriceVnd: row.salePriceVnd,
          saleStartsAt: row.saleStartsAt,
          saleEndsAt: row.saleEndsAt,
        },
      ],
      null,
      0,
      now,
    );
    const effectivePriceVnd = pricing.lines[0]?.finalPriceVnd ?? row.priceVnd;
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      summary: row.summary,
      description: row.description,
      type: row.type,
      tags: row.tags,
      priceVnd: row.priceVnd,
      effectivePriceVnd,
      onSale: effectivePriceVnd < row.priceVnd,
      coverUrl: resolveProductCoverUrl(row, publicBaseUrl),
      ratingAvg: computeRatingAverage(row.ratingSum, row.ratingCount),
      ratingCount: row.ratingCount,
    };
  });
}

/**
 * ADR-023 — sản phẩm cho section `products` của storefront: các id trong
 * `featuredProductIds` trước (đúng thứ tự tenant chọn, id không còn PUBLISHED
 * bị bỏ qua), sau đó bù bằng sản phẩm PUBLISHED mới nhất cho đủ `limit`.
 * Cả 2 truy vấn trong cùng 1 `withPublic` — RLS `products` (scope public ⇒
 * chỉ PUBLISHED) là cổng thật, WHERE ở đây chỉ để khớp ý nghĩa.
 */
export async function getStorefrontSectionProducts(
  tenantId: string,
  options: { limit: number; featuredProductIds: readonly string[] },
): Promise<PublicProduct[]> {
  const limit = Math.min(Math.max(Math.trunc(options.limit) || 0, 1), STOREFRONT_PRODUCTS_LIMIT_MAX);
  const featuredIds = [...new Set(options.featuredProductIds)].slice(0, limit);

  const rows = await withPublic(async (tx) => {
    const featured = featuredIds.length
      ? await tx.product.findMany({
          where: { tenantId, status: "PUBLISHED", id: { in: featuredIds } },
          select: PUBLIC_PRODUCT_SELECT,
        })
      : [];
    const order = new Map(featuredIds.map((id, index) => [id, index]));
    featured.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const remaining = limit - featured.length;
    const latest =
      remaining > 0
        ? await tx.product.findMany({
            where: { tenantId, status: "PUBLISHED", id: { notIn: featured.map((p) => p.id) } },
            select: PUBLIC_PRODUCT_SELECT,
            orderBy: { createdAt: "desc" },
            take: remaining,
          })
        : [];
    return [...featured, ...latest];
  });
  return toPublicProducts(rows);
}

/**
 * ADR-029 mục 5 (M10b): sản phẩm PUBLISHED theo danh sách id (thẻ sản phẩm gắn trong bài viết) — cùng cổng RLS
 * public và cùng đường tính giá/ảnh bìa hiệu lực như thẻ storefront. Id không còn PUBLISHED bị bỏ qua.
 */
export async function getPublicProductsByIds(tenantId: string, ids: readonly string[]): Promise<PublicProduct[]> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return [];
  const rows = await withPublic((tx) =>
    tx.product.findMany({ where: { tenantId, status: "PUBLISHED", id: { in: unique } }, select: PUBLIC_PRODUCT_SELECT }),
  );
  return toPublicProducts(rows);
}

/** Tối đa sản phẩm PUBLISHED hiển thị trong ô chọn "sản phẩm nổi bật" của Studio editor. */
const FEATURED_PICKER_MAX = 200;

export interface StorefrontProductOption {
  id: string;
  title: string;
}

/** Danh sách sản phẩm PUBLISHED của tenant cho ô chọn "sản phẩm nổi bật" (Studio) — cùng cổng RLS public như storefront. */
export async function listStorefrontProductOptions(tenantId: string): Promise<StorefrontProductOption[]> {
  return withPublic((tx) =>
    tx.product.findMany({
      where: { tenantId, status: "PUBLISHED" },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
      take: FEATURED_PICKER_MAX,
    }),
  );
}

/** §"M8" product detail page — same `withPublic` RLS gate (status='PUBLISHED') as `getPublishedProducts`. */
export async function getPublishedProductBySlug(tenantId: string, slug: string) {
  return withPublic((tx) =>
    tx.product.findFirst({
      where: { tenantId, slug, status: "PUBLISHED" },
    }),
  );
}

export type StorefrontSocialLinks = Partial<Record<SocialLinkKey, string>>;

export interface StorefrontProfile {
  /** URL logo trong bucket public; hiện chưa có luồng upload logoKey nên thực tế luôn null. */
  logoUrl: string | null;
  /** URL ảnh bìa trang; hiện chưa có luồng upload coverKey nên thực tế luôn null. */
  coverUrl: string | null;
  /** Hex `#rrggbb` (chữ thường) hoặc null → UI fallback màu hệ thống. */
  primaryColor: string | null;
  accentColor: string | null;
  /** Chỉ chứa link http(s) hợp lệ, đúng host của từng mạng; key vắng = không hiển thị. */
  socialLinks: StorefrontSocialLinks;
}

const SOCIAL_KEYS: readonly SocialLinkKey[] = ["facebook", "youtube", "tiktok", "zalo", "website"];

const optionalString = z.string().optional().catch(undefined);

/**
 * `Tenant.branding` is tenant-entered JSON — every field is parsed
 * defensively (`.catch`) so one malformed field never drops the rest, and
 * nothing here is trusted until validated below.
 */
const tenantBrandingSchema = z
  .object({
    primaryColor: optionalString,
    accentColor: optionalString,
    socialLinks: z
      .object({
        facebook: optionalString,
        youtube: optionalString,
        tiktok: optionalString,
        zalo: optionalString,
        website: optionalString,
      })
      .optional()
      .catch(undefined),
  })
  .catch({});

const HEX_6 = /^#[0-9a-fA-F]{6}$/;
const HEX_3 = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/;

/** Normalises to `#rrggbb`; the studio form also accepts `#rgb`, which is expanded. Anything else → null. */
function normalizeHexColor(value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (HEX_6.test(v)) return v.toLowerCase();
  const short = HEX_3.exec(v);
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toLowerCase();
  return null;
}

/** Bare Zalo phone number (e.g. "0912 345 678", "+84912345678") — defensive only; the studio form currently requires a zalo.me URL. */
const ZALO_PHONE = /^\+?[0-9][0-9 .-]{7,18}$/;

function normalizeSocialLink(key: SocialLinkKey, value: string | undefined): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (key === "zalo" && ZALO_PHONE.test(v)) {
    const digits = v.replace(/\D/g, "");
    if (digits.length >= 8 && digits.length <= 15) return `https://zalo.me/${digits}`;
    return null;
  }
  // isValidSocialLink: only http:/https: (rejects javascript:, data: ...) and, except `website`, the known host.
  return isValidSocialLink(key, v) ? v : null;
}

/**
 * Plain, UI-ready storefront profile from the tenant row. `tenants` is not
 * RLS-scoped (see findTenantBySlugForStorefront), so this takes the row the
 * page already loaded rather than querying again.
 */
export async function getStorefrontProfile(
  tenant: Pick<Tenant, "logoKey" | "coverKey" | "branding">,
): Promise<StorefrontProfile> {
  const branding = tenantBrandingSchema.parse(tenant.branding ?? {});

  const socialLinks: StorefrontSocialLinks = {};
  for (const key of SOCIAL_KEYS) {
    const link = normalizeSocialLink(key, branding.socialLinks?.[key]);
    if (link) socialLinks[key] = link;
  }

  const publicBaseUrl = tenant.logoKey || tenant.coverKey ? await getPublicBucketBaseUrl() : null;

  return {
    logoUrl: toPublicUrl(publicBaseUrl, tenant.logoKey),
    coverUrl: toPublicUrl(publicBaseUrl, tenant.coverKey),
    primaryColor: normalizeHexColor(branding.primaryColor),
    accentColor: normalizeHexColor(branding.accentColor),
    socialLinks,
  };
}

export interface ResolvedStorefrontSections {
  /** Chỉ các section `visible` (đúng thứ tự tenant sắp xếp) — sẵn sàng render. */
  sections: StorefrontSection[];
  /** true = tenant chưa xuất bản (hoặc bản live hỏng) → đang dùng nội dung demo; UI chủ tenant hiện nhãn "Nội dung mẫu". */
  isDemo: boolean;
}

type StorefrontSectionsTenant = Pick<Tenant, "id" | "name" | "bio" | "storefrontSections">;

function parseStoredSections(tenantId: string, value: unknown, field: string): StorefrontSection[] | null {
  if (value === null || value === undefined) return null;
  const parsed = storefrontSectionsSchema.safeParse(value);
  if (parsed.success) return parsed.data;
  logger.warn({ tenantId, field, issues: parsed.error.issues.slice(0, 5) }, "storefront: sections JSON không hợp lệ, dùng nội dung mặc định");
  return null;
}

/**
 * ADR-023 — section để render `/[tenantSlug]`. Bản live đã xuất bản → dùng
 * (parse phòng thủ: JSON hỏng → log warn, rơi về demo). Chưa xuất bản → demo;
 * khách (không phải chủ tenant) **không** thấy `testimonials` demo (đánh giá
 * giả hiển thị công khai là sai lệch với người mua — ADR-023 mục 3).
 */
export function resolveStorefrontSections(
  tenant: StorefrontSectionsTenant,
  options: { isOwner: boolean },
): ResolvedStorefrontSections {
  const live = parseStoredSections(tenant.id, tenant.storefrontSections, "storefrontSections");
  if (live) return { sections: live.filter((s) => s.visible), isDemo: false };

  const demo = defaultStorefrontSections({ tenantName: tenant.name, bio: tenant.bio });
  const sections = demo.filter((s) => s.visible && (options.isOwner || s.type !== "testimonials"));
  return { sections, isDemo: true };
}

export interface ResolvedStorefrontSectionsDraft {
  /** Toàn bộ section (kể cả đang ẩn) để editor hiển thị: draft ?? live ?? default. */
  sections: StorefrontSection[];
  /** Bản live đã xuất bản (null = chưa từng xuất bản) — dùng cho "Khôi phục bản live". */
  live: StorefrontSection[] | null;
  source: "draft" | "live" | "default";
}

/**
 * ADR-029 mục 4: danh sách section lưu trước M10 không có `reviews` → editor bổ sung 1 section `reviews` ĐANG ẨN
 * (chèn trước `testimonials`, hoặc cuối nếu không có) để tenant tự bật. Không đổi dữ liệu đã lưu cho tới khi
 * tenant lưu nháp/xuất bản; trang công khai không bị ảnh hưởng.
 */
function withReviewsSection(sections: StorefrontSection[]): StorefrontSection[] {
  if (sections.some((s) => s.type === "reviews")) return sections;
  const reviews = defaultStorefrontReviewsSection(false);
  if (sections.some((s) => s.id === reviews.id)) return sections;
  const index = sections.findIndex((s) => s.type === "testimonials");
  const next = [...sections];
  next.splice(index < 0 ? next.length : index, 0, reviews);
  return next;
}

/**
 * ADR-029 mục 5 (M10b): danh sách section lưu trước M10b không có `posts` → editor bổ sung 1 section `posts` ĐANG
 * ẨN (chèn ngay sau `products`, hoặc trước `reviews`, hoặc cuối) để tenant tự bật. Không đổi dữ liệu đã lưu cho tới
 * khi tenant lưu nháp/xuất bản.
 */
function withPostsSection(sections: StorefrontSection[]): StorefrontSection[] {
  if (sections.some((s) => s.type === "posts")) return sections;
  const posts = defaultStorefrontPostsSection(false);
  if (sections.some((s) => s.id === posts.id)) return sections;
  const productsIndex = sections.findIndex((s) => s.type === "products");
  const reviewsIndex = sections.findIndex((s) => s.type === "reviews");
  const index = productsIndex >= 0 ? productsIndex + 1 : reviewsIndex >= 0 ? reviewsIndex : sections.length;
  const next = [...sections];
  next.splice(index, 0, posts);
  return next;
}

function withMissingSections(sections: StorefrontSection[]): StorefrontSection[] {
  return withPostsSection(withReviewsSection(sections));
}

/** ADR-023 — dữ liệu cho Studio editor (chỉ gọi sau `requireTenantMember`). */
export function resolveStorefrontSectionsDraft(
  tenant: StorefrontSectionsTenant & Pick<Tenant, "storefrontSectionsDraft">,
): ResolvedStorefrontSectionsDraft {
  const live = parseStoredSections(tenant.id, tenant.storefrontSections, "storefrontSections");
  const draft = parseStoredSections(tenant.id, tenant.storefrontSectionsDraft, "storefrontSectionsDraft");
  if (draft) return { sections: withMissingSections(draft), live, source: "draft" };
  if (live) return { sections: withMissingSections(live), live, source: "live" };
  return { sections: defaultStorefrontSections({ tenantName: tenant.name, bio: tenant.bio }), live: null, source: "default" };
}
