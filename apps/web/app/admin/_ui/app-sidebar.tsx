import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { LogoutButton } from "../../account/_ui/logout-button";

/**
 * Thân sidebar app shell dùng chung cho System Center và Studio (trình bày thuần, Server Component được): khối brand
 * 64px · `nav` (cuộn riêng, chiếm phần giữa) · chân sidebar gồm link phụ (`footer`) và **Đăng xuất** cố định ở đáy, tách
 * khỏi nhóm điều hướng bằng đường kẻ (destructive-nav-separation). Cùng một phần tử được đặt vào `<aside>` desktop
 * (từ `lg`) và vào `SidebarDrawer` (dưới `lg`).
 */
export function AppSidebarPanel({ brand, nav, footer }: { brand: ReactNode; nav: ReactNode; footer?: ReactNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col text-white" style={{ background: brandColors.primary }}>
      <div className="flex h-16 shrink-0 items-center gap-2.5 px-5">{brand}</div>
      {nav}
      {footer ? <div className="flex shrink-0 flex-col border-t border-white/10 px-3 py-2">{footer}</div> : null}
      <div className="shrink-0 border-t border-white/10 px-3 py-3">
        <LogoutButton tone="onDark" redirectTo="/login" className="min-h-11 w-full rounded-lg px-3 py-2 text-sm lg:min-h-10" />
      </div>
    </div>
  );
}

/** Link phụ ở chân sidebar (Về trang chủ, Xem trang công khai...). */
export const SIDEBAR_FOOTER_LINK_CLASS =
  "flex min-h-11 items-center gap-2 rounded-lg px-3 text-xs font-medium text-white/70 transition-colors outline-offset-[-2px] hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-white motion-reduce:transition-none lg:min-h-9";
