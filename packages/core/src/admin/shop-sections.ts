import { z } from "zod";
import { isCloudinaryImageUrl, isSafeStorefrontHref } from "../tenant/storefront-sections";

/**
 * ADR-035 (+ bổ sung) — cấu hình trang Cửa hàng `/cua-hang`, lưu ở `CmsPage.slug = "shop"` (`blocks` = bản live,
 * `blocksDraft` = nháp). Cùng mô hình với `homeSectionsSchema`: mảng có thứ tự (= thứ tự hiển thị), mỗi phần tử
 * `{ id, type, visible, data }`, mỗi `type` xuất hiện tối đa 1 lần. CMS chỉ lưu nhãn/cấu hình — dữ liệu tài liệu,
 * gian hàng, số liệu luôn lấy thật ở GĐ2 (`lib/shop.ts`).
 *
 * - Lúc LƯU: `shopSectionsSchema` (chặt).
 * - Lúc ĐỌC (render + nạp editor): `parseShopSections` (phòng thủ — field hỏng về mặc định của field, section thiếu
 *   được thêm ở trạng thái ẩn).
 *
 * File này chỉ import zod + helper thuần — client component (editor) dùng qua subpath `@gieochu/core/shop-sections`.
 * Không chứa chuỗi thương hiệu.
 */

// ───────────── Giới hạn ─────────────

export const SHOP_EYEBROW_MAX = 60;
export const SHOP_TITLE_MAX = 120;
export const SHOP_SUBTITLE_MAX = 240;
export const SHOP_LABEL_MAX = 60;
export const SHOP_PLACEHOLDER_MAX = 100;
export const SHOP_DESCRIPTION_MAX = 300;
export const SHOP_HREF_MAX = 200;
export const SHOP_ID_MAX = 64;

/** Số thẻ tài liệu của các kệ featured/bestSellers/topRated/newest. */
export const SHOP_LIMIT_MIN = 4;
export const SHOP_LIMIT_MAX = 12;
export const SHOP_PRODUCT_DEFAULT_LIMIT = 8;
/** Số thẻ gian hàng nổi bật. */
export const SHOP_TENANT_LIMIT_MIN = 3;
export const SHOP_TENANT_LIMIT_MAX = 12;
export const SHOP_TENANT_DEFAULT_LIMIT = 4;
/** Tối đa id ghim mỗi section (tài liệu / gian hàng). */
export const SHOP_PINNED_MAX = 12;
/** Chip danh mục phổ biến ở hero. */
export const SHOP_HERO_CHIPS_MIN = 3;
export const SHOP_HERO_CHIPS_MAX = 8;
export const SHOP_HERO_CHIPS_DEFAULT = 6;
/** Ô danh mục hiện ngay (phần dư vào `<details>`). */
export const SHOP_CATEGORIES_VISIBLE_MIN = 6;
export const SHOP_CATEGORIES_VISIBLE_MAX = 24;
export const SHOP_CATEGORIES_VISIBLE_DEFAULT = 12;
/** "Theo từng danh mục": ≤6 khối × ≤4 thẻ (ADR-035 mục 2). */
export const SHOP_BY_CATEGORY_BLOCKS_MIN = 1;
export const SHOP_BY_CATEGORY_BLOCKS_MAX = 6;
export const SHOP_BY_CATEGORY_CARDS_MIN = 2;
export const SHOP_BY_CATEGORY_CARDS_MAX = 4;
/** Ngưỡng số đánh giá tối thiểu. */
export const SHOP_MIN_REVIEWS_MIN = 1;
export const SHOP_MIN_REVIEWS_MAX = 50;
export const SHOP_MIN_REVIEWS_DEFAULT = 3;
/** Ngưỡng điểm TB lưu số nguyên ×10 (40 = 4,0) — ADR-035 bổ sung. */
export const SHOP_MIN_AVG_TENTHS_MIN = 10;
export const SHOP_MIN_AVG_TENTHS_MAX = 50;
export const SHOP_MIN_AVG_TENTHS_DEFAULT = 40;

export const SHOP_SECTION_TYPES = [
  "hero",
  "categories",
  "featured",
  "byCategory",
  "bestSellers",
  "topRated",
  "featuredTenants",
  "newest",
  "ctaOpenStore",
] as const;
export type ShopSectionType = (typeof SHOP_SECTION_TYPES)[number];

