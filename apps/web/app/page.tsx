import Link from "next/link";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import { homeSectionsSchema, type HomeSection } from "@gieochu/core";
import { getEffectiveBrand, getEffectiveLogos } from "../lib/branding";
import { getCurrentUser } from "../lib/session";
import { resolveLandingPath } from "../lib/landing-path";
import { BrandMark } from "./_ui/brand-mark";
import { AccountMenu } from "./_ui/account-menu";
import {
  BecomeSellerSection,
  BenefitsSection,
  CoachesSection,
  DocumentsSection,
  FinalCtaSection,
  HeroSection,
  SearchSection,
  StatsSection,
  TestimonialsSection,
} from "./_home-sections";

// Heading: Be Vietnam Pro, Body: Inter — theo
// docs/GIEOCHU_BRAND_IDENTITY_PRODUCT_PROPOSAL_V1.0.md §30.
const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});
const inter = Inter({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-body",
});

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PAPER = brandColors.background;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const BLUE_DEEP = brandColors.primaryDeep;
const AMBER = brandColors.accent;

async function getHomeSections(): Promise<HomeSection[]> {
  const prisma = getPrismaClient();
  const page = await prisma.cmsPage.findUnique({ where: { slug: "home" } });
  if (!page || page.status !== "PUBLISHED") return [];
  const parsed = homeSectionsSchema.safeParse(page.blocks);
  return parsed.success ? parsed.data : [];
}

function renderSection(section: HomeSection, brandName: string) {
  switch (section.type) {
    case "hero":
      return <HeroSection data={section.data} />;
    case "stats":
      return <StatsSection data={section.data} />;
    case "search":
      return <SearchSection data={section.data} />;
    case "benefits":
      return <BenefitsSection data={section.data} />;
    case "coaches":
      return <CoachesSection data={section.data} />;
    case "documents":
      return <DocumentsSection data={section.data} />;
    case "becomeSeller":
      return <BecomeSellerSection data={section.data} />;
    case "testimonials":
      return <TestimonialsSection data={section.data} brandName={brandName} />;
    case "finalCta":
      return <FinalCtaSection data={section.data} />;
    default:
      return null;
  }
}

export default async function HomePage() {
  const [brand, logos, sections, currentUser] = await Promise.all([
    getEffectiveBrand(),
    getEffectiveLogos(),
    getHomeSections(),
    getCurrentUser(),
  ]);
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
    <div className={`${beVietnamPro.variable} ${inter.variable} font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      {/* Header — chrome cố định, không thuộc CMS */}
      <header className="sticky top-0 z-10 flex h-[68px] items-center justify-between border-b px-5 sm:h-[88px] sm:px-10 lg:px-24" style={{ background: PAPER, borderColor: LINE }}>
        <Link href="/" className="flex items-center gap-2.5">
          <BrandMark url={logos.logoLightUrl} brandName={brand.name} size={logos.navbarLogoHeightPx} fallbackBg={BLUE} />
          {logos.logoLightUrl ? null : (
            <span className="font-[family-name:var(--font-heading)] text-lg font-bold sm:text-xl">{brand.name}</span>
          )}
        </Link>
        <nav className="hidden items-center gap-10 lg:flex">
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
              <Link href="/login" className="hidden text-[15px] font-semibold sm:inline">
                Đăng nhập
              </Link>
              <Link href="/register" className="rounded-full px-4 py-2 text-[13px] font-bold sm:px-[22px] sm:py-[11px] sm:text-sm" style={{ background: AMBER, color: "#241503" }}>
                Mở gian hàng miễn phí
              </Link>
            </>
          )}
        </div>
      </header>

      {/* Nội dung — điều khiển qua Landing Page CMS (/admin/cms/home) */}
      {sections
        .filter((s) => s.visible)
        .map((s) => <div key={s.id}>{renderSection(s, brand.name)}</div>)}

      {/* Footer — chrome cố định, không thuộc CMS */}
      <footer className="flex flex-col gap-10 px-5 pt-12 pb-8 sm:px-10 sm:pt-16 lg:gap-12 lg:px-24 lg:pt-[72px] lg:pb-10" style={{ background: BLUE_DEEP }}>
        <div className="flex flex-col gap-8 sm:flex-row sm:justify-between">
          <div className="sm:w-[280px] lg:w-[320px]">
            <div className="mb-3.5 flex items-center gap-2.5">
              <BrandMark url={logos.logoFooterUrl} brandName={brand.name} size={40} rounded={9} fallbackBg="rgba(255,255,255,0.12)" />
              {logos.logoFooterUrl ? null : (
                <span className="font-[family-name:var(--font-heading)] text-lg font-bold text-white">{brand.name}</span>
              )}
            </div>
            <p className="text-sm leading-[1.6] text-white/55">{brand.slogan}</p>
          </div>
          <div className="grid grid-cols-2 gap-8 sm:flex sm:gap-16">
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Khám phá</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Tài liệu</span>
                <span>Giáo viên &amp; Coach</span>
                <Link href="/pricing">Bảng giá</Link>
              </div>
            </div>
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Công ty</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Về {brand.name}</span>
                <span>Liên hệ</span>
                <span>Tuyển dụng</span>
              </div>
            </div>
            <div>
              <div className="mb-4 text-[13px] font-bold text-white sm:text-[13.5px]">Pháp lý</div>
              <div className="flex flex-col gap-3 text-sm text-white/60">
                <span>Điều khoản dịch vụ</span>
                <span>Chính sách bảo mật</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t pt-6 text-xs text-white/45 sm:pt-[26px]" style={{ borderColor: "rgba(255,255,255,0.12)" }}>
          © 2026 {brand.name}. Bảo lưu mọi quyền.
        </div>
      </footer>
    </div>
  );
}
