/**
 * Đếm số từ trong nội dung HTML — thuần, an toàn dùng cả client lẫn server
 * (không phụ thuộc Node API). Dùng chung cho mọi nơi hiển thị "X từ" cạnh
 * TiptapEditor (mô tả sản phẩm, sau này Blog) — tránh lặp lại logic đếm từ ở
 * nhiều nơi khác nhau.
 */
export function countWordsInHtml(html: string): number {
  const text = html.replace(/<[^>]*>/g, " ");
  const words = text.split(/\s+/).filter(Boolean);
  return words.length;
}
