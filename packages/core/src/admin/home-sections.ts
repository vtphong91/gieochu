import { z } from "zod";
import { isSafePublicHref, UNSAFE_HREF_MESSAGE } from "./cms-content-guard";

/**
 * Schema các section của trang chủ (`CmsPage.slug = "home"`) — tách riêng
 * khỏi `cmsBlocksSchema` (dùng cho /p/[slug]) vì trang chủ cần: (1) thứ tự +
 * ẩn/hiện từng section (mảng có thứ tự, không phải object phẳng), (2) field
 * riêng theo từng loại section khớp đúng UI đã build sẵn ở app/page.tsx.
 *
 * Chỉ nội dung (text/ảnh/link) là editable — màu sắc, icon trang trí vẫn cố
 * định trong code, đúng cách mockup tham khảo cũng chỉ cho sửa nội dung chứ
 * không cho đổi theme màu từng item.
 *
 * ADR-050 (đợt 1): thêm section `steps`, `faq`, `community` (thay `testimonials` — dữ liệu cũ được parse sang
 * `community` với `consentConfirmed = false` nên TỰ ẨN tới khi admin xác nhận đồng ý), CTA phụ cho `becomeSeller` /
 * `finalCta`, `minToShow` cho `coaches`/`documents`, nội dung mặc định `defaultHomeSections()` soạn từ
 * `docs/GIEOCHU_HOMEPAGE_CONTENT_BRIEF.md` (token `{brand}`, không số liệu/giá/chứng thực). Field mới đều tuỳ chọn
 * hoặc có mặc định → bản live cũ vẫn parse được.
 *
 * File chỉ phụ thuộc zod + `./cms-content-guard` — client component import qua `@gieochu/core/home-sections`.
 */

// ───────────── Giới hạn field mới (ADR-050) — field cũ giữ nguyên ràng buộc để không làm hỏng bản live ─────────────

export const HOME_EYEBROW_MAX = 60;
export const HOME_TITLE_MAX = 160;
export const HOME_TEXT_MAX = 600;
export const HOME_SHORT_LABEL_MAX = 40;
export const HOME_SUBMIT_LABEL_MAX = 20;
export const HOME_BRAND_MESSAGE_MAX = 80;
export const HOME_IMAGE_ALT_MAX = 160;
export const HOME_BODY_PARAGRAPHS_MAX = 3;
export const HOME_STEPS_MIN = 2;
export const HOME_STEPS_MAX = 6;
export const HOME_COMMUNITY_ITEMS_MAX = 6;
export const HOME_FAQ_MIN = 1;
export const HOME_FAQ_MAX = 20;
/** Cùng giới hạn FAQ Bảng giá (`PRICING_FAQ_*`) — khai báo lại vì pricing-sections đã import file này. */
export const HOME_FAQ_QUESTION_MAX = 200;
export const HOME_FAQ_ANSWER_MAX = 1500;
export const HOME_ITEM_ID_MAX = 64;
export const HOME_MIN_TO_SHOW_MIN = 1;
export const HOME_MIN_TO_SHOW_DEFAULT = 3;

const ctaSchema = z.object({ label: z.string().min(1), href: z.string().min(1) });
export type HomeCta = z.infer<typeof ctaSchema>;
const optionalCtaSchema = ctaSchema.optional();

const optionalText = (max: number) => z.string().trim().max(max, `Tối đa ${max} ký tự.`).optional();
const requiredText = (max: number) => z.string().trim().min(1, "Không được để trống.").max(max, `Tối đa ${max} ký tự.`);
const itemIdSchema = z.string().trim().min(1).max(HOME_ITEM_ID_MAX);

const heroDataSchema = z.object({
  badge: z.string().min(1),
  title: z.string().min(1),
  subtitle: z.string().min(1),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema,
  /** Trống -> dùng hình minh hoạ mặc định (mock UI dựng bằng CSS); có -> hiển thị ảnh thật đã upload. */
  imageUrl: z.string().optional(),
  /** ADR-050: dòng thông điệp dưới CTA; trống = slogan thương hiệu (`getEffectiveBrand().slogan`). */
  brandMessage: optionalText(HOME_BRAND_MESSAGE_MAX),
  /** ADR-050: alt của ảnh upload; trống = ảnh trang trí (`alt=""`). */
  imageAlt: optionalText(HOME_IMAGE_ALT_MAX),
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
  eyebrow: optionalText(HOME_EYEBROW_MAX),
  /** ADR-050: nhãn nút tìm (trước đây gõ cứng "Tìm kiếm"). */
  submitLabel: requiredText(HOME_SUBMIT_LABEL_MAX).default("Tìm tài liệu"),
});

