"use client";

import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
const BTN = `inline-flex min-h-11 cursor-pointer touch-manipulation items-center justify-center rounded-full px-5 text-sm font-semibold ${FOCUS}`;

/**
 * Lỗi khi tải trang thanh toán của khách vãng lai (chưa có đơn). Chưa có đơn nào được tạo ở bước này → nói rõ để khách yên
 * tâm thử lại. Không lộ chi tiết kỹ thuật. Trang đơn có `error.tsx` riêng trong `[orderCode]/`. Header/footer do `../layout.tsx` bọc.
 */
export default function GuestCheckoutError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <div className="container-prose px-0">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold">Thanh toán</h1>
      <div
        role="alert"
        className="mt-4 rounded-xl border border-l-4 p-4 text-sm leading-relaxed"
        style={{ borderColor: brandColors.accent, background: brandColors.accentSoft, color: brandColors.ink }}
      >
        <p className="font-semibold">Không tải được trang thanh toán.</p>
        <p className="mt-1">Chưa có đơn nào được tạo và bạn chưa bị trừ tiền. Vui lòng thử lại sau ít phút.</p>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={() => retry()} className={`${BTN} text-white hover:brightness-110`} style={{ background: "var(--color-primary)" }}>
          Thử lại
        </button>
        <Link href="/" className={`${BTN} border bg-white hover:bg-gray-50`} style={{ borderColor: brandColors.line, color: brandColors.ink }}>
          Về trang chủ
        </Link>
      </div>
    </div>
  );
}
