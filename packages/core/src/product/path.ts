/**
 * ADR-030 §1-2: URL chuẩn (canonical) trang tài liệu là `/{tenantSlug}/{productSlug}`. Mọi link nội bộ, email,
 * metadata `canonical`, `revalidatePath`... dựng qua `productPath`/`productUrl` — không tự ghép chuỗi.
 *
 * File không phụ thuộc gì (không pino/argon2) để client component import được qua `@gieochu/core/product-path`.
 */

/**
 * Slug tài liệu không được trùng segment tĩnh con của `/[tenantSlug]` (hiện có + dự phòng) — nếu trùng, route
 * tĩnh thắng và trang tài liệu không bao giờ hiện ra được.
 */
export const RESERVED_PRODUCT_SLUGS: ReadonlySet<string> = new Set([
  "products",
  "posts",
  "checkout",
  "danh-gia",
  "bai-viet",
  "api",
  "studio",
  "account",
  "login",
  "admin",
  "p",
  "s",
  "feed",
  "tag",
  "category",
  "search",
  "cart",
  "orders",
  "reviews",
  "about",
  "contact",
  "new",
  "edit",
]);

export function isReservedProductSlug(slug: string): boolean {
  return RESERVED_PRODUCT_SLUGS.has(slug.toLowerCase());
}

/** Đường dẫn tương đối `/{tenantSlug}/{productSlug}` (segment được encode — slug hợp lệ không đổi). */
export function productPath(tenantSlug: string, productSlug: string): string {
  return `/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(productSlug)}`;
}

/** URL tuyệt đối (email, canonical): `appUrl` không kèm dấu `/` cuối cũng được. */
export function productUrl(appUrl: string, tenantSlug: string, productSlug: string): string {
  return `${appUrl.replace(/\/+$/, "")}${productPath(tenantSlug, productSlug)}`;
}
