"use client";

import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle } from "../admin/_ui/icons";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const AMBER = brandColors.accent;
const AMBER_SOFT = brandColors.accentSoft;

/**
 * Error boundary của Cửa hàng (`/cua-hang`, `/cua-hang/tai-lieu`). Next.js chỉ giữ `digest` ở production — không hiển
 * thị `error.message` (có thể chứa chi tiết SQL); luôn cùng một thông báo chung + mã tham chiếu để báo hỗ trợ.
 * `retry()` (Next 16.3) tải lại dữ liệu của segment; link phụ về trang chủ. Nằm trong layout nên vẫn có header/footer.
 */
export default function ShopError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <section className="py-14 sm:py-20">
      <div className="container-page">
        <div
          role="alert"
          className="mx-auto flex max-w-[560px] flex-col items-center rounded-3xl border bg-white px-6 py-10 text-center sm:px-10 sm:py-12"
          style={{ borderColor: LINE, color: INK }}
        >
          <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: AMBER_SOFT, color: AMBER }}>
            <IconAlertTriangle className="h-8 w-8" />
          </span>
          <h1 className="mt-5 font-[family-name:var(--font-heading)] text-[22px] leading-snug font-semibold sm:text-[26px]">
            Không tải được Cửa hàng
          </h1>
          <p className="mt-3 text-[14.5px] leading-[1.65] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
            Có lỗi tạm thời khi tải tài liệu. Bạn thử lại sau ít phút nhé — nếu vẫn lỗi, hãy gửi mã tham chiếu bên dưới cho bộ
            phận hỗ trợ.
          </p>
          {error.digest ? (
            <p className="mt-3 text-[13px] tabular-nums" style={{ color: INK_SOFT }}>
              Mã tham chiếu: <span className="font-semibold [overflow-wrap:anywhere]">{error.digest}</span>
            </p>
          ) : null}
          <div className="mt-7 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:justify-center">
            <button
              type="button"
              onClick={() => retry()}
              className="inline-flex min-h-12 cursor-pointer items-center justify-center rounded-full px-7 text-[15px] font-bold text-white transition-[filter] outline-offset-2 hover:brightness-110 focus-visible:outline-2 [touch-action:manipulation]"
              style={{ background: BLUE, outlineColor: BLUE }}
            >
              Thử lại
            </button>
            <Link
              href="/"
              className="inline-flex min-h-12 items-center justify-center rounded-full border px-6 text-[15px] font-semibold outline-offset-2 focus-visible:outline-2"
              style={{ borderColor: LINE, color: BLUE, outlineColor: BLUE }}
            >
              Về trang chủ
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
