import { slugify } from "@gieochu/core";

/**
 * Mục lục trang văn bản pháp lý (ADR-050 GĐ2, lớp trình bày): đọc HTML **đã sanitize** (whitelist Tiptap — `h1..h4` không có
 * thuộc tính nào), hạ mọi `<h1>` trong nội dung xuống `<h2>` (trang chỉ có một H1 là tiêu đề văn bản), gắn `id` cho từng
 * `<h2>` và trả danh sách mục để dựng TOC. `id` = slug không dấu của tiêu đề (chống trùng bằng hậu tố), rỗng → `muc-n`.
 * Chuỗi `id` chỉ gồm `[a-z0-9-]` nên chèn vào HTML an toàn; nhãn TOC trả dạng text (React tự escape).
 */

export interface LegalTocItem {
  id: string;
  text: string;
}

const ENTITY_MAP: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, code: string) => {
    if (code[0] === "#") {
      const point = code[1]?.toLowerCase() === "x" ? Number.parseInt(code.slice(2), 16) : Number.parseInt(code.slice(1), 10);
      return Number.isFinite(point) && point > 0 && point <= 0x10ffff ? String.fromCodePoint(point) : match;
    }
    return ENTITY_MAP[code.toLowerCase()] ?? match;
  });
}

function plainText(html: string): string {
  return decodeEntities(html.replace(/<[^>]*>/g, "")).replace(/\s+/g, " ").trim();
}

export function buildLegalToc(html: string): { html: string; items: LegalTocItem[] } {
  const items: LegalTocItem[] = [];
  // id đã dùng trong khung trang (skip-link, đầu bài, mục lục) — tránh trùng với tiêu đề như "Nội dung".
  const used = new Set<string>(["noi-dung", "dau-trang", "muc-luc", "muc-luc-mobile"]);
  const normalized = html.replace(/<h1>/g, "<h2>").replace(/<\/h1>/g, "</h2>");
  const withIds = normalized.replace(/<h2>([\s\S]*?)<\/h2>/g, (_match, inner: string) => {
    const text = plainText(inner);
    const base = slugify(text).slice(0, 60).replace(/-+$/, "") || `muc-${items.length + 1}`;
    let id = base;
    for (let n = 2; used.has(id); n += 1) id = `${base}-${n}`;
    used.add(id);
    if (text) items.push({ id, text });
    return `<h2 id="${id}">${inner}</h2>`;
  });
  return { html: withIds, items };
}
