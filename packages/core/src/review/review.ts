/**
 * ADR-029 (M10a) — logic thuần của đánh giá sản phẩm: chuẩn hoá tên hiển thị, nội dung, số sao, lý do ẩn và
 * tóm tắt điểm. Không phụ thuộc Node/DB — client component import được qua `@gieochu/core/review`.
 */

export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;
/** Nội dung đánh giá và trả lời của người bán: văn bản thuần, tối đa 2000 ký tự (tính theo code point, khớp CHECK DB). */
export const REVIEW_BODY_MAX_LENGTH = 2000;
export const REVIEW_REPLY_MAX_LENGTH = 2000;
/** Tên hiển thị khi hồ sơ không có tên dùng được. */
export const REVIEW_ANONYMOUS_NAME = "Khách hàng";

export const REVIEW_HIDDEN_REASONS = ["SPAM", "OFFENSIVE", "IRRELEVANT", "PERSONAL_INFO", "REFUNDED", "OTHER"] as const;
export type ReviewHiddenReasonValue = (typeof REVIEW_HIDDEN_REASONS)[number];

/** Lý do tenant được chọn khi ẩn — `REFUNDED` chỉ hệ thống đặt (hoàn tiền / thu hồi quyền tải). */
export const TENANT_REVIEW_HIDE_REASONS = ["SPAM", "OFFENSIVE", "IRRELEVANT", "PERSONAL_INFO", "OTHER"] as const;
export type TenantReviewHideReason = (typeof TENANT_REVIEW_HIDE_REASONS)[number];

export const REVIEW_HIDDEN_REASON_LABELS: Record<ReviewHiddenReasonValue, string> = {
  SPAM: "Spam / quảng cáo",
  OFFENSIVE: "Ngôn từ xúc phạm",
  IRRELEVANT: "Không liên quan đến tài liệu",
  PERSONAL_INFO: "Chứa thông tin cá nhân",
  REFUNDED: "Đơn hàng đã hoàn tiền / thu hồi quyền tải",
  OTHER: "Lý do khác",
};

export function isTenantReviewHideReason(value: unknown): value is TenantReviewHideReason {
  return typeof value === "string" && (TENANT_REVIEW_HIDE_REASONS as readonly string[]).includes(value);
}

const CONTROL_CHARS_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;
const INVISIBLE_FORMAT_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

function cleanSingleLine(value: string): string {
  return value
    .normalize("NFC")
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, " ")
    .replace(INVISIBLE_FORMAT_CHARS, "")
    .replace(/\s+/g, " ")
    .trim();
}

function capitalizeFirst(word: string): string {
  const chars = Array.from(word);
  if (chars.length === 0) return word;
  return chars[0]!.toLocaleUpperCase("vi") + chars.slice(1).join("");
}

const GIVEN_NAME_MAX = 40;

/**
 * ADR-029 mục 2: tên hiển thị dạng "Minh N." — tiếng Việt: **tên là từ cuối**, kèm chữ cái đầu của **họ (từ
 * đầu)** và dấu chấm. "Nguyễn Văn Minh" → "Minh N."; tên 1 từ → giữ nguyên từ đó ("Minh"); rỗng → "Khách hàng".
 * Không bao giờ dùng email. Kết quả được lưu snapshot lúc ghi đánh giá.
 */
export function formatReviewerDisplayName(fullName: string | null | undefined): string {
  const cleaned = cleanSingleLine(fullName ?? "");
  const words = cleaned.split(" ").filter((w) => w.length > 0);
  if (words.length === 0) return REVIEW_ANONYMOUS_NAME;

  const given = capitalizeFirst(Array.from(words[words.length - 1]!).slice(0, GIVEN_NAME_MAX).join(""));
  if (words.length === 1) return given;

  const familyInitial = Array.from(words[0]!)[0]!.toLocaleUpperCase("vi");
  return `${given} ${familyInitial}.`;
}

export type ReviewTextResult = { ok: true; value: string | null } | { ok: false; message: string };

/**
 * Nội dung văn bản thuần (giữ xuống dòng): NFC → bỏ ký tự điều khiển/ẩn → CRLF thành LF → gộp > 2 dòng trống →
 * trim. Rỗng = `null`. Quá `max` code point → từ chối (không tự cắt).
 */
export function normalizeReviewText(input: string, max: number, label: string): ReviewTextResult {
  const value = input
    .normalize("NFC")
    .replace(/\r\n?/g, "\n")
    .replace(CONTROL_CHARS_EXCEPT_NEWLINE, " ")
    .replace(INVISIBLE_FORMAT_CHARS, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (value === "") return { ok: true, value: null };
  if (Array.from(value).length > max) return { ok: false, message: `${label} tối đa ${max} ký tự.` };
  return { ok: true, value };
}

/** Số sao từ form (chuỗi) → số nguyên 1–5, sai → null. */
export function parseReviewRating(input: unknown): number | null {
  const value = typeof input === "number" ? input : typeof input === "string" && /^\s*\d+\s*$/.test(input) ? Number(input) : NaN;
  if (!Number.isInteger(value) || value < REVIEW_RATING_MIN || value > REVIEW_RATING_MAX) return null;
  return value;
}

/**
 * Điểm trung bình làm tròn 1 chữ số thập phân từ cache số nguyên (ADR-029 mục 3). `count = 0` → null.
 * Tính bằng số nguyên (×10) để tránh sai số float khi làm tròn.
 */
export function computeRatingAverage(ratingSum: number, ratingCount: number): number | null {
  if (!Number.isFinite(ratingSum) || !Number.isFinite(ratingCount) || ratingCount <= 0) return null;
  return Math.round((ratingSum * 10) / ratingCount) / 10;
}
