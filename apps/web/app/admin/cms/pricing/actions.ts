"use server";

import { revalidatePath } from "next/cache";
import {
  AppError,
  defaultPricingSections,
  PRICING_CMS_SLUG,
  PRICING_SECTION_LABELS,
  pricingSectionsSchema,
  pricingSeoSchema,
  stripUndefinedPricing,
  validatePricingPlanRefs,
  type PricingSectionIssue,
  type PricingSectionType,
} from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { audit } from "../../../../lib/audit";
import { requireRole } from "../../../../lib/session";

/**
 * ADR-041 A (C3) — CMS Bảng giá (`CmsPage` slug `pricing`, L1 không RLS). Cùng quy trình Lưu nháp / Xuất bản / Khôi
 * phục như CMS Cửa hàng (`../shop/actions.ts`): dòng có thể chưa tồn tại → `upsert` theo slug (lần lưu đầu do admin
 * tạo — không seed, ADR-034). Mỗi action tự `requireRole("SYSTEM_ADMIN")`; section luôn validate lại bằng schema chặt
 * + kiểm tham chiếu gói thật ở server. Ghi audit `PRICING_CMS_UPDATED` (metadata chỉ loại thao tác).
 */

export interface PricingEditorActionState {
  success?: boolean;
  /** Tóm tắt lỗi (hiển thị ở khung lỗi đầu trang). */
  error?: string;
  /** Lỗi chi tiết theo section/field (field là đường dẫn chấm trong `data`, VD `items.0.altPlanId`). */
  issues?: PricingSectionIssue[];
}

/** Tiêu đề dòng CMS (cột bắt buộc) — chỉ hiện trong danh sách `/admin/cms`, không phải chuỗi thương hiệu. */
const PRICING_CMS_TITLE = "Bảng giá";
const MAX_ISSUES = 20;

function toActionError(error: unknown): PricingEditorActionState {
  if (error instanceof AppError && error.expose) return { error: error.message };
  throw error;
}

function sectionLabel(type: unknown): string | null {
  return typeof type === "string" && type in PRICING_SECTION_LABELS ? PRICING_SECTION_LABELS[type as PricingSectionType] : null;
}

async function parseSections(sections: unknown): Promise<{ data: Prisma.InputJsonValue } | PricingEditorActionState> {
  const parsed = pricingSectionsSchema.safeParse(sections);
  if (!parsed.success) {
    const issues: PricingSectionIssue[] = parsed.error.issues.slice(0, MAX_ISSUES).map((issue) => {
      const index = typeof issue.path[0] === "number" ? issue.path[0] : -1;
      const raw = Array.isArray(sections) ? (sections[index] as { id?: unknown } | undefined) : undefined;
      // path: [index, "data", ...field] → field = phần sau "data".
      const rest = issue.path.slice(1);
      const field = (rest[0] === "data" ? rest.slice(1) : rest).map(String).join(".");
      return { sectionId: typeof raw?.id === "string" ? raw.id : "", field, message: issue.message };
    });
    const first = parsed.error.issues[0];
    const index = first && typeof first.path[0] === "number" ? first.path[0] : -1;
    const label = sectionLabel(Array.isArray(sections) ? (sections[index] as { type?: unknown } | undefined)?.type : undefined);
    return { error: `Dữ liệu section không hợp lệ${label ? ` (${label})` : ""}: ${first?.message ?? "không rõ"}`, issues };
  }

  const plans = await getPrismaClient().plan.findMany({ select: { id: true, isFree: true } });
  const refIssues = validatePricingPlanRefs(parsed.data, plans);
  if (refIssues.length > 0) {
    const first = refIssues[0]!;
    const label = sectionLabel(parsed.data.find((section) => section.id === first.sectionId)?.type);
    return { error: `Dữ liệu section không hợp lệ${label ? ` (${label})` : ""}: ${first.message}`, issues: refIssues.slice(0, MAX_ISSUES) };
  }
  // JSON round-trip bỏ key `undefined` (trường tuỳ chọn để trống) trước khi lưu Json.
  return { data: stripUndefinedPricing(parsed.data) as unknown as Prisma.InputJsonValue };
}