const featuredLimitSchema = z.number().int().min(HOME_FEATURED_LIMIT_MIN).max(HOME_FEATURED_LIMIT_MAX);
const minToShowSchema = z.number().int().min(HOME_MIN_TO_SHOW_MIN).max(HOME_FEATURED_LIMIT_MAX);
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

const minToShowRefine = (data: { limit: number; minToShow: number }) => data.minToShow <= data.limit;
const minToShowMessage = { message: "Ngưỡng tối thiểu để hiện không được lớn hơn số thẻ hiển thị.", path: ["minToShow"] };

const coachesDataSchema = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    limit: featuredLimitSchema,
    /** Tenant ghim trước (đúng thứ tự); id không còn hợp lệ bị bỏ khi render. */
    pinnedTenantIds: pinnedIdsSchema,
    eyebrow: optionalText(HOME_EYEBROW_MAX),
    cta: optionalCtaSchema,
    /** ADR-050: ít hơn số thẻ này → section không render. */
    minToShow: minToShowSchema,
  })
  .refine(minToShowRefine, minToShowMessage);

const documentsDataSchema = z
  .object({
    title: z.string().min(1),
    subtitle: z.string().min(1),
    limit: featuredLimitSchema,
    /** Tài liệu ghim trước (đúng thứ tự); id không còn Công khai bị bỏ khi render. */
    pinnedProductIds: pinnedIdsSchema,
    eyebrow: optionalText(HOME_EYEBROW_MAX),
    cta: optionalCtaSchema,
    minToShow: minToShowSchema,
  })
  .refine(minToShowRefine, minToShowMessage);

const becomeSellerDataSchema = z.object({
  eyebrow: z.string().min(1),
  title: z.string().min(1),
  /** ADR-050: tuỳ chọn (trống = không có phần highlight). */
  highlight: z.string().max(HOME_TITLE_MAX).default(""),
  bullets: z.array(z.string().min(1)).max(6),
  /** ADR-050: 0–3 đoạn văn dưới tiêu đề. */
  body: z.array(requiredText(HOME_TEXT_MAX)).max(HOME_BODY_PARAGRAPHS_MAX).default([]),
  cta: ctaSchema,
  secondaryCta: optionalCtaSchema,
});

const stepsDataSchema = z.object({
  eyebrow: optionalText(HOME_EYEBROW_MAX),
  title: requiredText(HOME_TITLE_MAX),
  items: z
    .array(z.object({ id: itemIdSchema, title: requiredText(HOME_TITLE_MAX), description: requiredText(HOME_TEXT_MAX) }))
    .min(HOME_STEPS_MIN, `Cần ít nhất ${HOME_STEPS_MIN} bước.`)
    .max(HOME_STEPS_MAX, `Tối đa ${HOME_STEPS_MAX} bước.`),
  cta: optionalCtaSchema,
});

export const HOME_COMMUNITY_MODES = ["testimonials", "devlog", "invite"] as const;
export type HomeCommunityMode = (typeof HOME_COMMUNITY_MODES)[number];
export const HOME_COMMUNITY_MODE_LABELS: Record<HomeCommunityMode, string> = {
  testimonials: "Lời chứng thực (cần sự đồng ý của người được trích)",
  devlog: "Nhật ký phát triển",
  invite: "Lời mời tham gia thử nghiệm",
};

const isoDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Ngày dạng YYYY-MM-DD.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), "Ngày không hợp lệ.");

const communityDataSchema = z
  .object({
    mode: z.enum(HOME_COMMUNITY_MODES),
    eyebrow: optionalText(HOME_EYEBROW_MAX),
    title: requiredText(HOME_TITLE_MAX),
    description: optionalText(HOME_TEXT_MAX),
    /** Chỉ mục `consentConfirmed = true` được hiển thị; xuất bản bị chặn khi còn mục chưa xác nhận. */
    testimonials: z
      .array(
        z.object({
          id: itemIdSchema,
          quote: requiredText(HOME_TEXT_MAX),
          name: requiredText(HOME_SHORT_LABEL_MAX * 2),
          role: z.string().trim().max(HOME_SHORT_LABEL_MAX * 2),
          consentConfirmed: z.boolean(),
        }),
      )
      .max(HOME_COMMUNITY_ITEMS_MAX)
      .default([]),
    /** Ngày lưu dạng lịch `YYYY-MM-DD` (ngày giờ VN), hiển thị `vi-VN`. */
    devlog: z
      .array(
        z.object({
          id: itemIdSchema,
          date: isoDateSchema,
          title: requiredText(HOME_TITLE_MAX),
          summary: requiredText(HOME_TEXT_MAX),
          href: z.string().trim().max(500).optional(),
        }),
      )
      .max(HOME_COMMUNITY_ITEMS_MAX)
      .default([]),
    invite: z.object({ text: z.string().trim().max(HOME_TEXT_MAX), cta: optionalCtaSchema }).default({ text: "" }),
  })
  .refine((data) => data.mode !== "invite" || data.invite.text.length > 0, {
    message: "Chế độ lời mời cần nội dung lời mời.",
    path: ["invite", "text"],
  });

