// Chỉ import subpath client-safe (zod + helper thuần) — không qua barrel "@gieochu/core" (kéo code server-only).
import {
  SHOP_BY_CATEGORY_BLOCKS_MAX,
  SHOP_BY_CATEGORY_BLOCKS_MIN,
  SHOP_BY_CATEGORY_CARDS_MAX,
  SHOP_BY_CATEGORY_CARDS_MIN,
  SHOP_CATEGORIES_VISIBLE_MAX,
  SHOP_CATEGORIES_VISIBLE_MIN,
  SHOP_HERO_CHIPS_MAX,
  SHOP_HERO_CHIPS_MIN,
  SHOP_LIMIT_MAX,
  SHOP_LIMIT_MIN,
  SHOP_MIN_REVIEWS_MAX,
  SHOP_MIN_REVIEWS_MIN,
  SHOP_TENANT_LIMIT_MAX,
  SHOP_TENANT_LIMIT_MIN,
  shopSectionsSchema,
  type ShopSection,
  type ShopSectionType,
} from "@gieochu/core/shop-sections";

/**
 * Kiểm tra phía client trước khi gửi (ADR-035): chạy đúng schema chặt mà server dùng (`shopSectionsSchema`), rồi
 * gom lỗi theo section + field để hiện dưới từng ô và trong khung tóm tắt. Server vẫn validate lại — đây chỉ để
 * báo lỗi sớm, đúng chỗ.
 */

export interface ShopFieldIssue {
  sectionId: string;
  sectionType: ShopSectionType;
  /** Đường dẫn field trong `data`, nối bằng dấu chấm (vd `cta.href`, `popularChips.categoryIds`). `""` = lỗi cả section. */
  field: string;
  message: string;
}

/** Lỗi theo `sectionId` → `field` → thông báo. */
export type ShopErrorMap = Record<string, Record<string, string>>;

/** Nhãn field cho khung tóm tắt lỗi. */
export const SHOP_FIELD_LABELS: Record<string, string> = {
  eyebrow: "Dòng nhỏ trên tiêu đề",
  title: "Tiêu đề",
  subtitle: "Mô tả ngắn",
  description: "Đoạn mô tả",
  searchLabel: "Nhãn ô tìm kiếm",
  searchPlaceholder: "Chữ gợi ý trong ô tìm",
  "popularChips.mode": "Cách chọn chip danh mục",
  "popularChips.categoryIds": "Danh mục chip",
  "popularChips.max": "Số chip tối đa",
  imageUrl: "Ảnh minh hoạ",
  maxVisible: "Số ô hiện ngay",
  limit: "Số thẻ hiển thị",
  pinnedProductIds: "Tài liệu ghim",
  pinnedTenantIds: "Gian hàng ghim",
  mode: "Chế độ",
  categoryIds: "Danh mục chọn tay",
  blockCount: "Số khối danh mục",
  cardsPerBlock: "Số thẻ mỗi khối",
  minReviews: "Số đánh giá tối thiểu",
  minAvgTenths: "Điểm trung bình tối thiểu",
  "cta.label": "Nhãn nút",
  "cta.href": "Đường dẫn nút",
};

/** Field là danh sách id (dùng bộ chọn) — focus vào ô tìm của bộ chọn. */
export const SHOP_LIST_FIELDS = new Set(["popularChips.categoryIds", "categoryIds", "pinnedProductIds", "pinnedTenantIds"]);

/** id DOM của field (ổn định theo type — mỗi type chỉ xuất hiện 1 lần). */
export function shopFieldId(type: ShopSectionType, field: string): string {
  return `shop-${type}-${field.replace(/\./g, "-")}`;
}

function rangeMessage(min: number, max: number): string {
  return `Nhập số nguyên từ ${min} đến ${max}.`;
}

/** Thông báo cho field số — thay thông báo kỹ thuật của zod (vd khi ô đang trống/NaN). */
function numericMessage(type: ShopSectionType, field: string): string | null {
  switch (field) {
    case "limit":
      return type === "featuredTenants" ? rangeMessage(SHOP_TENANT_LIMIT_MIN, SHOP_TENANT_LIMIT_MAX) : rangeMessage(SHOP_LIMIT_MIN, SHOP_LIMIT_MAX);
    case "maxVisible":
      return rangeMessage(SHOP_CATEGORIES_VISIBLE_MIN, SHOP_CATEGORIES_VISIBLE_MAX);
    case "blockCount":
      return rangeMessage(SHOP_BY_CATEGORY_BLOCKS_MIN, SHOP_BY_CATEGORY_BLOCKS_MAX);
    case "cardsPerBlock":
      return rangeMessage(SHOP_BY_CATEGORY_CARDS_MIN, SHOP_BY_CATEGORY_CARDS_MAX);
    case "minReviews":
      return rangeMessage(SHOP_MIN_REVIEWS_MIN, SHOP_MIN_REVIEWS_MAX);
    case "popularChips.max":
      return rangeMessage(SHOP_HERO_CHIPS_MIN, SHOP_HERO_CHIPS_MAX);
    case "minAvgTenths":
      return "Nhập điểm từ 1,0 đến 5,0, tối đa một chữ số thập phân (ví dụ 4,0).";
    default:
      return null;
  }
}

/** Trả danh sách lỗi theo thứ tự section trên trang (mỗi field tối đa 1 lỗi). Rỗng = hợp lệ. */
export function validateShopSections(sections: ShopSection[]): ShopFieldIssue[] {
  const parsed = shopSectionsSchema.safeParse(sections);
  if (parsed.success) return [];

  const issues: ShopFieldIssue[] = [];
  const seen = new Set<string>();
  for (const issue of parsed.error.issues) {
    const index = typeof issue.path[0] === "number" ? issue.path[0] : -1;
    const section = sections[index];
    if (!section) continue;
    const field = issue.path[1] === "data" ? issue.path.slice(2).filter((p) => typeof p === "string").join(".") : "";
    const key = `${section.id}::${field}`;
    if (seen.has(key)) continue;
    seen.add(key);
    issues.push({
      sectionId: section.id,
      sectionType: section.type,
      field,
      message: numericMessage(section.type, field) ?? issue.message,
    });
  }
  const order = new Map(sections.map((s, i) => [s.id, i]));
  return issues.sort((a, b) => (order.get(a.sectionId) ?? 0) - (order.get(b.sectionId) ?? 0));
}

export function toShopErrorMap(issues: ShopFieldIssue[]): ShopErrorMap {
  const map: ShopErrorMap = {};
  for (const issue of issues) {
    (map[issue.sectionId] ??= {})[issue.field] = issue.message;
  }
  return map;
}
