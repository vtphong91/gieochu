/**
 * ADR-035 bổ sung — slug `CmsPage` do hệ thống quản lý bằng editor riêng (`home` = trang chủ, `shop` = Cửa hàng).
 * Form CMS chung không được tạo/ghi đè các slug này; `/p/[slug]` trả 404 cho chúng (dữ liệu khác dạng `CmsBlocks`).
 */
export const SYSTEM_CMS_SLUGS = ["home", "shop"] as const;
export type SystemCmsSlug = (typeof SYSTEM_CMS_SLUGS)[number];

export const HOME_CMS_SLUG: SystemCmsSlug = "home";
export const SHOP_CMS_SLUG: SystemCmsSlug = "shop";

/** So khớp sau `trim` + chữ thường (slug CMS gõ tay có thể khác hoa thường). */
export function isSystemCmsSlug(slug: string): boolean {
  return (SYSTEM_CMS_SLUGS as readonly string[]).includes(slug.trim().toLowerCase());
}
