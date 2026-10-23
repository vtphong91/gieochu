/**
 * ADR-050 (bổ sung của Quốc cho văn bản pháp lý) — thay token `{brand}` trong HTML ĐÃ sanitize bằng tên thương hiệu
 * (`getEffectiveBrand().name`). Giá trị thay vào được escape HTML để tên thương hiệu chứa `<`, `&`, `"`... không thể
 * chèn thẻ/thuộc tính. Chạy SAU `sanitizeRichTextHtml` (sanitize trước rồi mới thay — không bao giờ ngược lại).
 * Không phụ thuộc gì — client cũng import được.
 */
export function escapeHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function replaceBrandTokenInHtml(sanitizedHtml: string, brandName: string): string {
  return sanitizedHtml.replaceAll("{brand}", escapeHtmlText(brandName));
}
