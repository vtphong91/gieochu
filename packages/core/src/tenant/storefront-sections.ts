import { z } from "zod";

/**
 * ADR-023: schema các section của storefront tenant (`/[tenantSlug]`) — cùng
 * mô hình với `homeSectionsSchema` (CMS trang chủ): mảng có thứ tự, mỗi phần
 * tử `{ id, type, visible, data }`, discriminated union theo `type`, mỗi
 * `type` xuất hiện tối đa 1 lần. Chỉ nội dung (text/ảnh/link) là sửa được —
 * bố cục, màu (theo `Tenant.branding`), icon trang trí do code quyết định.
 *
 * Dữ liệu này do tenant nhập rồi render công khai, nên mọi link/ảnh đều bị
 * giới hạn ở đây (không chỉ ở UI): href chỉ `#anchor`, đường dẫn nội bộ `/...`
 * hoặc `http(s):`; ảnh chỉ từ `https://res.cloudinary.com/` (khớp CSP img-src).
 *
 * File này không import gì server-only — client component (Studio editor) có
 * thể import qua subpath `@gieochu/core/storefront-sections`.
 */

const TITLE_MAX = 120;
const SHORT_MAX = 60;
const TEXT_MAX = 500;
const URL_MAX = 500;

/** Ký tự điều khiển/khoảng trắng/backslash — trình duyệt có thể "chuẩn hoá" chúng thành URL khác (vd `/\evil.com` → `//evil.com`). */
const UNSAFE_URL_CHARS = /[\s\u0000-\u001f\u007f\\]/;
const ANCHOR = /^#[A-Za-z0-9_-]{0,64}$/;

/** `#anchor`, đường dẫn tương đối bắt đầu bằng `/` (không `//`), hoặc URL tuyệt đối `http:`/`https:`. Loại `javascript:`, `data:`, `mailto:`... */
export function isSafeStorefrontHref(value: string): boolean {
  if (!value || value.length > URL_MAX || UNSAFE_URL_CHARS.test(value)) return false;
  if (value.startsWith("#")) return ANCHOR.test(value);
  if (value.startsWith("/")) return !value.startsWith("//");
  try {
    const url = new URL(value);
    return (url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password;
  } catch {
    return false;
  }
}

/**
 * Chỉ ảnh đã upload lên Cloudinary (`https://res.cloudinary.com/...`) — khớp CSP `img-src`.
 * ADR-028 §5: truyền `cloudName` (cloud hệ thống, đọc ở server) → bắt buộc thêm đường dẫn
 * `/<cloudName>/image/upload/...` (loại ảnh của tài khoản Cloudinary khác). Không truyền = chỉ kiểm host
 * (dùng trong schema zod thuần/client, nơi không có cấu hình hệ thống).
 */
export function isCloudinaryImageUrl(value: string, cloudName?: string | null): boolean {
  if (!value || value.length > URL_MAX || UNSAFE_URL_CHARS.test(value)) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" || url.hostname !== "res.cloudinary.com" || url.username || url.password || url.pathname.length <= 1) {
      return false;
    }
    if (cloudName === undefined) return true;
    if (!cloudName) return false;
    const prefix = `/${cloudName}/image/upload/`;
    return url.pathname.startsWith(prefix) && url.pathname.length > prefix.length;
  } catch {
    return false;
  }
}

/** ADR-028: mọi URL ảnh trong danh sách section storefront (để server kiểm cloud hệ thống sau khi parse). */
export function storefrontImageUrls(sections: readonly StorefrontSection[]): string[] {
  const urls: string[] = [];
  for (const section of sections) {
    if (section.type === "hero" && section.data.imageUrl) urls.push(section.data.imageUrl);
    if (section.type === "services") {
      for (const item of section.data.items) if (item.imageUrl) urls.push(item.imageUrl);
    }
    if (section.type === "testimonials") {
      for (const item of section.data.items) if (item.avatarUrl) urls.push(item.avatarUrl);
    }
  }
  return urls;
}