const faqDataSchema = z.object({
  eyebrow: optionalText(HOME_EYEBROW_MAX),
  title: requiredText(HOME_TITLE_MAX),
  items: z
    .array(z.object({ id: itemIdSchema, question: requiredText(HOME_FAQ_QUESTION_MAX), answer: requiredText(HOME_FAQ_ANSWER_MAX) }))
    .min(HOME_FAQ_MIN, `Cần ít nhất ${HOME_FAQ_MIN} câu hỏi.`)
    .max(HOME_FAQ_MAX, `Tối đa ${HOME_FAQ_MAX} câu hỏi.`)
    .refine((items) => new Set(items.map((item) => item.id)).size === items.length, "id câu hỏi bị trùng."),
});

const finalCtaDataSchema = z.object({
  title: z.string().min(1),
  subtitle: z.string().min(1),
  cta: ctaSchema,
  secondaryCta: optionalCtaSchema,
  /** ADR-050: hiện slogan thương hiệu dưới nút (đọc từ brand, không nhập lại). */
  showSlogan: z.boolean().default(true),
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
  z.object({ ...sectionBaseFields, type: z.literal("steps"), data: stepsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("community"), data: communityDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("faq"), data: faqDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("finalCta"), data: finalCtaDataSchema }),
]);

export const homeSectionsSchema = z
  .array(homeSectionSchema)
  .min(1)
  .refine((sections) => new Set(sections.map((s) => s.id)).size === sections.length, "id section bị trùng.");

export type HomeSection = z.infer<typeof homeSectionSchema>;
export type HomeSectionType = HomeSection["type"];
export type HomeSectionData<T extends HomeSectionType> = Extract<HomeSection, { type: T }>["data"];

export const HOME_SECTION_TYPES: readonly HomeSectionType[] = [
  "hero",
  "stats",
  "search",
  "benefits",
  "coaches",
  "documents",
  "becomeSeller",
  "steps",
  "community",
  "faq",
  "finalCta",
];

export const HOME_SECTION_LABELS: Record<HomeSectionType, string> = {
  hero: "Hero — Banner chính",
  stats: "Số liệu nổi bật",
  search: "Tìm tài liệu",
  benefits: "Vì sao chọn chúng tôi",
  coaches: "Giáo viên & Coach nổi bật",
  documents: "Tài liệu nổi bật",
  becomeSeller: "Kêu gọi mở gian hàng",
  steps: "Cách bắt đầu",
  community: "Cùng nhau phát triển (chứng thực / nhật ký / lời mời)",
  faq: "Câu hỏi thường gặp",
  finalCta: "CTA cuối trang",
};

export function isValidHomeSections(input: unknown): boolean {
  return homeSectionsSchema.safeParse(input).success;
}

type StatsData = HomeSectionData<"stats">;
type SearchData = HomeSectionData<"search">;
type CoachesData = HomeSectionData<"coaches">;
type DocumentsData = HomeSectionData<"documents">;
type CommunityData = HomeSectionData<"community">;

