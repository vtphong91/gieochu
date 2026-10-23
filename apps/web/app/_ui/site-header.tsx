import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { getCurrentUser } from "../../lib/session";
import { resolveLandingPath } from "../../lib/landing-path";
import { getAccountHeaderData } from "../../lib/account-profile";
import { getSiteMenu } from "../../lib/site-menu";
import { AccountMenu } from "./account-menu";
import { BrandMark } from "./brand-mark";
import { MobileNav, type MobileNavItem } from "./mobile-nav";
import { NavDropdown } from "./nav-dropdown";
import { NavLinkAnchor } from "./nav-link";
import { systemFontVars } from "./system-fonts";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PAPER = brandColors.background;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const AMBER = brandColors.accent;

/** Link nav ngang (≥ lg): trang hiện tại đậm + gạch chân (không chỉ đổi màu). */
const NAV_LINK_CLASS =
  "inline-flex min-h-11 items-center text-[15px] font-medium underline-offset-[6px] outline-offset-2 hover:underline focus-visible:outline-2 aria-[current=page]:font-bold aria-[current=page]:underline aria-[current=page]:decoration-2";

/** Mục điều hướng trang tự truyền vào (`current`) — so khớp với `href` của mục menu CMS để gắn `aria-current`. */
export type SiteNavKey = "shop" | "pricing";

const NAV_KEY_PATHS: Record<SiteNavKey, string> = { shop: "/cua-hang", pricing: "/pricing" };

/**
 * Header hệ thống dùng chung mọi trang public (ADR-025): trang chủ, storefront tenant,
 * chi tiết tài liệu, checkout. Bố cục cố định; mục menu + nút CTA đọc từ CMS menu (ADR-050, `getSiteMenu`); tự đọc brand/logo và
 * người dùng hiện tại (branding có cache() theo request — gọi lặp ở trang không tốn thêm truy vấn).
 * Tự gắn font + màu chữ hệ thống nên đặt được trong trang có font/theme riêng.
 * Cao 68px (< sm) / 88px (sm+) — `scroll-padding-top` trong globals.css (.site-header) khớp số này.
 * Nền + border full-bleed ở <header>; nội dung bọc container-page (ADR-024).
 * `current`: mục điều hướng ứng với trang đang xem (trang tự truyền — header là Server Component, không biết pathname)
 * → `aria-current="page"` + chữ đậm/gạch chân. Mục có menu con → `NavDropdown` (bấm để mở, Esc đóng). Dưới `lg` nav ngang
 * ẩn, thay bằng `MobileNav` (nút menu, menu con dạng accordion).
 */
