/**
 * ADR-029 mục 5 (M10b) — hằng + helper hiển thị dùng chung cho Studio → Bài viết (danh sách + editor). Không hook,
 * không "use client" → import được từ cả Server lẫn Client Component. Nhãn trạng thái lấy từ `@gieochu/core/post`
 * (subpath client-safe, không kéo barrel server-only).
 */
import { POST_STATUS_LABELS } from "@gieochu/core/post";

export type StudioPostStatus = keyof typeof POST_STATUS_LABELS;
export type StudioProductStatus = "DRAFT" | "PUBLISHED" | "ARCHIVED";

/** Tông Badge theo trạng thái — luôn đi kèm chữ (không truyền đạt chỉ bằng màu). */
export const POST_STATUS_TONE: Record<StudioPostStatus, "success" | "warning" | "danger"> = {
  DRAFT: "warning",
  PUBLISHED: "success",
  HIDDEN: "danger",
};

/** Hậu tố trạng thái tài liệu trong ô chọn "Tài liệu liên quan" và dòng tài liệu ở danh sách. */
export const PRODUCT_STATUS_SUFFIX: Record<StudioProductStatus, string> = {
  PUBLISHED: "",
  DRAFT: " (Riêng tư)",
  ARCHIVED: " (Đã lưu trữ)",
};

const DATE_TIME = new Intl.DateTimeFormat("vi-VN", {
  timeZone: "Asia/Ho_Chi_Minh",
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

/** Ngày giờ theo giờ Việt Nam, ví dụ "14:05 28/09/2026". */
export function formatPostDateTime(value: Date | string): string {
  return DATE_TIME.format(new Date(value));
}

/** Đếm `<img>` trong HTML của editor (khớp cách server đếm sau sanitize — `countRichTextImages`). */
export function countBodyImages(html: string): number {
  return html.match(/<img\b/gi)?.length ?? 0;
}