export const SHOP_CATEGORY_MODES = ["AUTO", "MANUAL"] as const;
export type ShopCategoryMode = (typeof SHOP_CATEGORY_MODES)[number];

export const SHOP_FEATURED_TENANTS_MODES = ["SALES_30D", "TOP_RATED"] as const;
export type ShopFeaturedTenantsMode = (typeof SHOP_FEATURED_TENANTS_MODES)[number];

// ───────────── Schema chặt (dùng khi lưu) ─────────────

const UNSAFE_URL_CHARS = /[\s\u0000-\u001f\u007f\\]/;

const requiredText = (max: number) =>
  z.string().trim().min(1, "Không được để trống.").max(max, `Tối đa ${max} ký tự.`);

const intIn = (min: number, max: number) =>
  z.number().int("Phải là số nguyên.").min(min, `Tối thiểu ${min}.`).max(max, `Tối đa ${max}.`);

const idListSchema = (max: number, duplicateMessage: string) =>
  z
    .array(z.string().trim().min(1).max(SHOP_ID_MAX))
    .max(max, `Tối đa ${max} mục.`)
    .refine((ids) => new Set(ids).size === ids.length, duplicateMessage);

/** Chỉ đường dẫn nội bộ `/…` (không `//`, không ký tự điều khiển/backslash). */
export function isInternalShopHref(value: string): boolean {
  return (
    value.length > 0 &&
    value.length <= SHOP_HREF_MAX &&
    value.startsWith("/") &&
    !value.startsWith("//") &&
    !UNSAFE_URL_CHARS.test(value) &&
    isSafeStorefrontHref(value)
  );
}

const internalHrefSchema = z.string().trim().refine(isInternalShopHref, "Liên kết phải là đường dẫn nội bộ bắt đầu bằng /.");

const blankToUndefined = (value: unknown) => (typeof value === "string" && value.trim() === "" ? undefined : value);
const optionalImageUrl = z.preprocess(
  blankToUndefined,
  z.string().trim().refine((value) => isCloudinaryImageUrl(value), "Ảnh phải được upload lên Cloudinary.").optional(),
);

const titleFields = { title: requiredText(SHOP_TITLE_MAX), subtitle: requiredText(SHOP_SUBTITLE_MAX) };
const productLimit = intIn(SHOP_LIMIT_MIN, SHOP_LIMIT_MAX);
const minReviews = intIn(SHOP_MIN_REVIEWS_MIN, SHOP_MIN_REVIEWS_MAX);
const minAvgTenths = intIn(SHOP_MIN_AVG_TENTHS_MIN, SHOP_MIN_AVG_TENTHS_MAX);

const popularChipsSchema = z
  .object({
    mode: z.enum(SHOP_CATEGORY_MODES),
    categoryIds: idListSchema(SHOP_HERO_CHIPS_MAX, "Danh mục chip bị trùng."),
    max: intIn(SHOP_HERO_CHIPS_MIN, SHOP_HERO_CHIPS_MAX),
  })
  .refine((chips) => chips.mode !== "MANUAL" || chips.categoryIds.length > 0, {
    message: "Chế độ chọn tay cần ít nhất 1 danh mục.",
    path: ["categoryIds"],
  });

const heroDataSchema = z.object({
  eyebrow: requiredText(SHOP_EYEBROW_MAX),
  title: requiredText(SHOP_TITLE_MAX),
  subtitle: requiredText(SHOP_SUBTITLE_MAX),
  searchLabel: requiredText(SHOP_LABEL_MAX),
  searchPlaceholder: requiredText(SHOP_PLACEHOLDER_MAX),
  popularChips: popularChipsSchema,
  /** Trống → minh hoạ mặc định; có → ảnh Cloudinary của hệ thống (ADR-028, server kiểm thêm cloud name). */
  imageUrl: optionalImageUrl,
});

const categoriesDataSchema = z.object({
  ...titleFields,
  maxVisible: intIn(SHOP_CATEGORIES_VISIBLE_MIN, SHOP_CATEGORIES_VISIBLE_MAX),
});