/** Chuỗi rỗng/chỉ khoảng trắng → undefined (ô input bị xoá trắng trong editor = bỏ field). */
const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);

const requiredText = (max: number) => z.string().trim().min(1, "Không được để trống.").max(max);
const optionalText = (max: number) => z.preprocess(blankToUndefined, z.string().trim().max(max).optional());

const hrefSchema = z.string().trim().refine(isSafeStorefrontHref, "Liên kết không hợp lệ (chỉ #anchor, /đường-dẫn hoặc http(s)://).");
const optionalHref = z.preprocess(blankToUndefined, hrefSchema.optional());
const optionalImageUrl = z.preprocess(
  blankToUndefined,
  z.string().trim().refine((value) => isCloudinaryImageUrl(value), "Ảnh phải được upload lên Cloudinary.").optional(),
);

const ctaSchema = z.object({ label: requiredText(SHORT_MAX), href: hrefSchema });

export const STOREFRONT_SERVICE_ICONS = ["book", "slides", "exam", "template", "coaching", "video", "star", "chat"] as const;
export type StorefrontServiceIcon = (typeof STOREFRONT_SERVICE_ICONS)[number];

export const STOREFRONT_SERVICE_ICON_LABELS: Record<StorefrontServiceIcon, string> = {
  book: "Sách / giáo án",
  slides: "Slide bài giảng",
  exam: "Đề thi",
  template: "Mẫu / template",
  coaching: "Kèm cặp / coaching",
  video: "Video",
  star: "Nổi bật",
  chat: "Tư vấn / hỏi đáp",
};

const heroDataSchema = z.object({
  eyebrow: optionalText(SHORT_MAX),
  title: requiredText(TITLE_MAX),
  /** Phần chữ gradient ở dòng 2 của tiêu đề. */
  highlight: optionalText(TITLE_MAX),
  subtitle: requiredText(TEXT_MAX),
  primaryCta: ctaSchema,
  secondaryCta: ctaSchema,
  imageUrl: optionalImageUrl,
});

const servicesDataSchema = z.object({
  title: requiredText(TITLE_MAX),
  subtitle: optionalText(TEXT_MAX),
  items: z
    .array(
      z.object({
        icon: z.enum(STOREFRONT_SERVICE_ICONS),
        title: requiredText(TITLE_MAX),
        description: requiredText(TEXT_MAX),
        imageUrl: optionalImageUrl,
      }),
    )
    .min(1)
    .max(6),
});

export const STOREFRONT_PRODUCTS_LIMIT_MIN = 3;
export const STOREFRONT_PRODUCTS_LIMIT_MAX = 12;

const productsDataSchema = z.object({
  title: requiredText(TITLE_MAX),
  subtitle: optionalText(TEXT_MAX),
  limit: z.number().int().min(STOREFRONT_PRODUCTS_LIMIT_MIN).max(STOREFRONT_PRODUCTS_LIMIT_MAX),
  /** Thứ tự ưu tiên; id không còn PUBLISHED bị bỏ qua lúc render (không lỗi). */
  featuredProductIds: z
    .array(z.string().min(1).max(40))
    .max(STOREFRONT_PRODUCTS_LIMIT_MAX)
    .refine((ids) => new Set(ids).size === ids.length, "Sản phẩm nổi bật bị trùng."),
  ctaLabel: optionalText(SHORT_MAX),
});

const testimonialsDataSchema = z.object({
  title: requiredText(TITLE_MAX),
  items: z
    .array(
      z.object({
        quote: requiredText(TEXT_MAX),
        name: requiredText(SHORT_MAX),
        role: optionalText(SHORT_MAX),
        avatarUrl: optionalImageUrl,
        rating: z.number().int().min(1).max(5),
      }),
    )
    .min(1)
    .max(6),
});

