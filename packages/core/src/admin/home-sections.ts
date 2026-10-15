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

// ───────────── ADR-033: các section lấy dữ liệu thật — CMS chỉ lưu nhãn/cấu hình ─────────────

/** Chỉ số cố định của section "Số liệu nổi bật" (ADR-033 mục 2) — thứ tự hiển thị cũng theo mảng này. */
export const HOME_STAT_KEYS = ["tenants", "products", "sold", "reviews"] as const;
export type HomeStatKey = (typeof HOME_STAT_KEYS)[number];

export const HOME_STAT_DEFAULT_LABELS: Record<HomeStatKey, string> = {
  tenants: "Người bán đang hoạt động",
  products: "Tài liệu công khai",
  sold: "Lượt mua thành công",
  reviews: "Đánh giá từ người mua",
};

/** Giới hạn số thẻ của "Giáo viên & Coach nổi bật" / "Tài liệu nổi bật" (ADR-033 mục 4). */
export const HOME_FEATURED_LIMIT_MIN = 3;
export const HOME_FEATURED_LIMIT_MAX = 12;
/** Tối đa id ghim mỗi section. */
export const HOME_PINNED_MAX = 12;
export const HOME_COACHES_DEFAULT_LIMIT = 4;
export const HOME_DOCUMENTS_DEFAULT_LIMIT = 6;

const statMetricSchema = z.object({ label: z.string().trim().min(1).max(60), enabled: z.boolean() });

const statsDataSchema = z.object({
  metrics: z.object({
    tenants: statMetricSchema,
    products: statMetricSchema,
    sold: statMetricSchema,
    reviews: statMetricSchema,
  }),
});

const searchDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  placeholder: z.string().min(1),
});

const featuredLimitSchema = z.number().int().min(HOME_FEATURED_LIMIT_MIN).max(HOME_FEATURED_LIMIT_MAX);
const pinnedIdsSchema = z
  .array(z.string().trim().min(1).max(64))
  .max(HOME_PINNED_MAX)
  .refine((ids) => new Set(ids).size === ids.length, { message: "Danh sách ghim bị trùng." });

const benefitsDataSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  items: z.array(z.object({ title: z.string().min(1), description: z.string().min(1) })).min(1).max(4),
});

const coachesDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  limit: featuredLimitSchema,
  /** Tenant ghim trước (đúng thứ tự); id không còn hợp lệ bị bỏ khi render. */
  pinnedTenantIds: pinnedIdsSchema,
});

const documentsDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  limit: featuredLimitSchema,
  /** Tài liệu ghim trước (đúng thứ tự); id không còn Công khai bị bỏ khi render. */
  pinnedProductIds: pinnedIdsSchema,
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
  testimonials: "Cảm nhận người dùng",
  finalCta: "CTA cuối trang",
};

export function isValidHomeSections(input: unknown): boolean {
  return homeSectionsSchema.safeParse(input).success;
}

type StatsData = Extract<HomeSection, { type: "stats" }>["data"];
type SearchData = Extract<HomeSection, { type: "search" }>["data"];
type CoachesData = Extract<HomeSection, { type: "coaches" }>["data"];
type DocumentsData = Extract<HomeSection, { type: "documents" }>["data"];

export const DEFAULT_HOME_SEARCH_DATA: SearchData = {
  title: "Tìm tài liệu bạn cần",
  subtitle: "Giáo án, đề thi, slide bài giảng, bộ đề luyện thi và hơn thế nữa",
  placeholder: "Tìm theo tên tài liệu, môn học, giáo viên...",
};

export const DEFAULT_HOME_COACHES_TEXT = {
  title: "Giáo viên & Coach nổi bật",
  subtitle: "Những người bán được học viên đánh giá cao",
} as const;

export const DEFAULT_HOME_DOCUMENTS_TEXT = {
  title: "Tài liệu nổi bật",
  subtitle: "Được học viên tin dùng và đánh giá cao",
} as const;

