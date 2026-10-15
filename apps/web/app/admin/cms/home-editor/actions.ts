"use server";

import { revalidatePath } from "next/cache";
import { homeSectionsSchema } from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { requireRole } from "../../../../lib/session";
import { listHomeProductOptions, listHomeTenantOptions, type HomeProductOption, type HomeTenantOption } from "../../../../lib/home";

export interface HomeEditorActionState {
  error?: string;
  success?: boolean;
}

/** Lưu nháp — chỉ ghi `blocksDraft`, không đụng bản live đang hiển thị công khai. */
export async function saveHomeDraftAction(pageId: string, sections: unknown): Promise<HomeEditorActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = homeSectionsSchema.safeParse(sections);
  if (!parsed.success) return { error: "Dữ liệu section không hợp lệ." };

  const prisma = getPrismaClient();
  await prisma.cmsPage.update({ where: { id: pageId }, data: { blocksDraft: parsed.data } });
  revalidatePath("/admin/cms/home");
  return { success: true };
}

/** Publish — copy blocksDraft (hoặc sections truyền vào nếu chưa lưu nháp) -> blocks (bản live), rồi xoá blocksDraft. */
export async function publishHomeAction(pageId: string, sections: unknown): Promise<HomeEditorActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = homeSectionsSchema.safeParse(sections);
  if (!parsed.success) return { error: "Dữ liệu section không hợp lệ." };

  const prisma = getPrismaClient();
  await prisma.cmsPage.update({ where: { id: pageId }, data: { blocks: parsed.data, blocksDraft: Prisma.DbNull, status: "PUBLISHED" } });
  revalidatePath("/admin/cms/home");
  revalidatePath("/");
  return { success: true };
}

/** Khôi phục live — xoá blocksDraft, quay lại đúng bản đang publish (huỷ mọi thay đổi chưa publish). */
export async function restoreLiveHomeAction(pageId: string): Promise<HomeEditorActionState> {
  await requireRole("SYSTEM_ADMIN");
  const prisma = getPrismaClient();
  await prisma.cmsPage.update({ where: { id: pageId }, data: { blocksDraft: Prisma.DbNull } });
  revalidatePath("/admin/cms/home");
  return { success: true };
}

/**
 * ADR-033 — tìm lựa chọn cho ô ghim "Giáo viên & Coach nổi bật" / "Tài liệu nổi bật" (tối đa 200, lọc theo tên).
 * `includeIds` = id đang ghim để luôn trả kèm. Chỉ dữ liệu công khai (tên, slug, số tài liệu Công khai) — §7.9.
 */
export async function searchHomeTenantOptionsAction(search: unknown, includeIds: unknown): Promise<HomeTenantOption[]> {
  await requireRole("SYSTEM_ADMIN");
  return listHomeTenantOptions({ search: typeof search === "string" ? search : undefined, includeIds: toIdList(includeIds) });
}

export async function searchHomeProductOptionsAction(search: unknown, includeIds: unknown): Promise<HomeProductOption[]> {
  await requireRole("SYSTEM_ADMIN");
  return listHomeProductOptions({ search: typeof search === "string" ? search : undefined, includeIds: toIdList(includeIds) });
}

function toIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((id): id is string => typeof id === "string" && id.length > 0 && id.length <= 64).slice(0, 12);
}