const featuredDataSchema = z.object({
  ...titleFields,
  limit: productLimit,
  /** Tài liệu ghim trước (đúng thứ tự) — riêng của Cửa hàng; id không còn Công khai bị bỏ khi render. */
  pinnedProductIds: idListSchema(SHOP_PINNED_MAX, "Danh sách ghim bị trùng."),
});

const byCategoryDataSchema = z
  .object({
    ...titleFields,
    mode: z.enum(SHOP_CATEGORY_MODES),
    categoryIds: idListSchema(SHOP_BY_CATEGORY_BLOCKS_MAX, "Danh mục bị trùng."),
    blockCount: intIn(SHOP_BY_CATEGORY_BLOCKS_MIN, SHOP_BY_CATEGORY_BLOCKS_MAX),
    cardsPerBlock: intIn(SHOP_BY_CATEGORY_CARDS_MIN, SHOP_BY_CATEGORY_CARDS_MAX),
  })
  .refine((data) => data.mode !== "MANUAL" || data.categoryIds.length > 0, {
    message: "Chế độ chọn tay cần ít nhất 1 danh mục.",
    path: ["categoryIds"],
  });

const simpleShelfDataSchema = z.object({ ...titleFields, limit: productLimit });

const topRatedDataSchema = z.object({ ...titleFields, limit: productLimit, minReviews, minAvgTenths });

const featuredTenantsDataSchema = z.object({
  ...titleFields,
  mode: z.enum(SHOP_FEATURED_TENANTS_MODES),
  limit: intIn(SHOP_TENANT_LIMIT_MIN, SHOP_TENANT_LIMIT_MAX),
  pinnedTenantIds: idListSchema(SHOP_PINNED_MAX, "Danh sách ghim bị trùng."),
  /** Chỉ dùng ở chế độ TOP_RATED: tổng số đánh giá tối thiểu của gian hàng. */
  minReviews,
});

const ctaOpenStoreDataSchema = z.object({
  eyebrow: requiredText(SHOP_EYEBROW_MAX),
  title: requiredText(SHOP_TITLE_MAX),
  description: requiredText(SHOP_DESCRIPTION_MAX),
  cta: z.object({ label: requiredText(SHOP_LABEL_MAX), href: internalHrefSchema }),
});

const sectionBaseFields = { id: z.string().trim().min(1).max(SHOP_ID_MAX), visible: z.boolean() };

export const shopSectionSchema = z.discriminatedUnion(
  "type",
  [
    z.object({ ...sectionBaseFields, type: z.literal("hero"), data: heroDataSchema }),
    z.object({ ...sectionBaseFields, type: z.literal("categories"), data: categoriesDataSchema }),
    z.object({ ...sectionBaseFields, type: z.literal("featured"), data: featuredDataSchema }),
    z.object({ ...sectionBaseFields, type: z.literal("byCategory"), data: byCategoryDataSchema }),
    z.object({ ...sectionBaseFields, type: z.literal("bestSellers"), data: simpleShelfDataSchema }),
    z.object({ ...sectionBaseFields, type: z.literal("topRated"), data: topRatedDataSchema }),
    z.object({ ...sectionBaseFields, type: z.literal("featuredTenants"), data: featuredTenantsDataSchema }),
    z.object({ ...sectionBaseFields, type: z.literal("newest"), data: simpleShelfDataSchema }),
    z.object({ ...sectionBaseFields, type: z.literal("ctaOpenStore"), data: ctaOpenStoreDataSchema }),
  ],
  // Lỗi ở mức section (không phải object / `type` lạ) — lỗi field lồng bên trong vẫn giữ thông báo riêng.
  { error: "Section không hợp lệ hoặc loại section không được hỗ trợ." },
);

export const shopSectionsSchema = z
  .array(shopSectionSchema, { error: "Danh sách section phải là một mảng." })
  .min(1, "Cần ít nhất 1 section.")
  .max(SHOP_SECTION_TYPES.length, `Tối đa ${SHOP_SECTION_TYPES.length} section (mỗi loại 1 lần).`)
  .superRefine((sections, ctx) => {
    const seenTypes = new Set<string>();
    const seenIds = new Set<string>();
    sections.forEach((section, index) => {
      if (seenTypes.has(section.type)) {
        ctx.addIssue({ code: "custom", path: [index, "type"], message: "Mỗi loại section chỉ được xuất hiện 1 lần." });
      }
      if (seenIds.has(section.id)) {
        ctx.addIssue({ code: "custom", path: [index, "id"], message: "id section bị trùng." });
      }
      seenTypes.add(section.type);
      seenIds.add(section.id);
    });
  });

