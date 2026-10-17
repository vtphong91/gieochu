import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { SiteFooter } from "../_ui/site-footer";
import { SiteHeader } from "../_ui/site-header";
import { systemFontVars } from "../_ui/system-fonts";

/**
 * Khung trang Bảng giá `/pricing` (ADR-041 A GĐ2, ADR-025): header/footer hệ thống đặt ở layout để `loading.tsx` /
 * `error.tsx` vẫn hiện trong khung có header. Mục "Bảng giá" của header được đánh dấu `aria-current="page"`. Skip-link tới
 * `#noi-dung` cho người dùng bàn phím (header dính có nhiều link).
 */
export default function PricingLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${systemFontVars} flex min-h-dvh flex-col font-[family-name:var(--font-body)]`}
      style={{ background: brandColors.background, color: brandColors.ink }}
    >
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--brand-primary,#0F3B82)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>
      <SiteHeader current="pricing" />
      <main id="noi-dung" tabIndex={-1} className="grow outline-none">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
