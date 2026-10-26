import { Marked } from "marked";
import { escapeHtmlText, replaceBrandTokenInHtml } from "@gieochu/core";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import { getEnv } from "@gieochu/config";

/**
 * ADR-060 — khối `richText` của trang tuỳ chỉnh `/p/[slug]` (System Admin soạn trong CMS) hiển thị như Markdown, render ở
 * SERVER (Server Component — `marked` không vào bundle client).
 *
 * Lớp an toàn, theo thứ tự (giống văn bản pháp lý, `scripts/import-legal-drafts.ts` + `lib/legal.ts`):
 *  1. HTML thô viết trong Markdown KHÔNG được thông qua: token `html` của `marked` bị escape thành chữ (`<script>` hiện ra
 *     dưới dạng văn bản, không thành thẻ).
 *  2. Kết quả `marked` đi qua `sanitizeRichTextHtml` (whitelist Tiptap + bảng, chế độ `trustedLinks` ADR-054): không
 *     `script`/`on*`/`style`, chỉ scheme `http/https/mailto` (`javascript:` bị bỏ), không ảnh (`imageCloudName = null`); link
 *     ngoài `target="_blank" rel="noopener noreferrer"`, link nội bộ giữ cùng tab.
 *  3. Thay `{brand}` SAU khi sanitize, giá trị được escape (`replaceBrandTokenInHtml`).
 *
 * Tương thích nội dung cũ là chữ thuần (trước đây in với `white-space: pre-line`): nếu nội dung KHÔNG có tiêu đề Markdown
 * (`# …`) và không có bảng (`| … |`) thì mỗi lần xuống dòng giữ thành `<br>` (`breaks: true`), đoạn cách bằng dòng trống vẫn là
 * đoạn riêng. Có tiêu đề/bảng (tài liệu Markdown thật, như các dự thảo hướng dẫn được ngắt dòng cứng) → xuống dòng đơn trong một
 * đoạn được nối lại theo chuẩn Markdown.
 */

const MARKDOWN_DOCUMENT_HINT = /^(?:#{1,6}[ \t]+\S|[ \t]*\|.*\|[ \t]*$)/m;

function siteOrigin(): string | null {
  try {
    return new URL(getEnv().APP_URL).origin;
  } catch {
    return null;
  }
}

function createRenderer(breaks: boolean): Marked {
  const instance = new Marked({ gfm: true, breaks, async: false });
  instance.use({
    renderer: {
      // Lớp 1: HTML thô (khối hoặc inline) hiển thị như chữ, không bao giờ thành thẻ.
      html({ text }) {
        return escapeHtmlText(text);
      },
    },
  });
  return instance;
}

const markdownDocument = createRenderer(false);
const plainTextCompatible = createRenderer(true);

/** Markdown (hoặc chữ thuần cũ) → HTML đã sanitize, `{brand}` đã thay. Chuỗi rỗng → "". */
export function renderCmsRichText(source: string, brandName: string): string {
  const text = source.replace(/\r\n?/g, "\n");
  if (!text.trim()) return "";
  const renderer = MARKDOWN_DOCUMENT_HINT.test(text) ? markdownDocument : plainTextCompatible;
  const rawHtml = renderer.parse(text) as string;
  const clean = sanitizeRichTextHtml(rawHtml, { imageCloudName: null, trustedLinks: { siteOrigin: siteOrigin() }, allowTables: true });
  return replaceBrandTokenInHtml(clean, brandName);
}
