import { z } from "zod";

/**
 * ADR-050 — một bộ giới hạn ô SEO dùng chung cho mọi editor CMS (trang chủ, Bảng giá, sau này các trang khác).
 * Tối đa là ràng buộc cứng khi lưu; mức khuyến nghị chỉ để editor hiện cảnh báo mềm ("Google có thể cắt bớt").
 * File không phụ thuộc gì ngoài zod — client component import qua `@gieochu/core/seo`.
 */
export const SEO_TITLE_MAX = 120;
export const SEO_DESCRIPTION_MAX = 320;
export const SEO_TITLE_RECOMMENDED_MAX = 60;
export const SEO_DESCRIPTION_RECOMMENDED_MAX = 160;

/** Ô SEO của một dòng `CmsPage` (cột `seoTitle/seoDescription`): trim; chuỗi rỗng = dùng mặc định của route. */
export const cmsSeoSchema = z.object({
  seoTitle: z.string().trim().max(SEO_TITLE_MAX, `Tiêu đề SEO tối đa ${SEO_TITLE_MAX} ký tự.`),
  seoDescription: z.string().trim().max(SEO_DESCRIPTION_MAX, `Mô tả SEO tối đa ${SEO_DESCRIPTION_MAX} ký tự.`),
});
export type CmsSeoInput = z.infer<typeof cmsSeoSchema>;

/** Cảnh báo mềm theo độ dài (không chặn lưu). `null` = trong mức khuyến nghị hoặc để trống. */
export function seoLengthWarning(kind: "title" | "description", value: string): string | null {
  const length = value.trim().length;
  const recommended = kind === "title" ? SEO_TITLE_RECOMMENDED_MAX : SEO_DESCRIPTION_RECOMMENDED_MAX;
  if (length === 0 || length <= recommended) return null;
  return `Dài hơn ${recommended} ký tự — Google có thể cắt bớt khi hiển thị.`;
}
