import { z } from "zod";

/**
 * Schema các section của trang chủ (`CmsPage.slug = "home"`) — tách riêng
 * khỏi `cmsBlocksSchema` (dùng cho /p/[slug]) vì trang chủ cần: (1) thứ tự +
 * ẩn/hiện từng section (mảng có thứ tự, không phải object phẳng), (2) field
 * riêng theo từng loại section khớp đúng UI đã build sẵn ở app/page.tsx.
 *
 * Chỉ nội dung (text/ảnh/link) là editable — màu sắc, icon trang trí vẫn cố
 * định trong code, đúng cách mockup tham khảo cũng chỉ cho sửa nội dung chứ
 * không cho đổi theme màu từng item.
 */

const ctaSchema = z.object({ label: z.string().min(1), href: z.string().min(1) });

const heroDataSchema = z.object({
  badge: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema,
  /** Trống -> dùng hình minh hoạ mặc định (mock UI dựng bằng CSS); có -> hiển thị ảnh thật đã upload. */
  imageUrl: z.string().optional(),
});

const statsDataSchema = z.object({
  items: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).min(1).max(6),
});

const searchDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  placeholder: z.string().min(1),
  chips: z.array(z.string().min(1)).min(1).max(8),
});

const benefitsDataSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  items: z.array(z.object({ title: z.string().min(1), description: z.string().min(1) })).min(1).max(4),
});

const coachesDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        subject: z.string().min(1),
        rating: z.string().min(1),
        reviews: z.string().min(1),
        sold: z.string().min(1),
        tenantSlug: z.string().optional(),
      }),
    )
    .min(1)
    .max(8),
});

const documentsDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  items: z
    .array(
      z.object({
        tag: z.string().min(1),
        title: z.string().min(1),
        seller: z.string().min(1),
        rating: z.string().min(1),
        sold: z.string().min(1),
        price: z.string().min(1),
      }),
    )
    .min(1)
    .max(8),
});

const becomeSellerDataSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  highlight: z.string().min(1),
  bullets: z.array(z.string().min(1)).min(1).max(6),
  cta: ctaSchema,
});

const testimonialsDataSchema = z.object({
  items: z
    .array(z.object({ quote: z.string().min(1), name: z.string().min(1), role: z.string().min(1) }))
    .min(1)
    .max(6),
});

const finalCtaDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  cta: ctaSchema,
});

const sectionBaseFields = { id: z.string().min(1), visible: z.boolean() };

export const homeSectionSchema = z.discriminatedUnion("type", [
  z.object({ ...sectionBaseFields, type: z.literal("hero"), data: heroDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("stats"), data: statsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("search"), data: searchDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("benefits"), data: benefitsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("coaches"), data: coachesDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("documents"), data: documentsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("becomeSeller"), data: becomeSellerDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("testimonials"), data: testimonialsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("finalCta"), data: finalCtaDataSchema }),
]);

export const homeSectionsSchema = z.array(homeSectionSchema).min(1);

export type HomeSection = z.infer<typeof homeSectionSchema>;
export type HomeSectionType = HomeSection["type"];

export const HOME_SECTION_LABELS: Record<HomeSectionType, string> = {
  hero: "Hero — Banner chính",
  stats: "Số liệu nổi bật",
  search: "Tìm tài liệu",
  benefits: "Vì sao chọn chúng tôi",
  coaches: "Giáo viên & Coach nổi bật",
  documents: "Tài liệu nổi bật",
  becomeSeller: "Kêu gọi mở gian hàng",
  testimonials: "Đánh giá từ người dùng",
  finalCta: "CTA cuối trang",
};

export function isValidHomeSections(input: unknown): boolean {
  return homeSectionsSchema.safeParse(input).success;
}