export const STOREFRONT_REVIEWS_LIMIT_MIN = 3;
export const STOREFRONT_REVIEWS_LIMIT_MAX = 12;
export const STOREFRONT_REVIEWS_PINNED_MAX = 12;

/**
 * ADR-029 mục 4: section "Đánh giá" lấy đánh giá THẬT (bảng `reviews`, VISIBLE, sản phẩm PUBLISHED) — khác
 * `testimonials` (nhập tay, hiển thị là "Cảm nhận"). Thứ tự hiển thị: các id trong `pinnedReviewIds` trước (đúng
 * thứ tự tenant chọn, id không còn hiệu lực bị bỏ qua, không áp bộ lọc), rồi tự bù đánh giá mới nhất có
 * `rating ≥ minRating` (và có nội dung nếu `requireBody`) cho đủ `limit`, không trùng. `pinnedReviewIds` rỗng = hoàn
 * toàn tự động. Không có đánh giá thật nào → section không render.
 */
const reviewsDataSchema = z.object({
  title: requiredText(TITLE_MAX),
  limit: z.number().int().min(STOREFRONT_REVIEWS_LIMIT_MIN).max(STOREFRONT_REVIEWS_LIMIT_MAX),
  minRating: z.number().int().min(1).max(5),
  requireBody: z.boolean(),
  pinnedReviewIds: z
    .array(z.string().min(1).max(40))
    .max(STOREFRONT_REVIEWS_PINNED_MAX)
    .refine((ids) => new Set(ids).size === ids.length, "Đánh giá được chọn bị trùng."),
});

export const STOREFRONT_POSTS_LIMIT_MIN = 3;
export const STOREFRONT_POSTS_LIMIT_MAX = 9;

/**
 * ADR-029 mục 5 (M10b): section "Bài viết" lấy bài PUBLISHED thật của tenant (bảng `posts`), mới đăng trước;
 * `showPinnedFirst` = bài đang ghim (nếu có) đứng đầu. Không có bài nào → section không render (không bịa bài mẫu).
 */
const postsDataSchema = z.object({
  title: requiredText(TITLE_MAX),
  limit: z.number().int().min(STOREFRONT_POSTS_LIMIT_MIN).max(STOREFRONT_POSTS_LIMIT_MAX),
  showPinnedFirst: z.boolean(),
});

const contactDataSchema = z.object({
  title: requiredText(TITLE_MAX),
  formEnabled: z.boolean(),
  formTitle: optionalText(TITLE_MAX),
  successMessage: requiredText(TEXT_MAX),
  ctaTitle: requiredText(TITLE_MAX),
  ctaSubtitle: requiredText(TEXT_MAX),
  ctaLabel: requiredText(SHORT_MAX),
  /** Trống → UI dùng link mạng xã hội ưu tiên của tenant (`Tenant.branding.socialLinks`). */
  ctaHref: optionalHref,
});

const sectionBaseFields = { id: z.string().trim().min(1).max(40), visible: z.boolean() };

export const storefrontSectionSchema = z.discriminatedUnion("type", [
  z.object({ ...sectionBaseFields, type: z.literal("hero"), data: heroDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("services"), data: servicesDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("products"), data: productsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("testimonials"), data: testimonialsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("reviews"), data: reviewsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("posts"), data: postsDataSchema }),
  z.object({ ...sectionBaseFields, type: z.literal("contact"), data: contactDataSchema }),
]);

export const storefrontSectionsSchema = z
  .array(storefrontSectionSchema)
  .min(1)
  .superRefine((sections, ctx) => {
    const seenTypes = new Set<string>();
    const seenIds = new Set<string>();
    sections.forEach((section, index) => {
      if (seenTypes.has(section.type)) {
        ctx.addIssue({ code: "custom", path: [index, "type"], message: `Section "${section.type}" chỉ được xuất hiện 1 lần.` });
      }
      if (seenIds.has(section.id)) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: "id section bị trùng." });
      }
      seenTypes.add(section.type);
      seenIds.add(section.id);
    });
  });