export async function SiteHeader({ current }: { current?: SiteNavKey } = {}) {
  const [brand, logos, currentUser, menu] = await Promise.all([getEffectiveBrand(), getEffectiveLogos(), getCurrentUser(), getSiteMenu()]);
  const currentPath = current ? NAV_KEY_PATHS[current] : null;
  const isCurrent = (href: string | null) => href !== null && href === currentPath;

  // Chỉ SYSTEM_ADMIN/chủ tenant có "điểm đến chính" khác trang chủ (System
  // Center/Studio) — khách hàng thường thì landingPath rơi về "/", không cần
  // mục riêng vì 3 mục /account/* trong AccountMenu đã đủ.
  let accountDisplayName: string | null = null;
  let accountEmail: string | null = null;
  let accountAvatarUrl: string | null = null;
  let primaryHref: string | null = null;
  let primaryLabel: string | null = null;
  if (currentUser) {
    const [landingPath, account] = await Promise.all([
      resolveLandingPath(currentUser),
      // ADR-041 C7: họ tên + ảnh đại diện (96px) cho AccountMenu.
      getAccountHeaderData(currentUser.userId),
    ]);
    accountDisplayName = account?.fullName || account?.email || "Tài khoản của tôi";
    accountEmail = account?.email ?? null;
    accountAvatarUrl = account?.avatarUrl ?? null;
    if (landingPath === "/admin") {
      primaryHref = "/admin";
      primaryLabel = "Trang quản trị hệ thống";
    } else if (landingPath.startsWith("/studio/")) {
      primaryHref = landingPath;
      primaryLabel = "Quản lý gian hàng";
    }
  }

  const mobileItems: MobileNavItem[] = menu.header.items.map((item) => ({
    id: item.id,
    href: item.href,
    label: item.label,
    newTab: item.newTab,
    external: item.external,
    current: isCurrent(item.href),
    children: item.children.map((child) => ({ id: child.id, href: child.href, label: child.label, newTab: child.newTab, external: child.external, current: isCurrent(child.href) })),
  }));
  // Dưới `sm` nút "Đăng nhập" ở header bị ẩn (chừa chỗ cho CTA) → đưa vào menu mobile cho khách chưa đăng nhập.
  if (!currentUser) mobileItems.push({ id: "login", href: "/login", label: "Đăng nhập" });

  return (
    <header
      className={`site-header ${systemFontVars} sticky top-0 z-20 border-b font-[family-name:var(--font-body)]`}
      style={{ background: PAPER, borderColor: LINE, color: INK }}
    >
      <div className="container-page flex h-[68px] items-center justify-between sm:h-[88px]">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 rounded-lg outline-offset-4 focus-visible:outline-2" style={{ outlineColor: BLUE }}>
          <BrandMark url={logos.logoLightUrl} brandName={brand.name} size={logos.navbarLogoHeightPx} fallbackBg={BLUE} />
          {logos.logoLightUrl ? null : (
            <span className="font-[family-name:var(--font-heading)] text-lg font-bold sm:text-xl">{brand.name}</span>
          )}
        </Link>
        <nav aria-label="Điều hướng chính" className="hidden min-w-0 items-center gap-6 lg:flex xl:gap-10">
          {menu.header.items.map((item) =>
            item.href !== null ? (
              <NavLinkAnchor
                key={item.id}
                link={{ ...item, href: item.href }}
                current={isCurrent(item.href)}
                className={`${NAV_LINK_CLASS} gap-1.5`}
                style={{ color: isCurrent(item.href) ? INK : INK_SOFT, outlineColor: BLUE }}
              />
            ) : (
              // Mục nhóm có menu con 1 cấp (ADR-050): nút mở danh sách khi bấm (client nhỏ, phần còn lại của header vẫn là server).
              <NavDropdown
                key={item.id}
                label={item.label}
                className={NAV_LINK_CLASS}
                items={item.children.map((child) => ({ ...child, current: isCurrent(child.href) }))}
              />
            ),
          )}
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          {accountDisplayName ? (
            <AccountMenu
              displayName={accountDisplayName}
              email={accountEmail}
              avatarUrl={accountAvatarUrl}
              primaryHref={primaryHref}
              primaryLabel={primaryLabel}
            />
          ) : (
            <>
              <Link href="/login" className="hidden min-h-11 items-center rounded-sm text-[15px] font-semibold outline-offset-2 hover:underline focus-visible:outline-2 sm:inline-flex" style={{ outlineColor: BLUE }}>
                Đăng nhập
              </Link>
              {/* Nút cao ~34px trên mobile: pseudo-element nới vùng bấm lên ≥ 44px mà không đổi hình. */}
              {menu.header.cta ? (
                <NavLinkAnchor
                  link={menu.header.cta}
                  className="relative inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-bold whitespace-nowrap outline-offset-2 transition-[filter] before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] hover:brightness-105 focus-visible:outline-2 sm:px-[22px] sm:py-[11px] sm:text-sm sm:before:content-none"
                  style={{ background: AMBER, color: "#241503", outlineColor: BLUE }}
                />
              ) : null}
            </>
          )}
          <MobileNav items={mobileItems} />
        </div>
      </div>
    </header>
  );
}
