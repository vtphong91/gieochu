/** Reserved path segments that can never be a tenant slug (docs §"M4"). */
export const RESERVED_SLUGS: ReadonlySet<string> = new Set([
  "admin",
  "studio",
  "account",
  "api",
  "login",
  "register",
  "verify-email",
  "forgot-password",
  "reset-password",
  "pricing",
  "p",
  "s",
  "_next",
  "static",
  "assets",
  "help",
  "support",
  "terms",
  "privacy",
  // ADR-035 mục 1: route Cửa hàng cấp gốc `/cua-hang` (+ dự phòng) — route tĩnh thắng `app/[tenantSlug]`.
  "cua-hang",
  "tai-lieu",
  "danh-muc",
  "tim-kiem",
  "giao-vien",
  "kham-pha",
]);

export function isReservedSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug.toLowerCase());
}

/** Vietnamese-aware slugify: strips diacritics (incl. đ/Đ), lowercases, kebab-cases. */
export function slugify(input: string): string {
  const withoutDiacritics = input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D");

  return withoutDiacritics
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
