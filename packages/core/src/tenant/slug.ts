import { LEGAL_DOCUMENT_ROOT_SLUGS } from "../legal/legal-document";

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
  // Các trang nội dung cấp gốc (giới thiệu, người bán, hướng dẫn, thanh toán hoàn tiền)
  "gioi-thieu",
  "danh-cho-nguoi-ban",
  "huong-dan-su-dung",
  "chinh-sach-thanh-toan-hoan-tien",
  // ADR-050 mục 3: tiền tố cũ `/phap-ly/{slug}` (ADR-054: nay chỉ redirect 308) — giữ dành riêng.
  "phap-ly",
  // ADR-054 mục 1: 7 văn bản pháp lý ở URL cấp gốc (`dieu-khoan-su-dung`, `chinh-sach-bao-mat`, `chinh-sach-noi-dung`,
  // `cam-ket-ban-quyen`, `quyen-su-dung-tai-lieu`, `chinh-sach-nguoi-ban`, `lien-he`) — route tĩnh thắng `app/[tenantSlug]`.
  ...LEGAL_DOCUMENT_ROOT_SLUGS,
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