export const DEFAULT_HOME_SEARCH_DATA: SearchData = {
  title: "Tìm tài liệu bạn cần",
  subtitle: "Giáo án, đề thi, slide bài giảng, bộ đề luyện thi và hơn thế nữa",
  placeholder: "Tìm theo tên tài liệu, môn học, giáo viên...",
  submitLabel: "Tìm tài liệu",
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

// ───────────── Nội dung mặc định theo brief trang chủ (ADR-050) ─────────────

/** SEO mặc định (brief §4.1–4.2) khi ô SEO trống / chưa xuất bản. `{brand}` thay lúc render. */
export const DEFAULT_HOME_SEO = {
  title: "{brand} – Nền tảng bán tài liệu số và học liệu giáo dục",
  description:
    "{brand} giúp giáo viên, gia sư và chuyên gia xây dựng gian hàng riêng, chia sẻ và bán tài liệu số, giáo án, đề thi và học liệu giáo dục.",
} as const;

const REGISTER_PATH = "/register";
const DOCUMENTS_PATH = "/cua-hang/tai-lieu";
const SHOP_PATH = "/cua-hang";

const DEFAULT_COMMUNITY_TEXT = {
  eyebrow: "Cùng nhau phát triển",
  title: "{brand} được hoàn thiện từ nhu cầu thực tế",
  description: "Chúng tôi tin rằng một nền tảng hữu ích cần được xây dựng từ những vấn đề mà người dùng thực sự gặp phải.",
  invite:
    "Trong giai đoạn thử nghiệm, {brand} mong muốn lắng nghe trải nghiệm của giáo viên, gia sư và chuyên gia để hiểu điều gì đang thuận tiện, điều gì còn khó khăn và những cải tiến nào thực sự cần thiết.",
} as const;

/**
 * Bộ section mặc định — dùng khi trang chủ chưa có bản PUBLISHED và để bổ sung section còn thiếu vào editor. Chữ soạn
 * từ brief §6 (token `{brand}` thay tên thương hiệu); không số liệu, không giá, không lời chứng thực. `stats` mặc định
 * ẩn (brief §5 không có, §8 yêu cầu xác minh); `community` ở chế độ lời mời.
 */
export function defaultHomeSections(): HomeSection[] {
  return [
    {
      id: "hero",
      type: "hero",
      visible: true,
      data: {
        badge: "Nền tảng dành cho người dạy học",
        title: "Biến kiến thức của bạn thành tài liệu số và giá trị bền vững",
        subtitle:
          "Bạn đã dành thời gian tích lũy kiến thức, biên soạn giáo án và tạo ra những tài liệu hữu ích. {brand} giúp bạn có một nơi để giới thiệu học liệu, xây dựng gian hàng riêng và đưa những điều mình biết đến gần hơn với người cần chúng.",
        primaryCta: { label: "Bắt đầu xây dựng gian hàng", href: REGISTER_PATH },
        secondaryCta: { label: "Khám phá tài liệu", href: DOCUMENTS_PATH },
      },
    },
    { id: "stats", type: "stats", visible: false, data: defaultHomeStatsData() },
    {
      id: "search",
      type: "search",
      visible: true,
      data: {
        title: "Tìm tài liệu học tập và giảng dạy phù hợp với bạn",
        subtitle:
          "Khám phá giáo án, đề kiểm tra, bộ đề ôn tập, slide bài giảng, ebook và các học liệu số được giới thiệu bởi những người sáng tạo tri thức.",
        placeholder: "Bạn đang tìm tài liệu gì?",
        submitLabel: "Tìm tài liệu",
      },
    },
    {
      id: "benefits",
      type: "benefits",
      visible: true,
      data: {
        eyebrow: "Vì sao {brand}?",
        title: "Dành cho người có kiến thức muốn chia sẻ nhiều hơn",
        description:
          "Bạn không nhất thiết phải tự xây dựng toàn bộ một website từ đầu để bắt đầu giới thiệu tài liệu của mình. {brand} hướng đến việc giúp người dạy học có một nơi để trưng bày học liệu, xây dựng thương hiệu cá nhân và quản lý hoạt động bán tài liệu số.",
        items: [
          {
            title: "Bắt đầu với gian hàng của riêng bạn",
            description: "Tạo không gian giới thiệu bản thân và những tài liệu bạn biên soạn, để người quan tâm có thể tìm hiểu sản phẩm của bạn.",
          },
          {
            title: "Chủ động giới thiệu tài liệu",
            description: "Thêm thông tin, hình ảnh, mô tả và giá bán cho tài liệu theo các công cụ hiện có trên nền tảng.",
          },
          {
            title: "Quản lý hoạt động bán hàng",
            description: "Theo dõi tài liệu và đơn hàng trong gian hàng của bạn bằng các chức năng quản lý được hỗ trợ.",
          },
          {
            title: "Phát triển thương hiệu cá nhân",
            description:
              "Mỗi tài liệu bạn tạo ra là một cơ hội để chia sẻ chuyên môn, kết nối với người học và từng bước phát triển giá trị từ kiến thức của mình.",
          },
        ],
      },
    },
    {
      id: "coaches",
      type: "coaches",
      visible: true,
      data: {
        eyebrow: "Người sáng tạo tri thức",
        title: "Mỗi người dạy học đều có một câu chuyện và thế mạnh riêng",
        subtitle:
          "Từ giáo viên phổ thông, gia sư đến coach và chuyên gia đào tạo, mỗi người có thể sở hữu những kiến thức, kinh nghiệm và tài liệu khác nhau. {brand} hướng đến việc giúp bạn giới thiệu những giá trị ấy thông qua gian hàng và các tài liệu do chính mình xây dựng.",
        limit: HOME_COACHES_DEFAULT_LIMIT,
        pinnedTenantIds: [],
        // Chưa có trang danh bạ gian hàng — tạm trỏ Cửa hàng (có khối gian hàng nổi bật).
        cta: { label: "Khám phá các gian hàng", href: SHOP_PATH },
        minToShow: HOME_MIN_TO_SHOW_DEFAULT,
      },
    },
    {
      id: "documents",
      type: "documents",
      visible: true,
      data: {
        eyebrow: "Khám phá học liệu",
        title: "Tìm những tài liệu hữu ích cho việc dạy và học",
        subtitle:
          "Khám phá các tài liệu được giới thiệu trên {brand} để tìm nội dung phù hợp với nhu cầu học tập, giảng dạy hoặc phát triển chuyên môn của bạn.",
        limit: HOME_DOCUMENTS_DEFAULT_LIMIT,
        pinnedProductIds: [],
        cta: { label: "Khám phá tất cả tài liệu", href: DOCUMENTS_PATH },
        minToShow: HOME_MIN_TO_SHOW_DEFAULT,
      },
    },
    {
      id: "becomeSeller",
      type: "becomeSeller",
      visible: true,
      data: {
        eyebrow: "Bắt đầu từ những gì bạn đã có",
        title: "Bạn là giáo viên, gia sư, coach hay chuyên gia?",
        highlight: "",
        bullets: [],
        body: [
          "Những giáo án, bộ đề, ebook, slide bài giảng và tài liệu chuyên môn bạn đã tạo ra có thể là điểm khởi đầu để xây dựng sản phẩm số của riêng mình.",
          "Bạn có thể bắt đầu bằng một tài liệu phù hợp, hoàn thiện cách giới thiệu và từng bước học hỏi từ phản hồi của người sử dụng.",
          "{brand} đang trong quá trình hoàn thiện nền tảng cùng những người dùng đầu tiên. Chúng tôi mong muốn lắng nghe nhu cầu thực tế để giúp việc chia sẻ và phân phối tài liệu trở nên thuận tiện hơn.",
        ],
        cta: { label: "Bắt đầu xây dựng gian hàng", href: REGISTER_PATH },
      },
    },
    {
      id: "steps",
      type: "steps",
      visible: true,
      data: {
        title: "Từ tài liệu bạn đang có đến gian hàng của riêng mình",
        items: [
          { id: "step-1", title: "Chuẩn bị tài liệu", description: "Chọn giáo án, ebook, bộ đề hoặc học liệu mà bạn có quyền chia sẻ hay phân phối." },
          {
            id: "step-2",
            title: "Xây dựng gian hàng",
            description: "Hoàn thiện thông tin giới thiệu và thiết lập không gian trưng bày tài liệu theo các chức năng được hỗ trợ.",
          },
          {
            id: "step-3",
            title: "Giới thiệu tài liệu",
            description: "Thêm mô tả, hình ảnh và thông tin cần thiết để người quan tâm hiểu rõ tài liệu của bạn.",
          },
          {
            id: "step-4",
            title: "Quản lý và cải thiện",
            description:
              "Theo dõi hoạt động của gian hàng, quản lý đơn hàng theo tính năng hiện có và tiếp tục cải thiện tài liệu dựa trên nhu cầu thực tế.",
          },
        ],
        cta: { label: "Bắt đầu với {brand}", href: REGISTER_PATH },
      },
    },
    {
      id: "community",
      type: "community",
      visible: true,
      data: {
        mode: "invite",
        eyebrow: DEFAULT_COMMUNITY_TEXT.eyebrow,
        title: DEFAULT_COMMUNITY_TEXT.title,
        description: DEFAULT_COMMUNITY_TEXT.description,
        testimonials: [],
        devlog: [],
        invite: { text: DEFAULT_COMMUNITY_TEXT.invite },
      },
    },
    {
      id: "faq",
      type: "faq",
      visible: true,
      data: {
        title: "Câu hỏi thường gặp",
        items: [
          {
            id: "faq-who",
            question: "{brand} dành cho ai?",
            answer:
              "{brand} hướng đến giáo viên, gia sư, coach, chuyên gia đào tạo và những người sở hữu tài liệu hoặc kiến thức muốn giới thiệu, chia sẻ hay phân phối học liệu số.",
          },
          {
            id: "faq-types",
            question: "Tôi có thể giới thiệu những loại tài liệu nào?",
            answer:
              "Các ví dụ phù hợp gồm giáo án, đề kiểm tra, bộ đề ôn tập, slide bài giảng, ebook, workbook và tài liệu chuyên môn. Tài liệu cần đáp ứng chính sách nền tảng và quyền sử dụng nội dung.",
          },
          {
            id: "faq-website",
            question: "Tôi có cần tự xây dựng website riêng không?",
            answer:
              "{brand} hướng đến việc cung cấp không gian gian hàng và công cụ giới thiệu tài liệu trên nền tảng, giúp bạn không phải tự xây dựng toàn bộ hệ thống từ đầu.",
          },
          {
            id: "faq-free",
            question: "Tôi có thể bắt đầu miễn phí không?",
            answer: "Vui lòng xem bảng giá hiện hành trên {brand} để biết gói dịch vụ, giới hạn và quyền lợi áp dụng tại thời điểm đăng ký.",
          },
          {
            id: "faq-payment",
            question: "Việc thanh toán và nhận tài liệu diễn ra như thế nào?",
            answer:
              "Quy trình phụ thuộc vào các phương thức thanh toán và chức năng đang được hỗ trợ. Hãy xem hướng dẫn mua hàng trên nền tảng trước khi thực hiện giao dịch.",
          },
          {
            id: "faq-open",
            question: "{brand} đã mở đăng ký chính thức chưa?",
            answer:
              "Trạng thái đăng ký và phạm vi tính năng có thể thay đổi theo giai đoạn triển khai. Hãy theo dõi thông báo trên website để biết thông tin mới nhất.",
          },
        ],
      },
    },
    {
      id: "finalCta",
      type: "finalCta",
      visible: true,
      data: {
        title: "Kiến thức của bạn có thể là khởi đầu cho những giá trị mới",
        subtitle:
          "Hãy bắt đầu từ những gì bạn đã biết, những tài liệu bạn đã tạo ra và những điều bạn muốn chia sẻ với người khác. {brand} đang từng bước hoàn thiện nền tảng để đồng hành cùng người sáng tạo tri thức.",
        cta: { label: "Bắt đầu với {brand}", href: REGISTER_PATH },
        secondaryCta: { label: "Khám phá tài liệu", href: DOCUMENTS_PATH },
        showSlogan: true,
      },
    },
  ];
}

/**
 * Cho editor: thêm (ẩn) section mặc định của các loại còn thiếu vào cuối danh sách — bản live cũ chưa có
 * `steps/faq/community` vẫn soạn được mà không cần nút "thêm section". Id trùng được thêm hậu tố.
 */
export function withMissingHomeSections(sections: HomeSection[]): HomeSection[] {
  const present = new Set(sections.map((section) => section.type));
  const ids = new Set(sections.map((section) => section.id));
  const result = [...sections];
  for (const section of defaultHomeSections()) {
    if (present.has(section.type)) continue;
    let id = section.id;
    for (let n = 2; ids.has(id); n += 1) id = `${section.id}-${n}`;
    ids.add(id);
    result.push({ ...section, id, visible: false });
  }
  return result;
}

// ───────────── Render helpers (ADR-050) ─────────────

/** Thay `{brand}` trong mọi chuỗi của một giá trị (chữ thuần — React tự escape khi render). */
export function replaceBrandToken<T>(value: T, brandName: string): T {
  if (typeof value === "string") return value.replaceAll("{brand}", brandName) as T;
  if (Array.isArray(value)) return value.map((item) => replaceBrandToken(item, brandName)) as T;
  if (typeof value === "object" && value !== null) {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value)) out[key] = replaceBrandToken(item, brandName);
    return out as T;
  }
  return value;
}

