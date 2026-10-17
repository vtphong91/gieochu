"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { AppError, logger } from "@gieochu/core";
import { requireVerified } from "../../../lib/session";
import { deleteMyReview, notifyTenantOwnerOfReview, upsertMyReview, type MyReview } from "../../../lib/review";

/**
 * ADR-029 (M10a) — đánh giá của khách. Quyền đánh giá, tenantId, orderItemId, displayName đều suy ở server
 * (§7.5); RLS `reviews` là cổng thật. CSRF: cơ chế Server Action sẵn có (§7.7).
 */

export interface ReviewFormState {
  success?: boolean;
  /** Thông điệp an toàn để hiện cho khách. */
  error?: string;
  /** Mã lỗi ổn định: VALIDATION_ERROR | REVIEW_NOT_ELIGIBLE | REVIEW_ALREADY_EXISTS | RATE_LIMITED | UNAUTHORIZED | FORBIDDEN | TENANT_NOT_ACTIVE. */
  code?: string;
  /** Đánh giá sau khi lưu (có `displayName` đã chuẩn hoá). */
  review?: MyReview;
  /** true = vừa tạo mới, false = vừa sửa. */
  created?: boolean;
}

function field(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

function toErrorState(error: unknown): ReviewFormState {
  if (error instanceof AppError && error.expose) return { error: error.message, code: error.code };
  throw error;
}

function revalidateReviewPages(): void {
  revalidatePath("/[tenantSlug]/[productSlug]", "page");
  revalidatePath("/[tenantSlug]", "page");
  revalidatePath("/account/library");
}

/**
 * Tạo hoặc sửa đánh giá. Dùng với `useActionState(upsertMyReviewAction.bind(null, productId), null)`.
 * FormData: `rating` ("1".."5"), `body` (tuỳ chọn, ≤2000 ký tự, văn bản thuần).
 */
export async function upsertMyReviewAction(productId: string, _prevState: ReviewFormState | null, formData: FormData): Promise<ReviewFormState> {
  try {
    const user = await requireVerified();
    if (typeof productId !== "string" || !productId) return { error: "Thao tác không hợp lệ.", code: "VALIDATION_ERROR" };
    const result = await upsertMyReview(user.userId, productId, { rating: field(formData, "rating"), body: field(formData, "body") });
    if (result.created) {
      after(() => notifyTenantOwnerOfReview({ tenantId: result.tenantId, productId, reviewId: result.review.id }));
    }
    revalidateReviewPages();
    return { success: true, review: result.review, created: result.created };
  } catch (error) {
    if (!(error instanceof AppError)) logger.error({ err: error, productId }, "review: lưu đánh giá thất bại");
    return toErrorState(error);
  }
}

/** Khách tự xoá đánh giá của mình (xoá thật, điểm tính lại). */
export async function deleteMyReviewAction(reviewId: string): Promise<ReviewFormState> {
  try {
    const user = await requireVerified();
    if (typeof reviewId !== "string" || !reviewId) return { error: "Thao tác không hợp lệ.", code: "VALIDATION_ERROR" };
    await deleteMyReview(user.userId, reviewId);
    revalidateReviewPages();
    return { success: true };
  } catch (error) {
    return toErrorState(error);
  }
}