export type StorefrontSection = z.infer<typeof storefrontSectionSchema>;
export type StorefrontSectionType = StorefrontSection["type"];
export type StorefrontSectionData<T extends StorefrontSectionType> = Extract<StorefrontSection, { type: T }>["data"];
export type StorefrontHeroData = StorefrontSectionData<"hero">;
export type StorefrontServicesData = StorefrontSectionData<"services">;
export type StorefrontProductsData = StorefrontSectionData<"products">;
export type StorefrontTestimonialsData = StorefrontSectionData<"testimonials">;
export type StorefrontReviewsData = StorefrontSectionData<"reviews">;
export type StorefrontPostsData = StorefrontSectionData<"posts">;
export type StorefrontContactData = StorefrontSectionData<"contact">;
export type StorefrontCta = StorefrontHeroData["primaryCta"];

export const STOREFRONT_SECTION_LABELS: Record<StorefrontSectionType, string> = {
  hero: "Hero — Giới thiệu chính",
  services: "Dịch vụ / Bạn nhận được gì",
  products: "Tài liệu nổi bật",
  // ADR-029 mục 4: mục nhập tay đổi tên hiển thị thành "Cảm nhận" (không sao — UI bỏ hiển thị sao), dữ liệu cũ giữ nguyên.
  testimonials: "Cảm nhận",
  reviews: "Đánh giá",
  posts: "Bài viết",
  contact: "Liên hệ & kêu gọi hành động",
};

function clip(value: string, max: number): string {
  const trimmed = value.trim();
  return trimmed.length > max ? `${trimmed.slice(0, max - 1).trimEnd()}…` : trimmed;
}

/**
 * Nội dung demo khi tenant chưa từng xuất bản (ADR-023 mục 3). Không chứa
 * chuỗi thương hiệu hệ thống — chỉ dùng tên/bio của chính tenant. Thứ tự:
 * hero, services, products, posts, reviews, testimonials, contact. Section `reviews` chỉ đọc đánh giá thật — tenant
 * chưa có đánh giá nào thì trang không render nó (không bịa đánh giá mẫu công khai, ADR-023 mục 3 / ADR-029).
 * Section `posts` (M10b) có sẵn nhưng ĐANG ẨN — tenant tự bật khi đã có bài; không có bài mẫu công khai.
 */
