import { ABUSE_REPORT_ERROR_CODES, AppError, CONTENT_MODERATION_LOCKED_MESSAGE } from "@gieochu/core";

/**
 * ADR-038 mục 5 — lỗi khi tenant thao tác vào nội dung đang bị khoá kiểm duyệt (xuất bản lại / khôi phục / bỏ ẩn /
 * đổi trạng thái). Lớp chặn ở app để trả thông điệp rõ ràng; cổng thật là trigger `<bảng>_guard_moderation`.
 * Tách riêng (không đặt trong abuse-report.ts) để review/post/product import mà không tạo vòng import.
 */
export function contentModerationLocked(): AppError {
  return new AppError({ code: ABUSE_REPORT_ERROR_CODES.CONTENT_LOCKED, message: CONTENT_MODERATION_LOCKED_MESSAGE, httpStatus: 409 });
}

export function assertNotModerationLocked(row: { moderationLockedAt: Date | null }): void {
  if (row.moderationLockedAt) throw contentModerationLocked();
}
