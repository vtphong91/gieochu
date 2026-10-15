import {
  defaultShopSections,
  parseShopSections,
  SHOP_CMS_SLUG,
  SHOP_HERO_CHIPS_MAX,
  SHOP_BY_CATEGORY_BLOCKS_MAX,
  type ShopSection,
} from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { listCategoryPinOptions, listHomeProductOptions, listHomeTenantOptions, type CategoryPinOption, type HomeProductOption, type HomeTenantOption } from "./home";

/**
 * ADR-035 GĐ1 — dữ liệu cho editor CMS Cửa hàng (`/admin/cms/shop`). Dòng `CmsPage` slug `shop` là L1 (không RLS)
 * → đọc bằng `getPrismaClient()`. Chưa có dòng → cấu hình mặc định (dòng được tạo ở lần Lưu nháp/Xuất bản đầu tiên).
 * Caller phải gác quyền SYSTEM_ADMIN (`requireAdminAccess` ở page).
 */

/** NONE = chưa có dòng `shop`; DRAFT = có dòng nhưng chưa từng xuất bản; PUBLISHED = đang hiển thị bản `blocks`. */
export type ShopCmsStatus = "NONE" | "DRAFT" | "PUBLISHED";

export interface ShopCmsPinOptions {
  tenants: HomeTenantOption[];
  products: HomeProductOption[];
  categories: CategoryPinOption[];
}

export interface ShopCmsEditorData {
  /** Bản đang soạn để nạp vào editor = nháp ?? live ?? mặc định (đã parse phòng thủ, luôn đủ 9 section). */
  sections: ShopSection[];
  /** Bản live (`blocks`) đã parse; chưa có dòng/không đọc được → mặc định. Dùng cho "Khôi phục bản đang hiển thị". */
  live: ShopSection[];
  /** Có nháp (`blocksDraft`) chưa xuất bản. */
  hasDraft: boolean;
  status: ShopCmsStatus;
  /** Lần sửa gần nhất (UTC); null khi chưa có dòng. */
  updatedAt: Date | null;
  /** Option nạp sẵn cho các ô ghim/chọn (luôn chứa id đang chọn trong live + nháp). */
  pinOptions: ShopCmsPinOptions;
}

function collectSelectedIds(sections: ShopSection[]): { tenantIds: string[]; productIds: string[]; categoryIds: string[] } {
  const tenantIds = new Set<string>();
  const productIds = new Set<string>();
  const categoryIds = new Set<string>();
  for (const section of sections) {
    if (section.type === "featured") section.data.pinnedProductIds.forEach((id) => productIds.add(id));
    if (section.type === "featuredTenants") section.data.pinnedTenantIds.forEach((id) => tenantIds.add(id));
    if (section.type === "hero") section.data.popularChips.categoryIds.forEach((id) => categoryIds.add(id));
    if (section.type === "byCategory") section.data.categoryIds.forEach((id) => categoryIds.add(id));
  }
  return { tenantIds: [...tenantIds], productIds: [...productIds], categoryIds: [...categoryIds] };
}

export async function getShopCmsEditorData(): Promise<ShopCmsEditorData> {
  const page = await getPrismaClient().cmsPage.findUnique({
    where: { slug: SHOP_CMS_SLUG },
    select: { blocks: true, blocksDraft: true, status: true, updatedAt: true },
  });

  const live = (page ? parseShopSections(page.blocks) : null) ?? defaultShopSections();
  const draft = page?.blocksDraft != null ? parseShopSections(page.blocksDraft) : null;
  const sections = draft ?? live;

  // Bản đang soạn trước (được ưu tiên khi vượt trần includeIds), rồi bản live (cho "Khôi phục").
  const selected = collectSelectedIds([...sections, ...live]);
  const [tenants, products, categories] = await Promise.all([
    listHomeTenantOptions({ includeIds: selected.tenantIds }),
    listHomeProductOptions({ includeIds: selected.productIds }),
    listCategoryPinOptions({ includeIds: selected.categoryIds, includeMax: SHOP_HERO_CHIPS_MAX + SHOP_BY_CATEGORY_BLOCKS_MAX }),
  ]);

  return {
    sections,
    live,
    hasDraft: draft !== null,
    status: page ? page.status : "NONE",
    updatedAt: page?.updatedAt ?? null,
    pinOptions: { tenants, products, categories },
  };
}