export function defaultStorefrontSections(input: { tenantName: string; bio: string | null }): StorefrontSection[] {
  const tenantName = clip(input.tenantName, TITLE_MAX) || "Trang của mình";
  const bio = input.bio?.trim()
    ? clip(input.bio, TEXT_MAX)
    : "Mình chia sẻ giáo án, đề thi và tài liệu ôn luyện đã được kiểm chứng qua nhiều năm đứng lớp — giúp bạn tiết kiệm thời gian chuẩn bị và học hiệu quả hơn mỗi ngày.";

  return [
    {
      id: "hero",
      type: "hero",
      visible: true,
      data: {
        eyebrow: "Xin chào, mình là",
        title: tenantName,
        highlight: "Tài liệu học tập chất lượng, dùng được ngay",
        subtitle: bio,
        primaryCta: { label: "Xem tài liệu", href: "#tai-lieu" },
        secondaryCta: { label: "Liên hệ tư vấn", href: "#lien-he" },
      },
    },
    {
      id: "services",
      type: "services",
      visible: true,
      data: {
        title: "Mình có thể giúp gì cho bạn",
        subtitle: "Tài liệu được biên soạn kỹ, cập nhật theo chương trình mới và có hướng dẫn sử dụng rõ ràng.",
        items: [
          {
            icon: "book",
            title: "Giáo án & bài giảng",
            description: "Giáo án chi tiết theo từng bài, bám sát chương trình, chỉnh sửa được cho lớp của bạn.",
          },
          {
            icon: "exam",
            title: "Đề thi & đáp án",
            description: "Bộ đề ôn luyện theo cấu trúc mới, kèm đáp án và lời giải chi tiết từng câu.",
          },
          {
            icon: "slides",
            title: "Slide trình chiếu",
            description: "Slide đẹp, dễ trình bày, tiết kiệm hàng giờ chuẩn bị trước mỗi buổi dạy.",
          },
          {
            icon: "coaching",
            title: "Kèm cặp & tư vấn",
            description: "Trao đổi 1-1 để chọn đúng tài liệu và lộ trình phù hợp với mục tiêu của bạn.",
          },
        ],
      },
    },
    {
      id: "products",
      type: "products",
      visible: true,
      data: {
        title: "Tài liệu nổi bật",
        subtitle: "Những tài liệu được nhiều người chọn nhất — tải về ngay sau khi thanh toán.",
        limit: 6,
        featuredProductIds: [],
        ctaLabel: "Xem tất cả tài liệu",
      },
    },
    defaultStorefrontPostsSection(false),
    defaultStorefrontReviewsSection(true),
    {
      id: "testimonials",
      type: "testimonials",
      visible: true,
      data: {
        title: "Cảm nhận",
        items: [
          {
            quote: "Tài liệu trình bày rõ ràng, có lời giải chi tiết nên mình tự ôn ở nhà rất dễ. Điểm thi tiến bộ thấy rõ.",
            name: "Minh Anh",
            role: "Học sinh lớp 12",
            rating: 5,
          },
          {
            quote: "Giáo án chỉnh sửa được ngay, tiết kiệm cho mình cả buổi tối soạn bài mỗi tuần.",
            name: "Cô Thu Hà",
            role: "Giáo viên THCS",
            rating: 5,
          },
          {
            quote: "Được tư vấn tận tình để chọn đúng bộ đề phù hợp trình độ. Rất đáng tiền.",
            name: "Anh Quân",
            role: "Phụ huynh",
            rating: 5,
          },
        ],
      },
    },
    {
      id: "contact",
      type: "contact",
      visible: true,
      data: {
        title: "Liên hệ với mình",
        formEnabled: true,
        formTitle: "Gửi lời nhắn",
        successMessage: "Cảm ơn bạn! Mình đã nhận được lời nhắn và sẽ phản hồi sớm nhất có thể.",
        ctaTitle: "Bạn cần tài liệu theo yêu cầu?",
        ctaSubtitle: "Nhắn cho mình nhu cầu của bạn — mình sẽ gợi ý tài liệu hoặc lộ trình phù hợp.",
        ctaLabel: "Nhắn tin cho mình",
      },
    },
  ];
}

/**
 * ADR-029 mục 4: section `reviews` mặc định. Dùng cho nội dung demo (visible) và để bổ sung vào danh sách section
 * đã lưu trước M10 trong editor Studio (visible = false — tenant tự bật).
 */
export function defaultStorefrontReviewsSection(visible: boolean): Extract<StorefrontSection, { type: "reviews" }> {
  return {
    id: "reviews",
    type: "reviews",
    visible,
    data: { title: "Khách hàng đánh giá", limit: 6, minRating: 4, requireBody: true, pinnedReviewIds: [] },
  };
}

/**
 * ADR-029 mục 5 (M10b): section `posts` mặc định — luôn tạo ở trạng thái ẩn trong demo, và được bổ sung (ẩn) vào
 * danh sách section đã lưu trước M10b trong editor Studio để tenant tự bật.
 */
export function defaultStorefrontPostsSection(visible: boolean): Extract<StorefrontSection, { type: "posts" }> {
  return {
    id: "posts",
    type: "posts",
    visible,
    data: { title: "Bài viết mới", limit: 3, showPinnedFirst: true },
  };
}
