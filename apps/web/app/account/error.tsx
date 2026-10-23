"use client";

import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle } from "../admin/_ui/icons";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";

/**
 * Lỗi tải trang trong khu vực tài khoản — nằm trong app shell nên header/sidebar vẫn dùng được. Không hiện
 * `error.message` (production chỉ có `digest`); `retry()` (Next 16.3) tải lại dữ liệu segment.
 */
export default function AccountError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    // Thẻ trải hết vùng main (như EmptyState); chỉ giới hạn độ dài dòng của đoạn văn.
    <div role="alert" className="flex flex-col items-center rounded-2xl border bg-white px-6 py-12 text-center" style={{ borderColor: LINE, color: INK }}>
      <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: brandColors.accentSoft, color: "#92400E" }}>
        <IconAlertTriangle className="h-7 w-7" />
      </span>
      <h1 className="mt-4 font-[family-name:var(--font-heading)] text-xl font-semibold">Không tải được trang</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed" style={{ color: INK_SOFT }}>
        Có lỗi tạm thời khi đọc dữ liệu tài khoản. Bạn thử lại sau ít phút nhé.
      </p>
      {error.digest ? (
        <p className="mt-2 text-xs tabular-nums" style={{ color: INK_SOFT }}>
          Mã tham chiếu: <span className="font-semibold [overflow-wrap:anywhere]">{error.digest}</span>
        </p>
      ) : null}
      <div className="mt-6 flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <button
          type="button"
          onClick={() => retry()}
          className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-5 text-sm font-semibold text-white outline-offset-2 hover:brightness-110 focus-visible:outline-2"
          style={{ background: BLUE, outlineColor: BLUE }}
        >
          Thử lại
        </button>
        <Link
          href="/account"
          className="inline-flex min-h-11 items-center justify-center rounded-lg border px-5 text-sm font-semibold outline-offset-2 hover:bg-gray-50 focus-visible:outline-2"
          style={{ borderColor: LINE, color: INK, outlineColor: BLUE }}
        >
          Về Tổng quan
        </Link>
      </div>
    </div>
  );
}