export type HomeCommunityView =
  | { kind: "testimonials"; items: CommunityData["testimonials"] }
  | { kind: "devlog"; items: CommunityData["devlog"] }
  | { kind: "invite"; text: string; cta?: HomeCta };

/**
 * Nội dung `community` sẽ render: chế độ chứng thực chỉ lấy mục đã xác nhận đồng ý; chế độ chứng thực/nhật ký mà
 * không còn mục nào → rơi về lời mời; lời mời trống → `null` (section không render).
 */
export function resolveCommunityView(data: CommunityData): HomeCommunityView | null {
  if (data.mode === "testimonials") {
    const items = data.testimonials.filter((item) => item.consentConfirmed);
    if (items.length > 0) return { kind: "testimonials", items };
  } else if (data.mode === "devlog" && data.devlog.length > 0) {
    return { kind: "devlog", items: [...data.devlog].sort((a, b) => b.date.localeCompare(a.date)) };
  }
  return data.invite.text.length > 0 ? { kind: "invite", text: data.invite.text, ...(data.invite.cta ? { cta: data.invite.cta } : {}) } : null;
}

// ───────────── Luật chặn xuất bản (ADR-050) ─────────────

export interface HomePublishIssue {
  sectionId: string;
  /** Đường dẫn field trong `data` (chấm), vd `testimonials.0.consentConfirmed`. */
  field: string;
  message: string;
}

