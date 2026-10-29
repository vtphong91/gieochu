import { brandColors } from "@gieochu/config/theme";
import { SiteFooter } from "../../_ui/site-footer";
import { SiteHeader } from "../../_ui/site-header";
import { systemFontVars } from "../../_ui/system-fonts";

/**
 * Khung chung của khu thanh toán (ADR-025: trang HỆ THỐNG — `SiteHeader`/`SiteFooter` + font hệ thống, màu token
 * `brandColors`). Bọc cả hai route:
 * - `/{tenantSlug}/checkout?tai-lieu=` — khách vãng lai, trước khi có đơn (ADR-062 Q2, wireframe §3.5);
 * - `/{tenantSlug}/checkout/{orderCode}` — trang thanh toán đơn.
 * Đặt ở layout để `loading.tsx`/`error.tsx` của từng route vẫn nằm trong header/footer.
 *
 * ADR-062 Q5: nội dung trong `container-page` (ngoại lệ của `container-narrow` — ADR-024), trang tự chia 2 cột từ `lg`.
 * Dưới `lg` trang có thanh hành động dính đáy (`.checkout-action-bar`, ~76px + safe area) → khung chừa padding đáy để footer
 * không bị che; `globals.css` chừa `scroll-padding-bottom` để phần tử nhận focus bàn phím không nằm dưới thanh (WCAG 2.4.11).
 */
export default function CheckoutLayout({ children }: { children: React.ReactNode }) {
  return (
    <div
      className={`${systemFontVars} flex min-h-dvh flex-col bg-white pb-[calc(5.5rem+env(safe-area-inset-bottom))] font-[family-name:var(--font-body)] lg:pb-0`}
      style={{ color: brandColors.ink }}
    >
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--color-primary)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>

      <SiteHeader />

      <main id="noi-dung" tabIndex={-1} className="container-page flex-1 py-6 outline-none lg:py-10">
        {children}
      </main>

      <SiteFooter />
    </div>
  );
}