export type ShopSection = z.infer<typeof shopSectionSchema>;
export type ShopSectionData<T extends ShopSectionType> = Extract<ShopSection, { type: T }>["data"];
export type ShopHeroData = ShopSectionData<"hero">;
export type ShopCategoriesData = ShopSectionData<"categories">;
export type ShopFeaturedData = ShopSectionData<"featured">;
export type ShopByCategoryData = ShopSectionData<"byCategory">;
export type ShopShelfData = ShopSectionData<"bestSellers">;
export type ShopTopRatedData = ShopSectionData<"topRated">;
export type ShopFeaturedTenantsData = ShopSectionData<"featuredTenants">;
export type ShopCtaOpenStoreData = ShopSectionData<"ctaOpenStore">;

export const SHOP_SECTION_LABELS: Record<ShopSectionType, string> = {
  hero: "Hero — Tìm kiếm",
  categories: "Danh mục",
  featured: "Tài liệu nổi bật",
  byCategory: "Theo từng danh mục",
  bestSellers: "Bán chạy",
  topRated: "Đánh giá cao",
  featuredTenants: "Gian hàng nổi bật",
  newest: "Mới cập nhật",
  ctaOpenStore: "Kêu gọi mở gian hàng",
};

export const SHOP_FEATURED_TENANTS_MODE_LABELS: Record<ShopFeaturedTenantsMode, string> = {
  SALES_30D: "Bán chạy trong 30 ngày",
  TOP_RATED: "Đánh giá cao",
};

export const SHOP_CATEGORY_MODE_LABELS: Record<ShopCategoryMode, string> = {
  AUTO: "Tự động (nhiều tài liệu nhất)",
  MANUAL: "Chọn tay",
};

export function isValidShopSections(input: unknown): boolean {
  return shopSectionsSchema.safeParse(input).success;
}

// ───────────── Mặc định (tiếng Việt, không chuỗi thương hiệu) ─────────────

const DEFAULT_DATA: { [T in ShopSectionType]: ShopSectionData<T> } = {
  hero: {
    eyebrow: "Cửa hàng tài liệu",
    title: "Tìm tài liệu dạy và học bạn cần",
    subtitle: "Giáo án, đề thi, slide bài giảng từ giáo viên và coach trên khắp cả nước.",
    searchLabel: "Tìm tài liệu",
    searchPlaceholder: "Tên tài liệu, môn học, giáo viên…",
    popularChips: { mode: "AUTO", categoryIds: [], max: SHOP_HERO_CHIPS_DEFAULT },
  },
  categories: {
    title: "Khám phá theo danh mục",
    subtitle: "Chọn nhanh nhóm tài liệu bạn quan tâm",
    maxVisible: SHOP_CATEGORIES_VISIBLE_DEFAULT,
  },
  featured: {
    title: "Tài liệu nổi bật",
    subtitle: "Được người mua tin dùng và đánh giá cao",
    limit: SHOP_PRODUCT_DEFAULT_LIMIT,
    pinnedProductIds: [],
  },
  byCategory: {
    title: "Theo từng danh mục",
    subtitle: "Tài liệu tiêu biểu trong các danh mục được quan tâm nhiều nhất",
    mode: "AUTO",
    categoryIds: [],
    blockCount: SHOP_BY_CATEGORY_BLOCKS_MAX,
    cardsPerBlock: SHOP_BY_CATEGORY_CARDS_MAX,
  },
  bestSellers: {
    title: "Bán chạy",
    subtitle: "Những tài liệu được mua nhiều nhất",
    limit: SHOP_PRODUCT_DEFAULT_LIMIT,
  },
  topRated: {
    title: "Đánh giá cao",
    subtitle: "Tài liệu được người mua chấm điểm cao",
    limit: SHOP_PRODUCT_DEFAULT_LIMIT,
    minReviews: SHOP_MIN_REVIEWS_DEFAULT,
    minAvgTenths: SHOP_MIN_AVG_TENTHS_DEFAULT,
  },
  featuredTenants: {
    title: "Gian hàng nổi bật",
    subtitle: "Giáo viên và coach được người mua tin chọn",
    mode: "SALES_30D",
    limit: SHOP_TENANT_DEFAULT_LIMIT,
    pinnedTenantIds: [],
    minReviews: SHOP_MIN_REVIEWS_DEFAULT,
  },
  newest: {
    title: "Mới cập nhật",
    subtitle: "Tài liệu vừa được đăng bán",
    limit: SHOP_PRODUCT_DEFAULT_LIMIT,
  },
  ctaOpenStore: {
    eyebrow: "Dành cho giáo viên & coach",
    title: "Mở gian hàng, bán tài liệu của bạn",
    description: "Đăng tài liệu, nhận thanh toán và giao file tự động cho người mua.",
    cta: { label: "Mở gian hàng miễn phí", href: "/register" },
  },
};

