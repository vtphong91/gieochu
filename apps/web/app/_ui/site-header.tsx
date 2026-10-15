import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { getCurrentUser } from "../../lib/session";
import { resolveLandingPath } from "../../lib/landing-path";
import { AccountMenu } from "./account-menu";
import { BrandMark } from "./brand-mark";
import { MobileNav, type MobileNavItem } from "./mobile-nav";
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

/** Mục điều hướng có trang thật (dùng cho menu mobile; nav ngang ≥ lg giữ thêm mục "Giáo viên & Coach" chưa có trang). */
export type SiteNavKey = "shop" | "pricing";

const NAV_LINKS: { key: SiteNavKey; href: string; label: string }[] = [
  { key: "shop", href: "/cua-hang", label: "Cửa hàng" },
  { key: "pricing", href: "/pricing", label: "Bảng giá" },
];

/**
 * Header hệ thống dùng chung mọi trang public (ADR-025): trang chủ, storefront tenant,
 * chi tiết tài liệu, checkout. Chrome cố định, không thuộc CMS; tự đọc brand/logo và
 * người dùng hiện tại (branding có cache() theo request — gọi lặp ở trang không tốn thêm truy vấn).
 * Tự gắn font + màu chữ hệ thống nên đặt được trong trang có font/theme riêng.
 * Cao 68px (< sm) / 88px (sm+) — `scroll-padding-top` trong globals.css (.site-header) khớp số này.
 * Nền + border full-bleed ở <header>; nội dung bọc container-page (ADR-024).
 * `current`: mục điều hướng ứng với trang đang xem (trang tự truyền — header là Server Component, không biết pathname)
 * → `aria-current="page"` + chữ đậm/gạch chân. Dưới `lg` nav ngang ẩn, thay bằng `MobileNav` (nút menu).
 */
export async function SiteHeader({ current }: { current?: SiteNavKey } = {}) {
  const [brand, logos, currentUser] = await Promise.all([getEffectiveBrand(), getEffectiveLogos(), getCurrentUser()]);

  // Chỉ SYSTEM_ADMIN/chủ tenant có "điểm đến chính" khác trang chủ (System
  // Center/Studio) — khách hàng thường thì landingPath rơi về "/", không cần
  // mục riêng vì 3 mục /account/* trong AccountMenu đã đủ.
  let accountDisplayName: string | null = null;
  let primaryHref: string | null = null;
  let primaryLabel: string | null = null;
  if (currentUser) {
    const [landingPath, account] = await Promise.all([
      resolveLandingPath(currentUser),
      getPrismaClient().user.findUnique({
        where: { id: currentUser.userId },
        select: { email: true, profile: { select: { fullName: true } } },
      }),
    ]);
    accountDisplayName = account?.profile?.fullName || account?.email || "Tài khoản của tôi";
    if (landingPath === "/admin") {
      primaryHref = "/admin";
      primaryLabel = "Trang quản trị hệ thống";
    } else if (landingPath.startsWith("/studio/")) {
      primaryHref = landingPath;
      primaryLabel = "Quản lý gian hàng";
    }
  }

  const mobileItems: MobileNavItem[] = NAV_LINKS.map((link) => ({ href: link.href, label: link.label, current: current === link.key }));
  // Dưới `sm` nút "Đăng nhập" ở header bị ẩn (chừa chỗ cho CTA) → đưa vào menu mobile cho khách chưa đăng nhập.
  if (!currentUser) mobileItems.push({ href: "/login", label: "Đăng nhập" });

  return (
    <header
      className={`site-header ${systemFontVars} sticky top-0 z-20 border-b font-[family-name:var(--font-body)]`}
      style={{ background: PAPER, borderColor: LINE, color: INK }}
    >
      <div className="container-page flex h-[68px] items-center justify-between sm:h-[88px]">
        <Link href="/" className="flex min-h-11 items-center gap-2.5">
          <BrandMark url={logos.logoLightUrl} brandName={brand.name} size={logos.navbarLogoHeightPx} fallbackBg={BLUE} />
          {logos.logoLightUrl ? null : (
            <span className="font-[family-name:var(--font-heading)] text-lg font-bold sm:text-xl">{brand.name}</span>
          )}
        </Link>
        <nav aria-label="Điều hướng chính" className="hidden items-center gap-10 lg:flex">
          <Link
            href="/pricing"
            aria-current={current === "pricing" ? "page" : undefined}
            className={NAV_LINK_CLASS}
            style={{ color: current === "pricing" ? INK : INK_SOFT, outlineColor: BLUE }}
          >
            Bảng giá
          </Link>
          <span className="text-[15px] font-medium" style={{ color: INK_SOFT }}>
            Giáo viên &amp; Coach
          </span>
          <Link
            href="/cua-hang"
            aria-current={current === "shop" ? "page" : undefined}
            className={NAV_LINK_CLASS}
            style={{ color: current === "shop" ? INK : INK_SOFT, outlineColor: BLUE }}
          >
            Cửa hàng
          </Link>
        </nav>
        <div className="flex items-center gap-3 sm:gap-5">
          {accountDisplayName ? (
            <AccountMenu displayName={accountDisplayName} primaryHref={primaryHref} primaryLabel={primaryLabel} />
          ) : (
            <>
              <Link href="/login" className="hidden min-h-11 items-center text-[15px] font-semibold sm:inline-flex">
                Đăng nhập
              </Link>
              {/* Nút cao ~34px trên mobile: pseudo-element nới vùng bấm lên ≥ 44px mà không đổi hình. */}
              <Link
                href="/register"
                className="relative rounded-full px-4 py-2 text-[13px] font-bold before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] sm:px-[22px] sm:py-[11px] sm:text-sm sm:before:content-none"
                style={{ background: AMBER, color: "#241503" }}
              >
                Mở gian hàng miễn phí
              </Link>
            </>
          )}
          <MobileNav items={mobileItems} />
        </div>
      </div>
    </header>
  );
}
