"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../lib/session";
import { notifyAbuseReportResolution, resolveAbuseReport, unlockModeration } from "../../../lib/abuse-report";

/**
 * ADR-038 mục 5 — Server Actions của System Admin cho /admin/reports. Mọi action tự `requireRole("SYSTEM_ADMIN")`
 * (không tin trang/proxy). Trả state cho `useActionState`: `{ ok }` hoặc `{ error, code }`.
 */
export interface ReportActionState {
  ok?: boolean;
  error?: string;
  code?: string;
  /** Số báo cáo đã đóng (gồm báo cáo cùng đối tượng nếu chọn áp cùng quyết định). */
  resolvedCount?: number;
}

function toState(error: unknown): ReportActionState {
  if (error instanceof AppError) return { error: error.message, code: error.code };
  throw error;
}

function revalidatePublic(tenantSlug: string): void {
  revalidatePath("/admin/reports");
  revalidatePath("/admin/reports/[reportId]", "page");
  // Trang công khai của tenant (danh sách, chi tiết tài liệu, bài viết) — đối tượng vừa bị ẩn/lưu trữ/mở lại.
  revalidatePath(`/${tenantSlug}`);
  revalidatePath("/[tenantSlug]/[productSlug]", "page");
  revalidatePath("/[tenantSlug]/posts", "page");
  revalidatePath("/[tenantSlug]/posts/[postId]", "page");
}

/**
 * Xử lý báo cáo. FormData: `decision` (HIDE_CONTENT | ARCHIVE_PRODUCT | LOCK_TENANT | REJECT), `note` (ghi chú nội bộ,
 * ≤2000, tuỳ chọn), `applyToSameTarget` ("on"/"true" = đóng luôn mọi báo cáo OPEN khác cùng đối tượng bằng cùng quyết
 * định; vắng = chỉ báo cáo này). Email cho người báo cáo + chủ gian hàng gửi sau response (`after`), lỗi gửi chỉ log.
 */
export async function resolveReportAction(reportId: string, _prev: ReportActionState, formData: FormData): Promise<ReportActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  const apply = formData.get("applyToSameTarget");
  try {
    const result = await resolveAbuseReport(actor, reportId, {
      decision: formData.get("decision"),
      note: formData.get("note") ?? "",
      applyToSameTarget: apply === "on" || apply === "true",
    });
    after(() => notifyAbuseReportResolution(result.notification));
    revalidatePublic(result.tenantSlug);
    if (result.decision === "LOCK_TENANT") revalidatePath("/admin/tenants");
    return { ok: true, resolvedCount: result.resolvedReportIds.length };
  } catch (error) {
    return toState(error);
  }
}

/** Gỡ khoá kiểm duyệt của 1 đối tượng (`targetType`: PRODUCT | REVIEW | POST). */
export async function unlockModerationAction(targetType: string, targetId: string): Promise<ReportActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  try {
    const result = await unlockModeration(actor, targetType, targetId);
    revalidatePublic(result.tenantSlug);
    return { ok: true };
  } catch (error) {
    return toState(error);
  }
}