function sectionHrefs(section: HomeSection): { field: string; href: string }[] {
  const out: { field: string; href: string }[] = [];
  const add = (field: string, cta: HomeCta | undefined) => {
    if (cta) out.push({ field, href: cta.href });
  };
  switch (section.type) {
    case "hero":
      add("primaryCta.href", section.data.primaryCta);
      add("secondaryCta.href", section.data.secondaryCta);
      break;
    case "coaches":
    case "documents":
    case "steps":
      add("cta.href", section.data.cta);
      break;
    case "becomeSeller":
    case "finalCta":
      add("cta.href", section.data.cta);
      add("secondaryCta.href", section.data.secondaryCta);
      break;
    case "community":
      add("invite.cta.href", section.data.invite.cta);
      section.data.devlog.forEach((item, index) => {
        if (item.href) out.push({ field: `devlog.${index}.href`, href: item.href });
      });
      break;
    default:
      break;
  }
  return out;
}

/**
 * Luật CỨNG khi xuất bản (server kiểm lại; editor dùng để báo trước): (1) lời chứng thực chưa xác nhận đồng ý của
 * người được trích, (2) link không an toàn (`isSafePublicHref`). Rỗng = được xuất bản. Cảnh báo mềm brief §8 không
 * nằm ở đây (`findContentClaimWarnings`).
 */
