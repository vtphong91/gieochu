"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../lib/tenant";
import { hideReview, replyToReview, unhideReview } from "../../../../lib/review";

/**
 * ADR-029 (M10a) — Studio → Đánh giá. `tenant.id` luôn lấy từ `requireTenantMember` (không từ client); mọi ghi đi
 * qua `withTenant` + WHERE tenantId nên id đánh giá của tenant khác không bao giờ khớp. Tenant chỉ ẩn/khôi phục/trả
 * lời — không sửa/xoá nội dung của khách (trigger `reviews_guard_columns` chặn ở DB).
 */

export interface ReviewModerationState {
  success?: boolean;
  error?: string;
  /** VALIDATION_ERROR | REVIEW_NOT_FOUND | REVIEW_INVALID_HIDE_REASON | REVIEW_REFUNDED_LOCKED | FORBIDDEN | UNAUTHORIZED | NOT_FOUND */
  code?: string;
}

function toErrorState(error: unknown): ReviewModerationState {
  if (error instanceof AppError && error.expose) return { error: error.message, code: error.code };
  throw error;
}

function revalidate(tenantSlug: string): void {
  revalidatePath(`/studio/${tenantSlug}`, "layout");
  revalidatePath("/[tenantSlug]/[productSlug]", "page");
  revalidatePath("/[tenantSlug]", "page");
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 40;
}

/** Trả lời / sửa trả lời. `reply` rỗng (sau khi trim) = xoá trả lời. Tối đa 2000 ký tự, văn bản thuần. */
export async function replyReviewAction(tenantSlug: string, reviewId: string, reply: string): Promise<ReviewModerationState> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    if (!isId(reviewId) || typeof reply !== "string") return { error: "Thao tác không hợp lệ.", code: "VALIDATION_ERROR" };
    await replyToReview(tenant.id, reviewId, reply);
    revalidate(tenant.slug);
    return { success: true };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Ẩn với lý do bắt buộc: SPAM | OFFENSIVE | IRRELEVANT | PERSONAL_INFO | OTHER (REFUNDED chỉ hệ thống đặt). */
export async function hideReviewAction(tenantSlug: string, reviewId: string, reason: string): Promise<ReviewModerationState> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    if (!isId(reviewId)) return { error: "Thao tác không hợp lệ.", code: "VALIDATION_ERROR" };
    await hideReview(tenant.id, reviewId, reason);
    revalidate(tenant.slug);
    return { success: true };
  } catch (error) {
    return toErrorState(error);
  }
}

/** Khôi phục đánh giá đã ẩn (không áp dụng cho đánh giá tự ẩn vì hoàn tiền). */
export async function unhideReviewAction(tenantSlug: string, reviewId: string): Promise<ReviewModerationState> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    if (!isId(reviewId)) return { error: "Thao tác không hợp lệ.", code: "VALIDATION_ERROR" };
    await unhideReview(tenant.id, reviewId);
    revalidate(tenant.slug);
    return { success: true };
  } catch (error) {
    return toErrorState(error);
  }
}
