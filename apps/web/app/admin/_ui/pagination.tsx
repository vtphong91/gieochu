"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconChevronLeft, IconChevronRight, IconChevronsLeft, IconChevronsRight } from "./icons";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

const NAV_BTN =
  "flex h-8 w-8 items-center justify-center rounded-md border text-gray-500 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent";

/** Phân trang dùng chung mọi trang danh sách — điều khiển qua query string (?page=&pageSize=), giữ nguyên các filter khác đang có trên URL. */
export function Pagination({ total, page, pageSize }: { total: number; page: number; pageSize: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);

  function go(nextPage: number, nextPageSize: number = pageSize) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(nextPage));
    params.set("pageSize", String(nextPageSize));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-4 text-sm" style={{ color: "#6B7280" }}>
      <div className="flex items-center gap-2">
        <span>Hiển thị:</span>
        <select
          value={pageSize}
          onChange={(e) => go(1, Number(e.target.value))}
          className="rounded-lg border bg-white px-2.5 py-1.5 text-sm outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
          style={{ borderColor: "#E5E7EB", color: "#12213A" }}
        >
          {PAGE_SIZE_OPTIONS.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      <div>{total === 0 ? "Không có kết quả" : `Hiển thị ${from} - ${to} trong tổng số ${total} kết quả`}</div>

      <div className="flex items-center gap-1.5">
        <button type="button" className={NAV_BTN} style={{ borderColor: "#E5E7EB" }} disabled={page <= 1} onClick={() => go(1)} aria-label="Trang đầu">
          <IconChevronsLeft className="h-4 w-4" />
        </button>
        <button type="button" className={NAV_BTN} style={{ borderColor: "#E5E7EB" }} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Trang trước">
          <IconChevronLeft className="h-4 w-4" />
        </button>
        <span className="px-2 font-medium" style={{ color: "#12213A" }}>
          Trang {page}/{totalPages}
        </span>
        <button
          type="button"
          className={NAV_BTN}
          style={{ borderColor: "#E5E7EB" }}
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
          aria-label="Trang sau"
        >
          <IconChevronRight className="h-4 w-4" />
        </button>
        <button
          type="button"
          className={NAV_BTN}
          style={{ borderColor: "#E5E7EB" }}
          disabled={page >= totalPages}
          onClick={() => go(totalPages)}
          aria-label="Trang cuối"
        >
          <IconChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
