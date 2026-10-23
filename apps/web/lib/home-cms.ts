import { cache } from "react";
import {
  defaultHomeSections,
  HOME_CMS_SLUG,
  parseHomeSections,
  withMissingHomeSections,
  type HomeSection,
} from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { listHomeProductOptions, listHomeTenantOptions, type HomeProductOption, type HomeTenantOption } from "./home";

/**
 * ADR-033 + ADR-050 — nội dung CMS trang chủ (`CmsPage` slug `home`, L1 không RLS → `getPrismaClient()`).
 *  - `getHomePageContent()`: cho `app/page.tsx` (page + `generateMetadata`, `cache()` theo request). Chỉ bản
 *    PUBLISHED được dùng; chưa xuất bản / không đọc được section nào → `defaultHomeSections()` (brief trang chủ).
 *  - `getHomeCmsEditorData()`: cho editor `/admin/cms/home` — caller gác SYSTEM_ADMIN.
 */

export interface HomePageContent {
  sections: HomeSection[];
  /** true = đang hiển thị nội dung mặc định (chưa có bản PUBLISHED dùng được). */
  isDefault: boolean;
  /** SEO CMS (chỉ khi PUBLISHED, không rỗng); `null` → route dùng mặc định brief. */
  seoTitle: string | null;
  seoDescription: string | null;
}

export const getHomePageContent = cache(async function getHomePageContent(): Promise<HomePageContent> {
  const page = await getPrismaClient().cmsPage.findUnique({
    where: { slug: HOME_CMS_SLUG },
    select: { blocks: true, status: true, seoTitle: true, seoDescription: true },
  });
  const published = page?.status === "PUBLISHED";
  const parsed = published ? parseHomeSections(page.blocks) : null;
  const usable = parsed !== null && parsed.length > 0;
  return {
    sections: usable ? parsed : defaultHomeSections(),
    isDefault: !usable,
    seoTitle: published ? page.seoTitle?.trim() || null : null,
    seoDescription: published ? page.seoDescription?.trim() || null : null,
  };
});

export type HomeCmsStatus = "NONE" | "DRAFT" | "PUBLISHED";

export interface HomeCmsEditorData {
  /** Bản đang soạn = nháp ?? live (đã thêm ẩn các loại section còn thiếu). */
  sections: HomeSection[];
  /** Bản live (hoặc mặc định khi chưa có dòng) — cho "Khôi phục bản đang hiển thị". */
  live: HomeSection[];
  hasDraft: boolean;
  status: HomeCmsStatus;
  seoTitle: string;
  seoDescription: string;
  pinOptions: { tenants: HomeTenantOption[]; products: HomeProductOption[] };
}

/** Id đang ghim ở mọi section coaches/documents (live + nháp) — để ô chọn luôn hiện được tên. */
function collectPinnedIds(sections: HomeSection[]): { tenantIds: string[]; productIds: string[] } {
  const tenantIds = new Set<string>();
  const productIds = new Set<string>();
  for (const section of sections) {
    if (section.type === "coaches") section.data.pinnedTenantIds.forEach((id) => tenantIds.add(id));
    if (section.type === "documents") section.data.pinnedProductIds.forEach((id) => productIds.add(id));
  }
  return { tenantIds: [...tenantIds], productIds: [...productIds] };
}

export async function getHomeCmsEditorData(): Promise<HomeCmsEditorData> {
  const page = await getPrismaClient().cmsPage.findUnique({
    where: { slug: HOME_CMS_SLUG },
    select: { blocks: true, blocksDraft: true, status: true, seoTitle: true, seoDescription: true },
  });
  // ADR-033 mục 6 + ADR-050: parse phòng thủ (dữ liệu cũ chuyển dạng mới), bổ sung ẩn các section mới còn thiếu.
  const parsedLive = page ? parseHomeSections(page.blocks) : null;
  const live = withMissingHomeSections(parsedLive && parsedLive.length > 0 ? parsedLive : defaultHomeSections());
  const parsedDraft = page?.blocksDraft != null ? parseHomeSections(page.blocksDraft) : null;
  const draft = parsedDraft && parsedDraft.length > 0 ? withMissingHomeSections(parsedDraft) : null;
  const sections = draft ?? live;

  const pinned = collectPinnedIds([...sections, ...live]);
  const [tenants, products] = await Promise.all([
    listHomeTenantOptions({ includeIds: pinned.tenantIds }),
    listHomeProductOptions({ includeIds: pinned.productIds }),
  ]);

  return {
    sections,
    live,
    hasDraft: draft !== null,
    status: page ? page.status : "NONE",
    seoTitle: page?.seoTitle ?? "",
    seoDescription: page?.seoDescription ?? "",
    pinOptions: { tenants, products },
  };
}
