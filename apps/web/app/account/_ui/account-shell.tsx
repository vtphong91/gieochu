import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import type { AccountHeaderData } from "../../../lib/account-profile";
import { AccountMenu } from "../../_ui/account-menu";
import { BrandMark } from "../../_ui/brand-mark";
import { systemFontVars } from "../../_ui/system-fonts";
import type { AccountNavGroup } from "./account-nav";
import { AccountBackLink } from "./back-link";
import { AccountSidebarNav } from "./account-sidebar-nav";
import { LogoutButton } from "./logout-button";

const INK = brandColors.ink;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";
/** Nền vùng làm việc app shell — cùng giá trị Studio. */
const SHELL_BG = "#F5F6F8";

/**
 * Khung app shell `/account/**` (trình bày thuần, nhận dữ liệu qua props): skip-link, header hệ thống gọn 64px (logo →
 * trang chủ, nhãn "Tài khoản", menu tài khoản hoặc "Đăng nhập"), sidebar từ `lg` khi có `groups`, vùng nội dung fluid.
 */
export function AccountShell({
  brandName,
  logoUrl,
  signedIn,
  header,
  groups,
  children,
}: {
  brandName: string;
  logoUrl: string | null;
  signedIn: boolean;
  header: AccountHeaderData | null;
  /** `null` = chưa đăng nhập / chưa xác minh → không sidebar, không link "Tài khoản". */
  groups: AccountNavGroup[] | null;
  children: ReactNode;
}) {
  const displayName = header?.fullName || header?.email || "Tài khoản";
  return (
    <div className={`${systemFontVars} flex min-h-dvh flex-col font-[family-name:var(--font-body)]`} style={{ background: SHELL_BG, color: INK }}>
      <a
        href="#noi-dung"
        className="sr-only z-50 rounded-lg bg-white px-4 py-3 text-sm font-semibold focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:outline-2"
        style={{ color: BLUE, outlineColor: BLUE }}
      >
        Bỏ qua tới nội dung chính
      </a>
      <header className="sticky top-0 z-20 border-b bg-white" style={{ borderColor: LINE }}>
        <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/" className="flex min-h-11 shrink-0 items-center gap-2.5 rounded-lg outline-offset-2 focus-visible:outline-2" style={{ outlineColor: BLUE }}>
              <BrandMark url={logoUrl} brandName={brandName} size={32} fallbackBg={BLUE} />
              {logoUrl ? null : (
                <span className="hidden font-[family-name:var(--font-heading)] text-lg font-bold sm:inline">{brandName}</span>
              )}
              <span className="sr-only">— về trang chủ</span>
            </Link>
            <span aria-hidden="true" className="h-6 w-px shrink-0" style={{ background: LINE }} />
            <span className="truncate text-sm font-semibold text-gray-600">Tài khoản</span>
          </div>
          {signedIn ? (
            <AccountMenu variant="app" displayName={displayName} email={header?.email ?? null} avatarUrl={header?.avatarUrl ?? null} primaryHref={null} primaryLabel={null} />
          ) : (
            <Link
              href="/login"
              className="inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold outline-offset-2 focus-visible:outline-2"
              style={{ color: BLUE, outlineColor: BLUE }}
            >
              Đăng nhập
            </Link>
          )}
        </div>
      </header>

      <div className="flex min-w-0 flex-1">
        {groups ? (
          <aside className="hidden w-[264px] shrink-0 flex-col border-r bg-white lg:flex" style={{ borderColor: LINE }}>
            <AccountSidebarNav groups={groups} />
            <div className="mt-auto border-t px-3 py-3" style={{ borderColor: LINE }}>
              <LogoutButton className="min-h-10 w-full rounded-lg px-3 py-2 text-sm" />
            </div>
          </aside>
        ) : null}
        <main id="noi-dung" tabIndex={-1} className="min-w-0 flex-1 px-4 py-6 outline-none sm:px-6 sm:py-8 lg:px-10 lg:py-10">
          {groups ? <AccountBackLink /> : null}
          {children}
        </main>
      </div>
    </div>
  );
}
