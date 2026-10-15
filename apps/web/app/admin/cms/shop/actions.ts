"use server";

import { revalidatePath } from "next/cache";
import {
  AppError,
  defaultShopSections,
  isCloudinaryImageUrl,
  SHOP_BY_CATEGORY_BLOCKS_MAX,
  SHOP_CMS_SLUG,
  SHOP_HERO_CHIPS_MAX,
  SHOP_SECTION_LABELS,
  shopSectionsSchema,
  type ShopSection,
} from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { listCategoryPinOptions, type CategoryPinOption } from "../../../../lib/home";
import { requireRole } from "../../../../lib/session";
import { getSystemCloudinaryCloudName } from "../../../../lib/system-cloudinary";

/**
 * ADR-035 GĐ1 — CMS Cửa hàng (`CmsPage` slug `shop`, L1 không RLS). Cùng quy trình Lưu nháp / Xuất bản / Khôi phục
 * như CMS trang chủ (`../home-editor/actions.ts`), khác ở chỗ dòng `shop` có thể chưa tồn tại → `upsert` theo slug
 * (lần lưu đầu do admin thao tác tạo dòng — không seed, ADR-034). Section luôn validate lại bằng schema chặt ở server.
 *
 * Option ghim tài liệu / gian hàng: dùng chung `searchHomeProductOptionsAction` / `searchHomeTenantOptionsAction`
 * (`../home-editor/actions.ts`) — không nhân bản.
 */

export interface ShopEditorActionState {
  error?: string;
  success?: boolean;
}

/** Tiêu đề dòng CMS (cột bắt buộc) — chỉ hiện trong danh sách `/admin/cms`, không phải chuỗi thương hiệu. */
const SHOP_CMS_TITLE = "Cửa hàng";

/** Chip hero (≤8) + "Theo từng danh mục" (≤6) — số id danh mục đang chọn tối đa cần trả kèm. */
const CATEGORY_INCLUDE_MAX = SHOP_HERO_CHIPS_MAX + SHOP_BY_CATEGORY_BLOCKS_MAX;

function toActionError(error: unknown): ShopEditorActionState {
  if (error instanceof AppError && error.expose) return { error: error.message };
  throw error;
}

async function parseSections(sections: unknown): Promise<{ data: Prisma.InputJsonValue } | { error: string }> {
  const parsed = shopSectionsSchema.safeParse(sections);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    if (!issue) return { error: "Dữ liệu section không hợp lệ." };
    const index = typeof issue.path[0] === "number" ? issue.path[0] : -1;
    const rawType = Array.isArray(sections) ? (sections[index] as { type?: unknown } | undefined)?.type : undefined;
    const label = typeof rawType === "string" && rawType in SHOP_SECTION_LABELS ? SHOP_SECTION_LABELS[rawType as ShopSection["type"]] : null;
    return { error: `Dữ liệu section không hợp lệ${label ? ` (${label})` : ""}: ${issue.message}` };
  }
  // ADR-028: schema chỉ kiểm host res.cloudinary.com — ở server kiểm thêm đúng cloud hệ thống.
  const imageUrls = parsed.data.flatMap((section) => (section.type === "hero" && section.data.imageUrl ? [section.data.imageUrl] : []));
  if (imageUrls.length > 0) {
    const cloudName = await getSystemCloudinaryCloudName();
    if (imageUrls.some((url) => !isCloudinaryImageUrl(url, cloudName))) {
      return { error: `Dữ liệu section không hợp lệ (${SHOP_SECTION_LABELS.hero}): Ảnh phải được upload lên Cloudinary của hệ thống.` };
    }
  }
  // JSON round-trip bỏ key `undefined` (ảnh hero để trống) trước khi lưu Json.
  return { data: JSON.parse(JSON.stringify(parsed.data)) as Prisma.InputJsonValue };
}

function revalidateEditor(): void {
  revalidatePath("/admin/cms/shop");
  revalidatePath("/admin/cms");
}

/** Lưu nháp — chỉ ghi `blocksDraft`; bản live (`blocks`) không đổi. Chưa có dòng → tạo dòng DRAFT với live = mặc định. */
export async function saveShopDraftAction(sections: unknown): Promise<ShopEditorActionState> {
  try {
    await requireRole("SYSTEM_ADMIN");
    const parsed = await parseSections(sections);
    if ("error" in parsed) return { error: parsed.error };

    await getPrismaClient().cmsPage.upsert({
      where: { slug: SHOP_CMS_SLUG },
      update: { blocksDraft: parsed.data },
      create: {
        slug: SHOP_CMS_SLUG,
        title: SHOP_CMS_TITLE,
        blocks: defaultShopSections() as unknown as Prisma.InputJsonValue,
        blocksDraft: parsed.data,
        status: "DRAFT",
      },
    });
    revalidateEditor();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Xuất bản — `sections` (đã validate) thành bản live, xoá nháp, `status = PUBLISHED`. */
export async function publishShopAction(sections: unknown): Promise<ShopEditorActionState> {
  try {
    await requireRole("SYSTEM_ADMIN");
    const parsed = await parseSections(sections);
    if ("error" in parsed) return { error: parsed.error };

    await getPrismaClient().cmsPage.upsert({
      where: { slug: SHOP_CMS_SLUG },
      update: { blocks: parsed.data, blocksDraft: Prisma.DbNull, status: "PUBLISHED" },
      create: { slug: SHOP_CMS_SLUG, title: SHOP_CMS_TITLE, blocks: parsed.data, status: "PUBLISHED" },
    });
    revalidateEditor();
    revalidatePath("/cua-hang");
    revalidatePath("/cua-hang/tai-lieu");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Khôi phục bản đang hiển thị — xoá `blocksDraft` (huỷ mọi thay đổi chưa xuất bản). Chưa có dòng → không làm gì. */
export async function restoreLiveShopAction(): Promise<ShopEditorActionState> {
  try {
    await requireRole("SYSTEM_ADMIN");
    await getPrismaClient().cmsPage.updateMany({ where: { slug: SHOP_CMS_SLUG }, data: { blocksDraft: Prisma.DbNull } });
    revalidateEditor();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Tìm danh mục cho bộ chọn tay (chip hero / "Theo từng danh mục"): danh mục đang bật (lọc theo tên, tối đa 200) +
 * các id đang chọn (kể cả đã tắt, `eligible:false`). Map sang `PinOption` bằng `toCategoryPinOption`.
 */
export async function searchShopCategoryOptionsAction(search: unknown, includeIds: unknown): Promise<CategoryPinOption[]> {
  await requireRole("SYSTEM_ADMIN");
  const ids = Array.isArray(includeIds)
    ? includeIds.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64).slice(0, CATEGORY_INCLUDE_MAX)
    : [];
  return listCategoryPinOptions({ search: typeof search === "string" ? search : undefined, includeIds: ids, includeMax: CATEGORY_INCLUDE_MAX });
}
