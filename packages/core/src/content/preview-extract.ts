/**
 * ADR-063: pure helpers (no I/O) tính biên "20% nội dung" cho preview tài liệu.
 * Thuần — test được bằng Jest ở packages/core; apps/web/lib/product-file-preview.ts gọi vào đây.
 */

export interface DocxParagraphSliceResult {
  html: string;
  paragraphsShown: number;
  totalParagraphs: number;
}

export const DOCX_PREVIEW_RATIO = 0.2;
export const DOCX_PREVIEW_MIN = 3;
export const DOCX_PREVIEW_MAX = 60;

export const XLSX_PREVIEW_RATIO = 0.2;
export const XLSX_PREVIEW_MIN = 10;
export const XLSX_PREVIEW_MAX = 200;

/**
 * Tách HTML (do mammoth sinh) thành các block `<p>`/`<h1-6>` ở cấp cao nhất; cắt 20% block đầu (bounded by
 * MIN/MAX), ghép lại. Không có DOM server-side — dùng regex nguyên block, chịu được HTML lồng (anchor, em,
 * strong) bên trong vì chỉ tìm thẻ MỞ ở cấp cao nhất.
 */
export function sliceDocxHtmlParagraphs(html: string): DocxParagraphSliceResult {
  const blockRegex = /<(p|h[1-6])(?=[\s>])[^>]*>[\s\S]*?<\/\1\s*>/gi;
  const matches = html.match(blockRegex) ?? [];
  const totalParagraphs = matches.length;
  if (totalParagraphs === 0) return { html: html.trim(), paragraphsShown: 0, totalParagraphs: 0 };
  const target = Math.ceil(totalParagraphs * DOCX_PREVIEW_RATIO);
  const bounded = Math.max(DOCX_PREVIEW_MIN, Math.min(DOCX_PREVIEW_MAX, target));
  const shown = Math.min(bounded, totalParagraphs);
  return { html: matches.slice(0, shown).join("\n"), paragraphsShown: shown, totalParagraphs };
}

export interface XlsxRowSliceResult {
  rows: unknown[][];
  rowsShown: number;
  totalRows: number;
}

/**
 * Cắt 20% hàng đầu (min 10, max 200) từ ma trận bảng tính (sheet_to_json(..., header: 1)).
 */
export function sliceXlsxRows(rows: unknown[][]): XlsxRowSliceResult {
  const totalRows = rows.length;
  if (totalRows === 0) return { rows: [], rowsShown: 0, totalRows: 0 };
  const target = Math.ceil(totalRows * XLSX_PREVIEW_RATIO);
  const bounded = Math.max(XLSX_PREVIEW_MIN, Math.min(XLSX_PREVIEW_MAX, target));
  const shown = Math.min(bounded, totalRows);
  return { rows: rows.slice(0, shown), rowsShown: shown, totalRows };
}

export const TEXT_PREVIEW_RATIO = 0.2;
export const TEXT_PREVIEW_MIN_CHARS = 200;
export const TEXT_PREVIEW_MAX_CHARS = 50_000;

/**
 * Cắt 20% ký tự văn bản thuần tại ranh giới `\n` gần nhất (fallback: cắt thô). Min 200, max 50_000 ký tự.
 */
export function sliceTextByChars(text: string): { text: string; charsShown: number; totalChars: number } {
  const totalChars = text.length;
  if (totalChars === 0) return { text: "", charsShown: 0, totalChars: 0 };
  const target = Math.ceil(totalChars * TEXT_PREVIEW_RATIO);
  const bounded = Math.max(TEXT_PREVIEW_MIN_CHARS, Math.min(TEXT_PREVIEW_MAX_CHARS, target));
  const cap = Math.min(bounded, totalChars);
  // Ưu tiên cắt tại dòng gần vị trí target (±200 ký tự xung quanh để tránh cắt giữa dòng).
  const window = text.slice(0, Math.min(cap + 200, totalChars));
  const lastNewline = window.lastIndexOf("\n");
  const cut = lastNewline >= TEXT_PREVIEW_MIN_CHARS && lastNewline <= cap + 200 ? lastNewline : cap;
  const sliced = text.slice(0, Math.min(cut, totalChars));
  return { text: sliced, charsShown: sliced.length, totalChars };
}