export function defaultHomeStatsData(): StatsData {
  return {
    metrics: {
      tenants: { label: HOME_STAT_DEFAULT_LABELS.tenants, enabled: true },
      products: { label: HOME_STAT_DEFAULT_LABELS.products, enabled: true },
      sold: { label: HOME_STAT_DEFAULT_LABELS.sold, enabled: true },
      reviews: { label: HOME_STAT_DEFAULT_LABELS.reviews, enabled: true },
    },
  };
}

// ───────────── Parse phòng thủ (ADR-033 mục 6) ─────────────

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function limitOr(value: unknown, fallback: number): number {
  const parsed = featuredLimitSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

function pinnedIdsOr(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (id.length === 0 || id.length > 64 || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= HOME_PINNED_MAX) break;
  }
  return ids;
}

/**
 * Chuẩn hoá `data` của 4 section chuyển sang dữ liệu thật: giữ field mới hợp lệ, field thiếu/sai → mặc định, field
 * cũ nhập tay (`items`, `chips`...) bị bỏ. Trả `null` với type khác (để parse chặt như cũ).
 */
function normalizeLiveDataSection(type: unknown, rawData: unknown): HomeSection["data"] | null {
  const data = asRecord(rawData);
  switch (type) {
    case "stats": {
      const metrics = asRecord(data.metrics);
      const result = defaultHomeStatsData();
      for (const key of HOME_STAT_KEYS) {
        const parsed = statMetricSchema.safeParse(metrics[key]);
        if (parsed.success) result.metrics[key] = parsed.data;
      }
      return result;
    }
    case "search":
      return {
        title: textOr(data.title, DEFAULT_HOME_SEARCH_DATA.title),
        subtitle: textOr(data.subtitle, DEFAULT_HOME_SEARCH_DATA.subtitle),
        placeholder: textOr(data.placeholder, DEFAULT_HOME_SEARCH_DATA.placeholder),
      } satisfies SearchData;
    case "coaches":
      return {
        title: textOr(data.title, DEFAULT_HOME_COACHES_TEXT.title),
        subtitle: textOr(data.subtitle, DEFAULT_HOME_COACHES_TEXT.subtitle),
        limit: limitOr(data.limit, HOME_COACHES_DEFAULT_LIMIT),
        pinnedTenantIds: pinnedIdsOr(data.pinnedTenantIds),
      } satisfies CoachesData;
    case "documents":
      return {
        title: textOr(data.title, DEFAULT_HOME_DOCUMENTS_TEXT.title),
        subtitle: textOr(data.subtitle, DEFAULT_HOME_DOCUMENTS_TEXT.subtitle),
        limit: limitOr(data.limit, HOME_DOCUMENTS_DEFAULT_LIMIT),
        pinnedProductIds: pinnedIdsOr(data.pinnedProductIds),
      } satisfies DocumentsData;
    default:
      return null;
  }
}

/**
 * Đọc `CmsPage.blocks/blocksDraft` của trang chủ một cách phòng thủ (dùng khi RENDER và khi nạp editor — không dùng
 * để validate lúc lưu, lúc lưu dùng `homeSectionsSchema` chặt):
 *  - `stats/search/coaches/documents`: dữ liệu cũ nhập tay (trước ADR-033) được chuẩn hoá sang dạng mới (mặc định
 *    cho field mới) thay vì làm hỏng cả trang.
 *  - Section khác không hợp lệ → bỏ riêng section đó (không bỏ cả trang như trước).
 *  - Trùng `id` → giữ section đầu.
 * Trả `null` khi đầu vào không phải mảng.
 */
export function parseHomeSections(input: unknown): HomeSection[] | null {
  if (!Array.isArray(input)) return null;
  const sections: HomeSection[] = [];
  const seenIds = new Set<string>();
  for (const raw of input) {
    const record = asRecord(raw);
    const normalizedData = normalizeLiveDataSection(record.type, record.data);
    const candidate = normalizedData ? { ...record, data: normalizedData } : raw;
    const parsed = homeSectionSchema.safeParse(candidate);
    if (!parsed.success || seenIds.has(parsed.data.id)) continue;
    seenIds.add(parsed.data.id);
    sections.push(parsed.data);
  }
  return sections;
}
