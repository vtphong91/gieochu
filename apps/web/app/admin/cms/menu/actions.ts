"use server";

import { revalidatePath } from "next/cache";
import { AppError, defaultSiteMenu, MENU_CMS_SLUG, siteMenuSchema } from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { audit } from "../../../../lib/audit";
import { requireRole } from "../../../../lib/session";

/**
 * ADR-050 mục 1 — CMS menu header/footer (`CmsPage` slug `menu`, L1 không RLS). Cùng quy trình Lưu nháp / Xuất bản /
 * Khôi phục như CMS Cửa hàng/Bảng giá: dòng có thể chưa tồn tại → `upsert` theo slug (không seed, ADR-034). Mỗi action
 * tự `requireRole("SYSTEM_ADMIN")`; menu luôn validate lại bằng `siteMenuSchema` chặt (link `javascript:`/`data:`/
 * `http:`/preview bị từ chối) ở server. Ghi audit `MENU_CMS_UPDATED` (metadata chỉ loại thao tác).
 */

export interface MenuEditorActionState {
  success?: boolean;
  error?: string;
  /** Lỗi chi tiết: `path` là đường dẫn chấm trong menu (vd `header.items.0.target`). */
  issues?: { path: string; message: string }[];
}

/** Tiêu đề dòng CMS (cột bắt buộc) — chỉ hiện trong danh sách `/admin/cms`. */
const MENU_CMS_TITLE = "Menu header/footer";

function toActionError(error: unknown): MenuEditorActionState {
  if (error instanceof AppError && error.expose) return { error: error.message };
  throw error;
}

function parseMenu(menu: unknown): { data: Prisma.InputJsonValue } | MenuEditorActionState {
  const parsed = siteMenuSchema.safeParse(menu);
  if (!parsed.success) {
    const issues = parsed.error.issues.slice(0, 20).map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
    return { error: `Menu không hợp lệ: ${issues[0]?.message ?? "không rõ"}`, issues };
  }
  return { data: parsed.data as unknown as Prisma.InputJsonValue };
}

function revalidateEditor(): void {
  revalidatePath("/admin/cms/menu");
  revalidatePath("/admin/cms");
}

async function logChange(actorId: string, operation: "SAVE_DRAFT" | "PUBLISH" | "RESTORE_LIVE"): Promise<void> {
  await audit.log({ actorId, scope: "SYSTEM", action: "MENU_CMS_UPDATED", targetType: "CmsPage", targetId: MENU_CMS_SLUG, metadata: { operation } });
}

/** Lưu nháp — chỉ ghi `blocksDraft`. Chưa có dòng → tạo dòng DRAFT với live = menu mặc định. */
export async function saveMenuDraftAction(menu: unknown): Promise<MenuEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const parsed = parseMenu(menu);
    if (!("data" in parsed)) return parsed;
    await getPrismaClient().cmsPage.upsert({
      where: { slug: MENU_CMS_SLUG },
      update: { blocksDraft: parsed.data },
      create: {
        slug: MENU_CMS_SLUG,
        title: MENU_CMS_TITLE,
        blocks: defaultSiteMenu() as unknown as Prisma.InputJsonValue,
        blocksDraft: parsed.data,
        status: "DRAFT",
      },
    });
    await logChange(actor.userId, "SAVE_DRAFT");
    revalidateEditor();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Xuất bản — menu (đã validate) thành bản live, xoá nháp, `status = PUBLISHED`. Áp dụng cho mọi trang public. */
export async function publishMenuAction(menu: unknown): Promise<MenuEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const parsed = parseMenu(menu);
    if (!("data" in parsed)) return parsed;
    await getPrismaClient().cmsPage.upsert({
      where: { slug: MENU_CMS_SLUG },
      update: { blocks: parsed.data, blocksDraft: Prisma.DbNull, status: "PUBLISHED" },
      create: { slug: MENU_CMS_SLUG, title: MENU_CMS_TITLE, blocks: parsed.data, status: "PUBLISHED" },
    });
    await logChange(actor.userId, "PUBLISH");
    revalidateEditor();
    revalidatePath("/", "layout");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Khôi phục bản đang hiển thị — xoá `blocksDraft`. Chưa có dòng → không làm gì. */
export async function restoreLiveMenuAction(): Promise<MenuEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const result = await getPrismaClient().cmsPage.updateMany({ where: { slug: MENU_CMS_SLUG }, data: { blocksDraft: Prisma.DbNull } });
    if (result.count > 0) await logChange(actor.userId, "RESTORE_LIVE");
    revalidateEditor();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