export function homePublishIssues(sections: readonly HomeSection[]): HomePublishIssue[] {
  const issues: HomePublishIssue[] = [];
  for (const section of sections) {
    if (section.type === "community") {
      section.data.testimonials.forEach((item, index) => {
        if (!item.consentConfirmed) {
          issues.push({
            sectionId: section.id,
            field: `testimonials.${index}.consentConfirmed`,
            message: `Lời chứng thực của “${item.name}” chưa được xác nhận đồng ý — tích xác nhận hoặc xoá mục này.`,
          });
        }
      });
    }
    for (const { field, href } of sectionHrefs(section)) {
      if (!isSafePublicHref(href)) issues.push({ sectionId: section.id, field, message: `${UNSAFE_HREF_MESSAGE} (“${href}”)` });
    }
  }
  return issues;
}

// ───────────── Parse phòng thủ (ADR-033 mục 6, ADR-050) ─────────────

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textOr(value: unknown, fallback: string): string {
  return typeof value === "string" && value.trim().length > 0 ? value : fallback;
}

function optionalTextOf(value: unknown, max: number): string | undefined {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= max ? value.trim() : undefined;
}

function limitOr(value: unknown, fallback: number): number {
  const parsed = featuredLimitSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}

function minToShowOr(value: unknown, limit: number): number {
  const parsed = minToShowSchema.safeParse(value);
  return Math.min(parsed.success ? parsed.data : HOME_MIN_TO_SHOW_DEFAULT, limit);
}

