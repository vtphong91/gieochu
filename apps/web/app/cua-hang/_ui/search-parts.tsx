import { useId, type ReactNode } from "react";
import Link from "next/link";
import { BLUE, FOCUS_RING, IconArrow, IconChevron, INK, INK_SOFT, LINE, formatCount } from "../../_ui/catalog-parts";
import { IconInfo } from "../../[tenantSlug]/_ui/icons";
// Chỉ hằng/kiểu/hàm dựng URL thuần — không gọi hàm DB trong _ui.
import { SHOP_SEARCH_PATH, SHOP_SORT_LABELS, SHOP_SORTS, shopSearchHref, type ShopSort } from "../../../lib/shop";

/** Bộ lọc hiện tại của trang tìm — dùng để dựng link giữ nguyên các tham số khác. */
export interface ShopSearchState {
  q?: string;
  categorySlug?: string;
  sort: ShopSort;
}

const CONTROL = `h-11 rounded-xl border bg-white text-[15px] [touch-action:manipulation] ${FOCUS_RING}`;

/**
 * Chọn cách sắp xếp — form GET riêng (giữ `q` + `danh-muc` bằng input ẩn, về trang 1). Không cần JS: có nút "Áp dụng";
 * nhãn hiển thị cho select.
 */
export function ShopSortForm({ q, categorySlug, sort }: ShopSearchState) {
  const selectId = useId();
  return (
    <form action={SHOP_SEARCH_PATH} method="get" className="flex flex-wrap items-center gap-2">
      {q ? <input type="hidden" name="q" value={q} /> : null}
      {categorySlug ? <input type="hidden" name="danh-muc" value={categorySlug} /> : null}
      <label htmlFor={selectId} className="text-sm font-semibold">
        Sắp xếp
      </label>
      <select
        id={selectId}
        name="sap-xep"
        defaultValue={sort}
        className={`${CONTROL} cursor-pointer px-3 text-base sm:text-[15px]`}
        style={{ borderColor: LINE, color: INK, outlineColor: BLUE }}
      >
        {SHOP_SORTS.map((value) => (
          <option key={value} value={value}>
            {SHOP_SORT_LABELS[value]}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className={`${CONTROL} cursor-pointer px-4 font-semibold transition-colors hover:bg-[color:var(--sort-hover)]`}
        style={{ borderColor: LINE, color: BLUE, outlineColor: BLUE, ["--sort-hover" as string]: `color-mix(in srgb, ${BLUE} 6%, white)` }}
      >
        Áp dụng
      </button>
    </form>
  );
}

/** Ghi chú (không phải lỗi) — vd danh mục trên URL không còn tồn tại. Icon + chữ, không chỉ dựa vào màu. */
export function SearchNote({ children }: { children: ReactNode }) {
  return (
    <p className="flex items-start gap-2 rounded-xl border bg-white px-3.5 py-2.5 text-[14px] leading-snug" style={{ borderColor: LINE, color: INK }}>
      <IconInfo className="mt-0.5 h-[18px] w-[18px] shrink-0" />
      <span className="min-w-0 [overflow-wrap:anywhere]">{children}</span>
    </p>
  );
}

/** Danh sách số trang hiển thị: 1 … (p-1) p (p+1) … last; `null` = dấu ba chấm. */
function pageWindow(page: number, pageCount: number): (number | null)[] {
  const pages = new Set([1, pageCount, page - 1, page, page + 1].filter((n) => n >= 1 && n <= pageCount));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | null)[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) out.push(n - prev === 2 ? prev + 1 : null);
    out.push(n);
  });
  return out;
}

const PAGE_LINK = `inline-flex h-11 min-w-11 items-center justify-center gap-1 rounded-full border px-3 text-[15px] font-semibold tabular-nums transition-colors ${FOCUS_RING}`;

/**
 * Phân trang bằng link (không JS): Trước/Sau + số trang (≥ sm; dưới sm chỉ "Trang x/y" để không tràn ngang).
 * Trang hiện tại `aria-current="page"` + nền đặc (không chỉ đổi màu chữ). Đầu/cuối: nút mờ không phải link.
 */
