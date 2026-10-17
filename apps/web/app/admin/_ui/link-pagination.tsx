import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { IconChevronLeft, IconChevronRight } from "./icons";

/**
 * Phân trang bằng link GET (Server Component, không JS) cho trang danh sách quản trị có bộ lọc dạng form GET.
 * Khác `Pagination` (client, `router.push`): mỗi trang là 1 URL thật — chia sẻ/bookmark được, Back/Forward đúng.
 * - `query`: các tham số cần giữ (bộ lọc đã chuẩn hoá, pageSize...) — giá trị rỗng bị bỏ khỏi URL.
 * - Trang hiện tại `aria-current="page"` + nền đặc (không chỉ đổi màu chữ). Đầu/cuối: Trước/Sau là `<span>` mờ.
 * - Dưới `sm` chỉ hiện Trước · "Trang x/y" · Sau để không tràn ngang ở 360px; số trang hiện từ `sm`.
 * - Target ≥ 44px dưới `lg`, gọn 36px từ `lg` (con trỏ chuột).
 */

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const ITEM = `inline-flex min-h-11 min-w-11 items-center justify-center gap-1 rounded-lg border px-3 text-sm font-semibold tabular-nums transition-colors lg:min-h-9 lg:min-w-9 ${FOCUS}`;
const LINE = "#E5E7EB";
const INK_SOFT = "#6B7280";

const numberFormat = new Intl.NumberFormat("vi-VN");

/** Trang cần hiện: 1, …, p-1, p, p+1, …, last. */
function pageWindow(page: number, totalPages: number): (number | "gap")[] {
  const pages = new Set<number>([1, totalPages, page - 1, page, page + 1]);
  const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);
  const out: (number | "gap")[] = [];
  sorted.forEach((n, i) => {
    const prev = sorted[i - 1];
    if (prev !== undefined && n - prev > 1) out.push("gap");
    out.push(n);
  });
  return out;
}

export function LinkPagination({
  basePath,
  query,
  page,
  pageSize,
  total,
  label = "Phân trang",
  unit = "mục",
}: {
  basePath: string;
  query: Record<string, string | number | null | undefined>;
  page: number;
  pageSize: number;
  total: number;
  label?: string;
  /** Danh từ đếm trong dòng tóm tắt ("Hiển thị 1–20 trong 135 mục"). */
  unit?: string;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  const href = (target: number) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (value !== null && value !== undefined && value !== "") params.set(key, String(value));
    }
    if (target > 1) params.set("page", String(target));
    else params.delete("page");
    const qs = params.toString();
    return qs ? `${basePath}?${qs}` : basePath;
  };

  const idle = { borderColor: LINE, color: brandColors.ink, background: "white" };
  const current = { borderColor: brandColors.primary, background: brandColors.primary, color: "white" };

  return (
    <div className="mt-4 flex flex-col gap-3 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="tabular-nums" style={{ color: INK_SOFT }}>
        {total === 0
          ? `Không có ${unit} nào`
          : `Hiển thị ${numberFormat.format(from)}–${numberFormat.format(to)} trong ${numberFormat.format(total)} ${unit}`}
      </p>

      {totalPages > 1 ? (
        <nav aria-label={label} className="flex items-center gap-2">
          {page > 1 ? (
            <Link href={href(page - 1)} rel="prev" className={ITEM} style={idle}>
              <IconChevronLeft className="h-4 w-4" />
              Trước
            </Link>
          ) : (
            <span aria-disabled="true" className={`${ITEM} cursor-not-allowed opacity-45`} style={idle}>
              <IconChevronLeft className="h-4 w-4" />
              Trước
            </span>
          )}

          <span className="px-1 font-medium tabular-nums sm:hidden" style={{ color: brandColors.ink }}>
            Trang {numberFormat.format(page)}/{numberFormat.format(totalPages)}
          </span>
          <ul className="hidden items-center gap-1.5 sm:flex">
            {pageWindow(page, totalPages).map((n, i) =>
              n === "gap" ? (
                <li key={`gap-${i}`} aria-hidden="true" className="px-1" style={{ color: INK_SOFT }}>
                  …
                </li>
              ) : (
                <li key={n}>
                  <Link
                    href={href(n)}
                    aria-current={n === page ? "page" : undefined}
                    aria-label={n === page ? `Trang ${n}, trang hiện tại` : `Trang ${n}`}
                    className={ITEM}
                    style={n === page ? current : idle}
                  >
                    {numberFormat.format(n)}
                  </Link>
                </li>
              ),
            )}
          </ul>

          {page < totalPages ? (
            <Link href={href(page + 1)} rel="next" className={ITEM} style={idle}>
              Sau
              <IconChevronRight className="h-4 w-4" />
            </Link>
          ) : (
            <span aria-disabled="true" className={`${ITEM} cursor-not-allowed opacity-45`} style={idle}>
              Sau
              <IconChevronRight className="h-4 w-4" />
            </span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