/**
 * SEO (cột `seoTitle/seoDescription`, không có bản nháp): trim, giới hạn độ dài, chuỗi rỗng → `null` (route dùng mặc định).
 * Lưu cùng cả Lưu nháp lẫn Xuất bản — loader công khai chỉ đọc khi dòng đã PUBLISHED.
 */
function parseSeo(seo: unknown): { data: { seoTitle: string | null; seoDescription: string | null } } | PricingEditorActionState {
  const parsed = pricingSeoSchema.safeParse(seo);
  if (!parsed.success) return { error: `SEO không hợp lệ: ${parsed.error.issues[0]?.message ?? "không rõ"}` };
  return { data: { seoTitle: parsed.data.seoTitle || null, seoDescription: parsed.data.seoDescription || null } };
}

function revalidateEditor(): void {
  revalidatePath("/admin/cms/pricing");
  revalidatePath("/admin/cms");
}

async function logChange(actorId: string, operation: "SAVE_DRAFT" | "PUBLISH" | "RESTORE_LIVE"): Promise<void> {
  await audit.log({ actorId, scope: "SYSTEM", action: "PRICING_CMS_UPDATED", targetType: "CmsPage", targetId: PRICING_CMS_SLUG, metadata: { operation } });
}

/** Lưu nháp — chỉ ghi `blocksDraft`; bản live không đổi. Chưa có dòng → tạo dòng DRAFT với live = mặc định. */
export async function savePricingDraftAction(sections: unknown, seo: unknown): Promise<PricingEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const seoParsed = parseSeo(seo);
    if (!("data" in seoParsed)) return seoParsed;
    const parsed = await parseSections(sections);
    if (!("data" in parsed)) return parsed;

    await getPrismaClient().cmsPage.upsert({
      where: { slug: PRICING_CMS_SLUG },
      update: { blocksDraft: parsed.data, ...seoParsed.data },
      create: {
        slug: PRICING_CMS_SLUG,
        title: PRICING_CMS_TITLE,
        blocks: stripUndefinedPricing(defaultPricingSections()) as unknown as Prisma.InputJsonValue,
        blocksDraft: parsed.data,
        status: "DRAFT",
        ...seoParsed.data,
      },
    });
    await logChange(actor.userId, "SAVE_DRAFT");
    revalidateEditor();
    // SEO không có bản nháp — dòng đã xuất bản thì metadata `/pricing` đổi ngay.
    revalidatePath("/pricing");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Xuất bản — `sections` (đã validate) thành bản live, xoá nháp, `status = PUBLISHED`. */
export async function publishPricingAction(sections: unknown, seo: unknown): Promise<PricingEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const seoParsed = parseSeo(seo);
    if (!("data" in seoParsed)) return seoParsed;
    const parsed = await parseSections(sections);
    if (!("data" in parsed)) return parsed;

    await getPrismaClient().cmsPage.upsert({
      where: { slug: PRICING_CMS_SLUG },
      update: { blocks: parsed.data, blocksDraft: Prisma.DbNull, status: "PUBLISHED", ...seoParsed.data },
      create: { slug: PRICING_CMS_SLUG, title: PRICING_CMS_TITLE, blocks: parsed.data, status: "PUBLISHED", ...seoParsed.data },
    });
    await logChange(actor.userId, "PUBLISH");
    revalidateEditor();
    revalidatePath("/pricing");
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

/** Khôi phục bản đang hiển thị — xoá `blocksDraft`. Chưa có dòng → không làm gì. */
export async function restoreLivePricingAction(): Promise<PricingEditorActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const result = await getPrismaClient().cmsPage.updateMany({ where: { slug: PRICING_CMS_SLUG }, data: { blocksDraft: Prisma.DbNull } });
    if (result.count > 0) await logChange(actor.userId, "RESTORE_LIVE");
    revalidateEditor();
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}
