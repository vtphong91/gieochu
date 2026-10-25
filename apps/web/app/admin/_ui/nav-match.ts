/**
 * Luật chọn mục sidebar đang sáng (System Center + Studio) — tách khỏi `sidebar-nav.tsx` để dùng chung và dễ kiểm.
 *
 * Mỗi mục có `href` và tuỳ chọn `match` (ADR-058: một mục sidebar đại diện cho cả nhóm tab cùng chức năng):
 * - `href`: gốc khu vực (`rootHref`, vd `/admin`, `/studio/{slug}`) chỉ khớp ĐÚNG; href khác khớp chính nó + trang con.
 * - `match`: chuỗi thường = khớp tiền tố (chính nó + `.../con`); chuỗi bắt đầu bằng `=` = chỉ khớp đúng đường dẫn đó.
 *   Vd `"=/admin/settings"` (tiền tố của mọi trang cấu hình — không được khớp theo tiền tố).
 *
 * Gốc khu vực và `/admin/settings` là tiền tố của chính các mục khác, nên mục thắng là mục có mẫu khớp DÀI NHẤT trong
 * toàn bộ menu (bằng nhau → mục đứng trước) — nếu không mục cha lẫn mục con cùng sáng một lúc.
 */
export type NavMatchItem = { href: string; match?: string[] };

function patternLength(pathname: string, pattern: string, exact: boolean): number {
  if (exact) return pathname === pattern ? pattern.length : -1;
  return pathname === pattern || pathname.startsWith(`${pattern}/`) ? pattern.length : -1;
}

/** Độ dài mẫu khớp dài nhất của một mục với `pathname`; -1 = không khớp. */
export function navMatchLength(pathname: string, item: NavMatchItem, rootHref: string): number {
  let best = patternLength(pathname, item.href, item.href === rootHref);
  for (const raw of item.match ?? []) {
    const exact = raw.startsWith("=");
    best = Math.max(best, patternLength(pathname, exact ? raw.slice(1) : raw, exact));
  }
  return best;
}

/** href của mục đang sáng (khớp dài nhất, bằng nhau → mục đứng trước); `null` khi không mục nào khớp. */
export function pickActiveHref(pathname: string, items: NavMatchItem[], rootHref: string): string | null {
  let winner: string | null = null;
  let winnerLength = -1;
  for (const item of items) {
    const length = navMatchLength(pathname, item, rootHref);
    if (length > winnerLength) {
      winner = item.href;
      winnerLength = length;
    }
  }
  return winner;
}
