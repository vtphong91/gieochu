import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { SiteFooter } from "../_ui/site-footer";
import { SiteHeader } from "../_ui/site-header";
import { systemFontVars } from "../_ui/system-fonts";

/**
 * Khung chung của Cửa hàng (`/cua-hang`, `/cua-hang/tai-lieu` — ADR-035): header/footer hệ thống (ADR-025) đặt ở
 * layout để `loading.tsx` / `error.tsx` của segment vẫn hiện trong khung có header (không nháy trang trống). Mục
 * "Cửa hàng" của header được đánh dấu `aria-current="page"`.
 */
export default function ShopLayout({ children }: { children: ReactNode }) {
  return (
    <div
      className={`${systemFontVars} flex min-h-dvh flex-col font-[family-name:var(--font-body)]`}
      style={{ background: brandColors.background, color: brandColors.ink }}
    >
      <SiteHeader current="shop" />
      <main className="grow">{children}</main>
      <SiteFooter />
    </div>
  );
}
