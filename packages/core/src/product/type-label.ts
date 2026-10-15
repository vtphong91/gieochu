/**
 * Nhãn tiếng Việt của loại tài liệu — một nguồn cho loader (`lib/shop.ts`) và UI (thẻ tài liệu, storefront).
 * Giá trị khớp enum `ProductType` ở `packages/db/prisma/schema.prisma` (core không phụ thuộc `@gieochu/db`).
 *
 * File không phụ thuộc gì để client component import được qua `@gieochu/core/product-type`.
 */

export const PRODUCT_TYPES = ["TEMPLATE", "SLIDE", "EBOOK", "EXAM", "OTHER"] as const;
export type ProductTypeValue = (typeof PRODUCT_TYPES)[number];

export const PRODUCT_TYPE_LABELS: Readonly<Record<ProductTypeValue, string>> = {
  TEMPLATE: "Mẫu tài liệu",
  SLIDE: "Slide bài giảng",
  EBOOK: "Sách điện tử",
  EXAM: "Đề thi",
  OTHER: "Tài liệu",
};

/** Nhãn theo loại; giá trị lạ (dữ liệu cũ/enum mới chưa có nhãn) → nhãn của OTHER. */
export function productTypeLabel(type: string): string {
  return (PRODUCT_TYPES as readonly string[]).includes(type) ? PRODUCT_TYPE_LABELS[type as ProductTypeValue] : PRODUCT_TYPE_LABELS.OTHER;
}