/** id mặc định của section theo type (ổn định — editor/React key dùng được). */
export function defaultShopSectionId(type: ShopSectionType): string {
  return `shop-${type}`;
}

/** Bản sao sâu `data` mặc định của một loại section. */
export function defaultShopSectionData<T extends ShopSectionType>(type: T): ShopSectionData<T> {
  return structuredClone(DEFAULT_DATA[type]) as unknown as ShopSectionData<T>;
}

function defaultSection(type: ShopSectionType, visible: boolean, id = defaultShopSectionId(type)): ShopSection {
  return { id, type, visible, data: defaultShopSectionData(type) } as ShopSection;
}

/** Cấu hình mặc định đầy đủ 9 section theo thứ tự ADR-035 mục 2, tất cả hiện — luôn trả bản sao mới. */
export function defaultShopSections(): ShopSection[] {
  return SHOP_SECTION_TYPES.map((type) => defaultSection(type, true));
}

/** Hằng tham chiếu (đừng sửa trực tiếp — cần bản sửa được thì gọi `defaultShopSections()`). */
export const DEFAULT_SHOP_SECTIONS: readonly ShopSection[] = Object.freeze(defaultShopSections());

// ───────────── Ngưỡng điểm ×10 ↔ chuỗi hiển thị ─────────────

/** 40 → "4,0" (hiển thị trong editor / tiêu chí dưới tiêu đề). */
export function formatShopAvgTenths(tenths: number): string {
  const value = Math.trunc(tenths);
  return `${Math.trunc(value / 10)},${Math.abs(value % 10)}`;
}

/** "4,0" | "4.0" | "4" → 40; ngoài 1,0–5,0 hoặc quá 1 chữ số thập phân → null. Không dùng float. */
export function parseShopAvgTenthsInput(text: string): number | null {
  const match = /^\s*(\d)(?:[.,](\d))?\s*$/.exec(text);
  if (!match) return null;
  const tenths = Number(match[1]) * 10 + Number(match[2] ?? "0");
  return tenths >= SHOP_MIN_AVG_TENTHS_MIN && tenths <= SHOP_MIN_AVG_TENTHS_MAX ? tenths : null;
}

// ───────────── Parse phòng thủ (ADR-035 bổ sung) ─────────────

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function textOr(value: unknown, max: number, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.length <= max ? trimmed : fallback;
}

function intOr(value: unknown, min: number, max: number, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}

