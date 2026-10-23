"use server";

import { revalidatePath } from "next/cache";
import {
  AppError,
  cmsSeoSchema,
  defaultHomeSections,
  HOME_CMS_SLUG,
  HOME_SECTION_LABELS,
  homePublishIssues,
  homeSectionsSchema,
  type HomePublishIssue,
  type HomeSectionType,
} from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { audit } from "../../../../lib/audit";
import { requireRole } from "../../../../lib/session";
import { listHomeProductOptions, listHomeTenantOptions, type HomeProductOption, type HomeTenantOption } from "../../../../lib/home";

/**
 * ADR-033 + ADR-050 — CMS trang chủ (`CmsPage` slug `home`, L1 không RLS). Lưu nháp / Xuất bản / Khôi phục theo slug
 * (`upsert` — dòng có thể chưa tồn tại, không seed, ADR-034). Mỗi action tự `requireRole("SYSTEM_ADMIN")`; section
 * luôn validate lại bằng `homeSectionsSchema` chặt ở server. Xuất bản còn bị chặn bởi `homePublishIssues` (lời chứng
 * thực chưa xác nhận đồng ý, link không an toàn). SEO (`seoTitle/seoDescription`) không có nháp — lưu cùng mọi thao tác,
 * chỉ hiệu lực khi dòng PUBLISHED. Ghi audit `HOME_CMS_UPDATED` (metadata chỉ loại thao tác).
 */

export interface HomeEditorActionState {
  error?: string;
  success?: boolean;
  /** Lỗi chi tiết theo section/field (field là đường dẫn chấm trong `data`). */
  issues?: HomePublishIssue[];
}

/** Tiêu đề dòng CMS (cột bắt buộc) — chỉ hiện trong danh sách `/admin/cms`. */
const HOME_CMS_TITLE = "Trang chủ";

function toActionError(error: unknown): HomeEditorActionState {
  if (error instanceof AppError && error.expose) return { error: error.message };
  throw error;
}

function sectionLabel(type: unknown): string | null {
  return typeof type === "string" && type in HOME_SECTION_LABELS ? HOME_SECTION_LABELS[type as HomeSectionType] : null;
}

async function parseSections(sections: unknown, mode: "draft" | "publish"): Promise<{ data: Prisma.InputJsonValue } | HomeEditorActionState> {
  const parsed = homeSectionsSchema.safeParse(sections);
  if (!parsed.success) {
    const issues: HomePublishIssue[] = parsed.error.issues.slice(0, 20).map((issue) => {
      const index = typeof issue.path[0] === "number" ? issue.path[0] : -1;
      const raw = Array.isArray(sections) ? (sections[index] as { id?: unknown } | undefined) : undefined;
      const rest = issue.path.slice(1);
      const field = (rest[0] === "data" ? rest.slice(1) : rest).map(String).join(".");
      return { sectionId: typeof raw?.id === "string" ? raw.id : "", field, message: issue.message };
    });
    const first = parsed.error.issues[0];
    const index = first && typeof first.path[0] === "number" ? first.path[0] : -1;
    const label = sectionLabel(Array.isArray(sections) ? (sections[index] as { type?: unknown } | undefined)?.type : undefined);
    return { error: `Dữ liệu section không hợp lệ${label ? ` (${label})` : ""}: ${first?.message ?? "không rõ"}`, issues };
  }

  if (mode === "publish") {
    const issues = homePublishIssues(parsed.data);
    if (issues.length > 0) {
      const label = sectionLabel(parsed.data.find((section) => section.id === issues[0]!.sectionId)?.type);
      return { error: `Chưa thể xuất bản${label ? ` (${label})` : ""}: ${issues[0]!.message}`, issues: issues.slice(0, 20) };
    }
  }
  // JSON round-trip bỏ key `undefined` (field tuỳ chọn để trống) trước khi lưu Json.
  return { data: JSON.parse(JSON.stringify(parsed.data)) as Prisma.InputJsonValue };
}

function parseSeo(seo: unknown): { data: { seoTitle: string | null; seoDescription: string | null } } | HomeEditorActionState {
  const parsed = cmsSeoSchema.safeParse(seo);
  if (!parsed.success) return { error: `SEO không hợp lệ: ${parsed.error.issues[0]?.message ?? "không rõ"}` };
  return { data: { seoTitle: parsed.data.seoTitle || null, seoDescription: parsed.data.seoDescription || null } };
}

function revalidateEditor(): void {
  revalidatePath("/admin/cms/home");
  revalidatePath("/admin/cms");
}

async function logChange(actorId: string, operation: "SAVE_DRAFT" | "PUBLISH" | "RESTORE_LIVE"): Promise<void> {
  await audit.log({ actorId, scope: "SYSTEM", action: "HOME_CMS_UPDATED", targetType: "CmsPage", targetId: HOME_CMS_SLUG, metadata: { operation } });
}

/** Lưu nháp — chỉ ghi `blocksDraft` (+ SEO). Chưa có dòng → tạo dòng DRAFT với live = nội dung mặc định. */
export async function saveHomeDraftAction(sections: unknown, seo: unknown): Promise<HomeEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const seoParsed = parseSeo(seo);
    if (!("data" in seoParsed)) return seoParsed;
    const parsed = await parseSections(sections, "draft");
    if (!("data" in parsed)) return parsed;

    await getPrismaClient().cmsPage.upsert({
      where: { slug: HOME_CMS_SLUG },
      update: { blocksDraft: parsed.data, ...seoParsed.data },
      create: {
        slug: HOME_CMS_SLUG,
        title: HOME_CMS_TITLE,
        blocks: JSON.parse(JSON.stringify(defaultHomeSections())) as Prisma.InputJsonValue,
        blocksDraft: parsed.data,
        status: "DRAFT",
        ...seoParsed.data,
      },
    });
    await logChange(actor.userId, "SAVE_DRAFT");
    revalidateEditor();
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Xuất bản — sections (đã validate + qua luật chặn) thành bản live, xoá nháp, `status = PUBLISHED`. */
export async function publishHomeAction(sections: unknown, seo: unknown): Promise<HomeEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const seoParsed = parseSeo(seo);
    if (!("data" in seoParsed)) return seoParsed;
    const parsed = await parseSections(sections, "publish");
    if (!("data" in parsed)) return parsed;

    await getPrismaClient().cmsPage.upsert({
      where: { slug: HOME_CMS_SLUG },
      update: { blocks: parsed.data, blocksDraft: Prisma.DbNull, status: "PUBLISHED", ...seoParsed.data },
      create: { slug: HOME_CMS_SLUG, title: HOME_CMS_TITLE, blocks: parsed.data, status: "PUBLISHED", ...seoParsed.data },
    });
    await logChange(actor.userId, "PUBLISH");
    revalidateEditor();
    revalidatePath("/");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Khôi phục live — xoá blocksDraft (huỷ mọi thay đổi chưa xuất bản). Chưa có dòng → không làm gì. */
export async function restoreLiveHomeAction(): Promise<HomeEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const result = await getPrismaClient().cmsPage.updateMany({ where: { slug: HOME_CMS_SLUG }, data: { blocksDraft: Prisma.DbNull } });
    if (result.count > 0) await logChange(actor.userId, "RESTORE_LIVE");
    revalidateEditor();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
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
