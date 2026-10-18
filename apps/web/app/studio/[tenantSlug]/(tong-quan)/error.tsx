"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle } from "../../../admin/_ui/icons";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";

/**
 * Lỗi tải Tổng quan gian hàng (ADR-043). Nằm trong app shell Studio nên sidebar vẫn dùng được. Không hiện
 * `error.message` (production chỉ có `digest`); `retry()` (Next 16.3) tính lại số liệu.
 */
export default function StudioDashboardError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  const { tenantSlug } = useParams<{ tenantSlug: string }>();
  return (
    <div className="px-5 py-8 lg:px-8">
      <div
        role="alert"
        className="mx-auto flex max-w-xl flex-col items-center rounded-2xl border border-gray-200 bg-white px-6 py-10 text-center"
        style={{ color: INK }}
      >
        <span aria-hidden="true" className="flex h-14 w-14 items-center justify-center rounded-2xl" style={{ background: brandColors.accentSoft, color: "#92400E" }}>
          <IconAlertTriangle className="h-7 w-7" />
        </span>
        <h1 className="mt-4 font-[family-name:var(--font-heading)] text-xl font-semibold">Không tải được số liệu Tổng quan</h1>
        <p className="mt-2 text-sm leading-relaxed" style={{ color: INK_SOFT }}>
          Có lỗi tạm thời khi tính số liệu gian hàng. Bạn thử lại sau ít phút; các mục khác ở menu vẫn dùng bình thường.
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
            className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-5 text-sm font-semibold text-white hover:brightness-110 ${FOCUS}`}
            style={{ background: brandColors.primary }}
          >
            Thử lại
          </button>
          <Link
            href={`/studio/${tenantSlug}/orders`}
            className={`inline-flex min-h-11 items-center justify-center rounded-lg border border-gray-200 px-5 text-sm font-semibold hover:bg-gray-50 ${FOCUS}`}
            style={{ color: INK }}
          >
            Xem đơn hàng
          </Link>
        </div>
      </div>
    </div>
  );
}