function enumOr<T extends string>(value: unknown, options: readonly T[], fallback: T): T {
  return typeof value === "string" && (options as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Lọc id: chuỗi, trim, 1–64 ký tự, không trùng, tối đa `max` (giữ thứ tự). */
function idsOr(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return [];
  const ids: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") continue;
    const id = item.trim();
    if (id.length === 0 || id.length > SHOP_ID_MAX || ids.includes(id)) continue;
    ids.push(id);
    if (ids.length >= max) break;
  }
  return ids;
}

function categoryPick(rawMode: unknown, rawIds: unknown, max: number): { mode: ShopCategoryMode; categoryIds: string[] } {
  const categoryIds = idsOr(rawIds, max);
  const mode = enumOr(rawMode, SHOP_CATEGORY_MODES, "AUTO");
  // MANUAL mà không còn danh mục nào → về AUTO (schema chặt không cho lưu MANUAL rỗng).
  return { mode: mode === "MANUAL" && categoryIds.length === 0 ? "AUTO" : mode, categoryIds };
}

function normalizeTitles(data: Record<string, unknown>, fallback: { title: string; subtitle: string }) {
  return {
    title: textOr(data.title, SHOP_TITLE_MAX, fallback.title),
    subtitle: textOr(data.subtitle, SHOP_SUBTITLE_MAX, fallback.subtitle),
  };
}

/** Chuẩn hoá `data` của một section: field hợp lệ giữ nguyên, field thiếu/sai → mặc định của field đó. */
function normalizeShopSectionData(type: ShopSectionType, rawData: unknown): ShopSection["data"] {
  const data = asRecord(rawData);
  switch (type) {
    case "hero": {
      const d = DEFAULT_DATA.hero;
      const chips = asRecord(data.popularChips);
      const imageUrl = typeof data.imageUrl === "string" && isCloudinaryImageUrl(data.imageUrl.trim()) ? data.imageUrl.trim() : undefined;
      return {
        eyebrow: textOr(data.eyebrow, SHOP_EYEBROW_MAX, d.eyebrow),
        title: textOr(data.title, SHOP_TITLE_MAX, d.title),
        subtitle: textOr(data.subtitle, SHOP_SUBTITLE_MAX, d.subtitle),
        searchLabel: textOr(data.searchLabel, SHOP_LABEL_MAX, d.searchLabel),
        searchPlaceholder: textOr(data.searchPlaceholder, SHOP_PLACEHOLDER_MAX, d.searchPlaceholder),
        popularChips: {
          ...categoryPick(chips.mode, chips.categoryIds, SHOP_HERO_CHIPS_MAX),
          max: intOr(chips.max, SHOP_HERO_CHIPS_MIN, SHOP_HERO_CHIPS_MAX, d.popularChips.max),
        },
        ...(imageUrl ? { imageUrl } : {}),
      } satisfies ShopHeroData;
    }
    case "categories": {
      const d = DEFAULT_DATA.categories;
      return {
        ...normalizeTitles(data, d),
        maxVisible: intOr(data.maxVisible, SHOP_CATEGORIES_VISIBLE_MIN, SHOP_CATEGORIES_VISIBLE_MAX, d.maxVisible),
      } satisfies ShopCategoriesData;
    }
    case "featured": {
      const d = DEFAULT_DATA.featured;
      return {
        ...normalizeTitles(data, d),
        limit: intOr(data.limit, SHOP_LIMIT_MIN, SHOP_LIMIT_MAX, d.limit),
        pinnedProductIds: idsOr(data.pinnedProductIds, SHOP_PINNED_MAX),
      } satisfies ShopFeaturedData;
    }
    case "byCategory": {
      const d = DEFAULT_DATA.byCategory;
      return {
        ...normalizeTitles(data, d),
        ...categoryPick(data.mode, data.categoryIds, SHOP_BY_CATEGORY_BLOCKS_MAX),
        blockCount: intOr(data.blockCount, SHOP_BY_CATEGORY_BLOCKS_MIN, SHOP_BY_CATEGORY_BLOCKS_MAX, d.blockCount),
        cardsPerBlock: intOr(data.cardsPerBlock, SHOP_BY_CATEGORY_CARDS_MIN, SHOP_BY_CATEGORY_CARDS_MAX, d.cardsPerBlock),
      } satisfies ShopByCategoryData;
    }
    case "bestSellers":
    case "newest": {
      const d = DEFAULT_DATA[type];
      return {
        ...normalizeTitles(data, d),
        limit: intOr(data.limit, SHOP_LIMIT_MIN, SHOP_LIMIT_MAX, d.limit),
      } satisfies ShopShelfData;
    }
    case "topRated": {
      const d = DEFAULT_DATA.topRated;
      return {
        ...normalizeTitles(data, d),
        limit: intOr(data.limit, SHOP_LIMIT_MIN, SHOP_LIMIT_MAX, d.limit),
        minReviews: intOr(data.minReviews, SHOP_MIN_REVIEWS_MIN, SHOP_MIN_REVIEWS_MAX, d.minReviews),
        minAvgTenths: intOr(data.minAvgTenths, SHOP_MIN_AVG_TENTHS_MIN, SHOP_MIN_AVG_TENTHS_MAX, d.minAvgTenths),
      } satisfies ShopTopRatedData;
    }
    case "featuredTenants": {
      const d = DEFAULT_DATA.featuredTenants;
      return {
        ...normalizeTitles(data, d),
        mode: enumOr(data.mode, SHOP_FEATURED_TENANTS_MODES, d.mode),
        limit: intOr(data.limit, SHOP_TENANT_LIMIT_MIN, SHOP_TENANT_LIMIT_MAX, d.limit),
        pinnedTenantIds: idsOr(data.pinnedTenantIds, SHOP_PINNED_MAX),
        minReviews: intOr(data.minReviews, SHOP_MIN_REVIEWS_MIN, SHOP_MIN_REVIEWS_MAX, d.minReviews),
      } satisfies ShopFeaturedTenantsData;
    }
    case "ctaOpenStore": {
      const d = DEFAULT_DATA.ctaOpenStore;
      const cta = asRecord(data.cta);
      const href = typeof cta.href === "string" && isInternalShopHref(cta.href.trim()) ? cta.href.trim() : d.cta.href;
      return {
        eyebrow: textOr(data.eyebrow, SHOP_EYEBROW_MAX, d.eyebrow),
        title: textOr(data.title, SHOP_TITLE_MAX, d.title),
        description: textOr(data.description, SHOP_DESCRIPTION_MAX, d.description),
        cta: { label: textOr(cta.label, SHOP_LABEL_MAX, d.cta.label), href },
      } satisfies ShopCtaOpenStoreData;
    }
  }
}

/**
 * Đọc `CmsPage.blocks/blocksDraft` của Cửa hàng một cách phòng thủ (render + nạp editor; KHÔNG dùng khi lưu):
 *  - Không phải mảng → `null` (caller dùng `defaultShopSections()`).
 *  - Phần tử không phải object / `type` lạ → bỏ.
 *  - Trùng `type` → giữ phần tử đầu. `id` thiếu/sai/trùng → dùng id mặc định của type (nếu còn trống).
 *  - `visible` không phải boolean → `true`.
 *  - `data` hỏng → chuẩn hoá từng field về mặc định của field đó (không bỏ cả section/trang).
 *  - Type còn thiếu → thêm cuối mảng từ mặc định ở trạng thái **ẩn** (ADR-035 bổ sung).
 * Kết quả luôn đủ 9 section và hợp lệ theo `shopSectionsSchema`.
 */
export function parseShopSections(input: unknown): ShopSection[] | null {
  if (!Array.isArray(input)) return null;
  const sections: ShopSection[] = [];
  const seenTypes = new Set<ShopSectionType>();
  const seenIds = new Set<string>();

  for (const raw of input) {
    const record = asRecord(raw);
    const type = record.type;
    if (typeof type !== "string" || !(SHOP_SECTION_TYPES as readonly string[]).includes(type)) continue;
    const sectionType = type as ShopSectionType;
    if (seenTypes.has(sectionType)) continue;

    const rawId = typeof record.id === "string" ? record.id.trim() : "";
    let id = rawId.length > 0 && rawId.length <= SHOP_ID_MAX && !seenIds.has(rawId) ? rawId : defaultShopSectionId(sectionType);
    if (seenIds.has(id)) id = `${defaultShopSectionId(sectionType)}-${sections.length}`;

    const section = {
      id,
      type: sectionType,
      visible: typeof record.visible === "boolean" ? record.visible : true,
      data: normalizeShopSectionData(sectionType, record.data),
    } as ShopSection;
    // Lưới an toàn: kết quả chuẩn hoá luôn phải qua schema chặt; không qua → mặc định của section (giữ id/visible).
    const parsed = shopSectionSchema.safeParse(section);
    sections.push(parsed.success ? parsed.data : defaultSection(sectionType, section.visible, id));
    seenTypes.add(sectionType);
    seenIds.add(id);
  }

  for (const type of SHOP_SECTION_TYPES) {
    if (seenTypes.has(type)) continue;
    let id = defaultShopSectionId(type);
    if (seenIds.has(id)) id = `${id}-${sections.length}`;
    sections.push(defaultSection(type, false, id));
    seenIds.add(id);
  }
  return sections;
}

/** Tiện ích: parse phòng thủ, không đọc được → cấu hình mặc định (dùng cho render `/cua-hang` khi chưa có/chưa xuất bản). */
export function resolveShopSections(input: unknown): ShopSection[] {
  return parseShopSections(input) ?? defaultShopSections();
}