function optionalCtaOf(value: unknown): HomeCta | undefined {
  const parsed = ctaSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
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

function withOptional<T extends object>(base: T, extra: Record<string, unknown>): T {
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) out[key] = value;
  return out as T;
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
      return withOptional<SearchData>(
        {
          title: textOr(data.title, DEFAULT_HOME_SEARCH_DATA.title),
          subtitle: textOr(data.subtitle, DEFAULT_HOME_SEARCH_DATA.subtitle),
          placeholder: textOr(data.placeholder, DEFAULT_HOME_SEARCH_DATA.placeholder),
          submitLabel: optionalTextOf(data.submitLabel, HOME_SUBMIT_LABEL_MAX) ?? DEFAULT_HOME_SEARCH_DATA.submitLabel,
        },
        { eyebrow: optionalTextOf(data.eyebrow, HOME_EYEBROW_MAX) },
      );
    case "coaches": {
      const limit = limitOr(data.limit, HOME_COACHES_DEFAULT_LIMIT);
      return withOptional<CoachesData>(
        {
          title: textOr(data.title, DEFAULT_HOME_COACHES_TEXT.title),
          subtitle: textOr(data.subtitle, DEFAULT_HOME_COACHES_TEXT.subtitle),
          limit,
          pinnedTenantIds: pinnedIdsOr(data.pinnedTenantIds),
          minToShow: minToShowOr(data.minToShow, limit),
        },
        { eyebrow: optionalTextOf(data.eyebrow, HOME_EYEBROW_MAX), cta: optionalCtaOf(data.cta) },
      );
    }
    case "documents": {
      const limit = limitOr(data.limit, HOME_DOCUMENTS_DEFAULT_LIMIT);
      return withOptional<DocumentsData>(
        {
          title: textOr(data.title, DEFAULT_HOME_DOCUMENTS_TEXT.title),
          subtitle: textOr(data.subtitle, DEFAULT_HOME_DOCUMENTS_TEXT.subtitle),
          limit,
          pinnedProductIds: pinnedIdsOr(data.pinnedProductIds),
          minToShow: minToShowOr(data.minToShow, limit),
        },
        { eyebrow: optionalTextOf(data.eyebrow, HOME_EYEBROW_MAX), cta: optionalCtaOf(data.cta) },
      );
    }
    default:
      return null;
  }
}

/**
 * ADR-050: section `testimonials` (trước ADR-050) → `community` chế độ chứng thực, mọi mục `consentConfirmed = false`
 * (không có bằng chứng đồng ý) ⇒ không hiển thị, rơi về lời mời mặc định tới khi admin xác nhận từng mục.
 */
function legacyTestimonialsToCommunity(record: Record<string, unknown>): Record<string, unknown> {
  const data = asRecord(record.data);
  const rawItems = Array.isArray(data.items) ? data.items : [];
  const testimonials = rawItems
    .map((raw, index) => {
      const item = asRecord(raw);
      return {
        id: `testimonial-${index + 1}`,
        quote: typeof item.quote === "string" ? item.quote.trim() : "",
        name: typeof item.name === "string" ? item.name.trim() : "",
        role: typeof item.role === "string" ? item.role.trim() : "",
        consentConfirmed: false,
      };
    })
    .filter((item) => item.quote.length > 0 && item.name.length > 0)
    .slice(0, HOME_COMMUNITY_ITEMS_MAX);
  return {
    ...record,
    type: "community",
    data: {
      mode: "testimonials",
      eyebrow: DEFAULT_COMMUNITY_TEXT.eyebrow,
      title: DEFAULT_COMMUNITY_TEXT.title,
      description: DEFAULT_COMMUNITY_TEXT.description,
      testimonials,
      devlog: [],
      invite: { text: DEFAULT_COMMUNITY_TEXT.invite },
    },
  };
}

/**
 * Đọc `CmsPage.blocks/blocksDraft` của trang chủ một cách phòng thủ (dùng khi RENDER và khi nạp editor — không dùng
 * để validate lúc lưu, lúc lưu dùng `homeSectionsSchema` chặt):
 *  - `stats/search/coaches/documents`: dữ liệu cũ nhập tay (trước ADR-033) được chuẩn hoá sang dạng mới (mặc định
 *    cho field mới) thay vì làm hỏng cả trang.
 *  - `testimonials` (trước ADR-050) → `community` với `consentConfirmed = false`.
 *  - Section khác không hợp lệ → bỏ riêng section đó (không bỏ cả trang như trước).
 *  - Trùng `id` → giữ section đầu.
 * Trả `null` khi đầu vào không phải mảng.
 */
export function parseHomeSections(input: unknown): HomeSection[] | null {
  if (!Array.isArray(input)) return null;
  const sections: HomeSection[] = [];
  const seenIds = new Set<string>();
  for (const raw of input) {
    let record = asRecord(raw);
    if (record.type === "testimonials") record = legacyTestimonialsToCommunity(record);
    const normalizedData = normalizeLiveDataSection(record.type, record.data);
    const candidate = normalizedData ? { ...record, data: normalizedData } : record;
    const parsed = homeSectionSchema.safeParse(candidate);
    if (!parsed.success || seenIds.has(parsed.data.id)) continue;
    seenIds.add(parsed.data.id);
    sections.push(parsed.data);
  }
  return sections;
}