export function ShopPagination({ page, pageCount, state }: { page: number; pageCount: number; state: ShopSearchState }) {
  if (pageCount <= 1) return null;
  const href = (target: number) => shopSearchHref({ ...state, page: target });
  const idle = { borderColor: LINE, color: BLUE, outlineColor: BLUE, background: "white" };
  const disabled = `${PAGE_LINK} cursor-not-allowed opacity-45`;

  return (
    <nav aria-label="Phân trang kết quả" className="mt-10 flex items-center justify-center gap-2 sm:gap-3">
      {page > 1 ? (
        <Link href={href(page - 1)} rel="prev" className={PAGE_LINK} style={idle}>
          <IconChevron className="h-4 w-4 rotate-90" />
          Trước
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled} style={idle}>
          <IconChevron className="h-4 w-4 rotate-90" />
          Trước
        </span>
      )}

      <p className="px-2 text-sm font-semibold tabular-nums sm:hidden" style={{ color: INK }}>
        Trang {formatCount(page)}/{formatCount(pageCount)}
      </p>
      <ul className="hidden items-center gap-2 sm:flex">
        {pageWindow(page, pageCount).map((n, i) =>
          n === null ? (
            <li key={`gap-${i}`} aria-hidden="true" className="px-1" style={{ color: INK_SOFT }}>
              …
            </li>
          ) : (
            <li key={n}>
              {n === page ? (
                <Link
                  href={href(n)}
                  aria-current="page"
                  aria-label={`Trang ${n}, trang hiện tại`}
                  className={PAGE_LINK}
                  style={{ borderColor: BLUE, background: BLUE, color: "white", outlineColor: BLUE }}
                >
                  {formatCount(n)}
                </Link>
              ) : (
                <Link href={href(n)} aria-label={`Trang ${n}`} className={PAGE_LINK} style={idle}>
                  {formatCount(n)}
                </Link>
              )}
            </li>
          ),
        )}
      </ul>

      {page < pageCount ? (
        <Link href={href(page + 1)} rel="next" className={PAGE_LINK} style={idle}>
          Sau
          <IconChevron className="h-4 w-4 -rotate-90" />
        </Link>
      ) : (
        <span aria-disabled="true" className={disabled} style={idle}>
          Sau
          <IconChevron className="h-4 w-4 -rotate-90" />
        </span>
      )}
    </nav>
  );
}

const CHIP = `inline-flex min-h-11 max-w-full items-center rounded-full border bg-white px-4 text-sm font-semibold transition-colors hover:border-[color:var(--chip-hover)] [touch-action:manipulation] ${FOCUS_RING}`;

/**
 * Không có kết quả: nói rõ bộ lọc đang dùng + lối ra (bỏ từ khoá / bỏ danh mục / xem tất cả) + chip danh mục phổ biến.
 */
export function ShopNoResults({
  state,
  categoryName,
  popular,
}: {
  state: ShopSearchState;
  /** Tên danh mục đang lọc (đã xác nhận tồn tại). */
  categoryName?: string;
  popular: { id: string; slug: string; name: string }[];
}) {
  const chipsLabelId = useId();
  const actions: { href: string; label: string }[] = [];
  if (state.q && categoryName) {
    actions.push({ href: shopSearchHref({ q: state.q, sort: state.sort }), label: `Tìm “${state.q}” trong mọi danh mục` });
    actions.push({ href: shopSearchHref({ categorySlug: state.categorySlug, sort: state.sort }), label: `Xem tất cả ${categoryName}` });
  }
  actions.push({ href: SHOP_SEARCH_PATH, label: "Xem tất cả tài liệu" });

  return (
    <div className="mx-auto flex max-w-[640px] flex-col items-center rounded-3xl border bg-white px-6 py-10 text-center sm:px-10" style={{ borderColor: LINE, color: INK }}>
      <p className="font-[family-name:var(--font-heading)] text-[20px] leading-snug font-semibold sm:text-[22px]">Chưa tìm thấy tài liệu phù hợp</p>
      <p className="mt-2 text-[14.5px] leading-[1.65]" style={{ color: INK_SOFT }}>
        {state.q ? "Thử từ khoá ngắn hơn, bỏ dấu hoặc tên môn học/giáo viên khác. " : ""}
        {categoryName ? "Danh mục này hiện chưa có tài liệu khớp bộ lọc." : ""}
      </p>
      <ul className="mt-6 flex w-full flex-col items-stretch gap-2.5 sm:w-auto sm:items-center">
        {actions.map((action) => (
          <li key={action.href}>
            <Link
              href={action.href}
              className={`inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-full border px-5 text-[15px] font-semibold sm:w-auto ${FOCUS_RING}`}
              style={{ borderColor: LINE, color: BLUE, outlineColor: BLUE }}
            >
              <span className="[overflow-wrap:anywhere]">{action.label}</span>
              <IconArrow className="h-4 w-4 shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
      {popular.length > 0 ? (
        <div className="mt-8 flex w-full flex-col items-center gap-3">
          <p id={chipsLabelId} className="text-[13px] font-semibold" style={{ color: INK_SOFT }}>
            Danh mục phổ biến
          </p>
          <ul aria-labelledby={chipsLabelId} className="flex flex-wrap justify-center gap-2">
            {popular.map((category) => (
              <li key={category.id} className="max-w-full">
                <Link
                  href={shopSearchHref({ categorySlug: category.slug })}
                  className={CHIP}
                  style={{ borderColor: LINE, color: INK, outlineColor: BLUE, ["--chip-hover" as string]: BLUE }}
                >
                  <span className="[overflow-wrap:anywhere]">{category.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
