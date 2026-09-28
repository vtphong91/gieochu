import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { getCurrentUser } from "../../lib/session";
import { resolveLandingPath } from "../../lib/landing-path";
import { AccountMenu } from "./account-menu";
import { BrandMark } from "./brand-mark";
import { systemFontVars } from "./system-fonts";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PAPER = brandColors.background;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const AMBER = brandColors.accent;

/**
 * Header hệ thống dùng chung mọi trang public (ADR-025): trang chủ, storefront tenant,
 * chi tiết tài liệu, checkout. Chrome cố định, không thuộc CMS; tự đọc brand/logo và
 * người dùng hiện tại (branding có cache() theo request — gọi lặp ở trang không tốn thêm truy vấn).
 * Tự gắn font + màu chữ hệ thống nên đặt được trong trang có font/theme riêng.
 * Cao 68px (< sm) / 88px (sm+) — `scroll-padding-top` trong globals.css (.site-header) khớp số này.
 * Nền + border full-bleed ở <header>; nội dung bọc container-page (ADR-024).
 */
export async function SiteHeader() {
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
          <Link href="/pricing" className="text-[15px] font-medium" style={{ color: INK_SOFT }}>
            Bảng giá
          </Link>
          <span className="text-[15px] font-medium" style={{ color: INK_SOFT }}>
            Giáo viên &amp; Coach
          </span>
          <span className="text-[15px] font-medium" style={{ color: INK_SOFT }}>
            Khám phá tài liệu
          </span>
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
        </div>
      </div>
    </header>
  );
}
