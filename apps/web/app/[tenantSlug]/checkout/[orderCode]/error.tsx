"use client";

import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
const BTN = `inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center rounded-full px-5 text-sm font-semibold ${FOCUS}`;

/**
 * Lỗi khi tải trang thanh toán (ADR-062 §5). Không lộ chi tiết kỹ thuật (production chỉ có `digest`). `retry()` (Next 16)
 * tải lại dữ liệu segment. Header/footer do `../layout.tsx` (khung chung khu thanh toán) bọc.
 */
export default function CheckoutError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="container-prose px-0">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">Thanh toán</h1>
      <div
        role="alert"
        className="mt-4 rounded-xl border border-l-4 p-4 text-sm leading-relaxed"
        style={{ borderColor: brandColors.accent, background: brandColors.accentSoft, color: brandColors.ink }}
      >
        <p className="font-semibold">Không tải được trang thanh toán.</p>
        <p className="mt-1">Đơn của bạn vẫn được giữ. Vui lòng thử lại sau ít phút — nếu đã chuyển tiền, bạn không cần chuyển lại.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className={`${BTN} text-white hover:brightness-110`} style={{ background: "var(--color-primary)" }}>
          Thử lại
        </button>
        <Link href="/account/orders" className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: brandColors.line, color: brandColors.ink }}>
          Đơn hàng của tôi
        </Link>
      </div>
    </div>
  );
}
