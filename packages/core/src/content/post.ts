/**
 * ADR-029 mục 5 (M10b) — logic thuần của bài viết tenant: giới hạn, chuẩn hoá tiêu đề, sinh trích đoạn văn bản
 * thuần và đếm ảnh trong HTML ĐÃ sanitize (`sanitizeRichTextHtml`). Không phụ thuộc Node/DB — client component
 * import được qua `@gieochu/core/post`.
 */

export const POST_TITLE_MAX_LENGTH = 200;
/** Trích đoạn văn bản thuần tự sinh từ nội dung (khớp CHECK `posts_excerpt_length`). */
export const POST_EXCERPT_MAX_LENGTH = 300;
/** Tối đa ảnh trong một bài (ADR-029 mục 5) — đếm `<img>` còn lại sau sanitize (chỉ ảnh Cloudinary hệ thống). */
export const POST_MAX_IMAGES = 6;
/** Trần độ dài HTML nội dung (ký tự, khớp CHECK `posts_body_length`). */
export const POST_BODY_MAX_LENGTH = 100_000;

export const POST_STATUS_LABELS = {
  DRAFT: "Bản nháp",
  PUBLISHED: "Đã đăng",
  HIDDEN: "Bị ẩn do vi phạm",
} as const;

const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
const INVISIBLE_FORMAT_CHARS = /[​-‏‪-‮⁠-⁤⁦-⁩﻿]/g;

function cleanSingleLine(value: string): string {
  return value.normalize("NFC").replace(CONTROL_CHARS, " ").replace(INVISIBLE_FORMAT_CHARS, "").replace(/\s+/g, " ").trim();
}

export type PostTitleResult = { ok: true; value: string | null } | { ok: false; message: string };

/** Tiêu đề tuỳ chọn: văn bản 1 dòng, rỗng → null, tối đa 200 ký tự (code point). */
export function normalizePostTitle(input: string | null | undefined): PostTitleResult {
  const value = cleanSingleLine(input ?? "");
  if (value === "") return { ok: true, value: null };
  if (Array.from(value).length > POST_TITLE_MAX_LENGTH) {
    return { ok: false, message: `Tiêu đề tối đa ${POST_TITLE_MAX_LENGTH} ký tự.` };
  }
  return { ok: true, value };
}

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-fA-F]+|#[0-9]+|[a-zA-Z]+);/g, (match, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : " ";
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * Văn bản thuần từ HTML ĐÃ sanitize (whitelist Tiptap): thẻ khối/`br` → khoảng trắng, bỏ mọi thẻ, giải mã entity,
 * gộp khoảng trắng. Kết quả chỉ dùng hiển thị dạng TEXT (React tự escape) — không đưa lại vào HTML.
 */
export function htmlToPlainText(html: string): string {
  const withBreaks = html.replace(/<(br|hr)\b[^>]*>/gi, " ").replace(/<\/(p|h[1-6]|li|blockquote|pre|ul|ol)>/gi, " ");
  const stripped = withBreaks.replace(/<[^>]*>/g, "");
  return cleanSingleLine(decodeEntities(stripped));
}

/** Trích đoạn ≤300 ký tự (cắt ở ranh giới từ nếu được, thêm "…"). Bài chỉ có ảnh → "". */
export function buildPostExcerpt(html: string): string {
  const text = htmlToPlainText(html);
  const chars = Array.from(text);
  if (chars.length <= POST_EXCERPT_MAX_LENGTH) return text;
  const cut = chars.slice(0, POST_EXCERPT_MAX_LENGTH - 1).join("");
  const lastSpace = cut.lastIndexOf(" ");
  const base = lastSpace >= POST_EXCERPT_MAX_LENGTH / 2 ? cut.slice(0, lastSpace) : cut;
  return `${base.trimEnd()}…`;
}

const IMG_TAG = /<img\b[^>]*>/gi;
const IMG_SRC = /\ssrc="([^"]*)"/i;

/** Số thẻ `<img>` trong HTML đã sanitize (ảnh không hợp lệ đã bị sanitizer loại trước đó). */
export function countRichTextImages(html: string): number {
  return html.match(IMG_TAG)?.length ?? 0;
}

/** Mọi `src` ảnh trong HTML (theo thứ tự xuất hiện), đã giải mã entity. */
export function richTextImageSrcs(html: string): string[] {
  const srcs: string[] = [];
  for (const tag of html.match(IMG_TAG) ?? []) {
    const src = IMG_SRC.exec(tag)?.[1];
    if (src) srcs.push(decodeEntities(src));
  }
  return srcs;
}

/**
 * `src` ảnh đầu tiên thoả `accept` (mặc định: ảnh đầu tiên) — ảnh minh hoạ thẻ bài viết; null nếu không có.
 * Caller truyền `accept` kiểm cloud hệ thống để bỏ qua ảnh không hợp lệ thay vì dừng ở ảnh đầu.
 */
export function firstRichTextImageSrc(html: string, accept: (src: string) => boolean = () => true): string | null {
  return richTextImageSrcs(html).find(accept) ?? null;
}
