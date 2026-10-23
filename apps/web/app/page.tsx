import type { Metadata } from "next";
import { brandColors } from "@gieochu/config/theme";
import { getEnv } from "@gieochu/config";
import { DEFAULT_HOME_SEO, replaceBrandToken, resolveCommunityView, type HomeCommunityView, type HomeSection } from "@gieochu/core";
import { getEffectiveBrand } from "../lib/branding";
import { getHomePageContent } from "../lib/home-cms";
import {
  buildHomeStatItems,
  getHomeFeaturedProducts,
  getHomeFeaturedTenants,
  getHomeSearchCategories,
  getHomeStats,
  type HomeFeaturedProduct,
  type HomeFeaturedTenant,
  type HomeSearchCategory,
  type HomeStatItem,
} from "../lib/home";
import { SiteFooter } from "./_ui/site-footer";
import { SiteHeader } from "./_ui/site-header";
import { systemFontVars } from "./_ui/system-fonts";
import {
  BecomeSellerSection,
  BenefitsSection,
  CoachesSection,
  CommunitySection,
  DocumentsSection,
  FaqSection,
  FinalCtaSection,
  HeroSection,
  SearchSection,
  StatsSection,
  StepsSection,
} from "./_home-sections";

const INK = brandColors.ink;
const PAPER = brandColors.background;

/**
 * ADR-050: SEO trang chủ — `seoTitle/seoDescription` của dòng CMS `home` (chỉ khi PUBLISHED, không rỗng), mặc định theo
 * brief trang chủ §4 (token `{brand}`). Canonical + metadataBase dựng từ `APP_URL` (env có sẵn).
 */
export async function generateMetadata(): Promise<Metadata> {
  const [brand, content] = await Promise.all([getEffectiveBrand(), getHomePageContent()]);
  const appUrl = getEnv().APP_URL.replace(/\/+$/, "");
  return {
    metadataBase: new URL(appUrl),
    title: replaceBrandToken(content.seoTitle ?? DEFAULT_HOME_SEO.title, brand.name),
    description: replaceBrandToken(content.seoDescription ?? DEFAULT_HOME_SEO.description, brand.name),
    alternates: { canonical: `${appUrl}/` },
  };
}

/** Section đã kèm dữ liệu thật (ADR-033); `null` = không render (vd số liệu toàn 0, dưới ngưỡng `minToShow`). */
type LoadedHomeSection =
  | { section: Exclude<HomeSection, { type: "stats" | "search" | "coaches" | "documents" | "community" }> }
  | { section: Extract<HomeSection, { type: "stats" }>; stats: HomeStatItem[] }
  | { section: Extract<HomeSection, { type: "search" }>; categories: HomeSearchCategory[] }
  | { section: Extract<HomeSection, { type: "coaches" }>; tenants: HomeFeaturedTenant[] }
  | { section: Extract<HomeSection, { type: "documents" }>; products: HomeFeaturedProduct[] }
  | { section: Extract<HomeSection, { type: "community" }>; community: HomeCommunityView };

async function loadSectionData(section: HomeSection, getStats: () => ReturnType<typeof getHomeStats>, getCategories: () => Promise<HomeSearchCategory[]>): Promise<LoadedHomeSection | null> {
  switch (section.type) {
    case "stats": {
      const stats = buildHomeStatItems(section.data, await getStats());
      return stats.length > 0 ? { section, stats } : null;
    }
    case "search":
      return { section, categories: await getCategories() };
    case "coaches": {
      const tenants = await getHomeFeaturedTenants({ limit: section.data.limit, pinnedIds: section.data.pinnedTenantIds });
      // ADR-050: dưới ngưỡng tối thiểu → ẩn cả section.
      return tenants.length > 0 && tenants.length >= section.data.minToShow ? { section, tenants } : null;
    }
    case "documents": {
      const products = await getHomeFeaturedProducts({ limit: section.data.limit, pinnedIds: section.data.pinnedProductIds });
      return products.length > 0 && products.length >= section.data.minToShow ? { section, products } : null;
    }
    case "community": {
      // ADR-050: chỉ lời chứng thực đã xác nhận đồng ý; không còn gì → lời mời; lời mời trống → không render.
      const community = resolveCommunityView(section.data);
      return community ? { section, community } : null;
    }
    default:
      return { section };
  }
}

/** Gọi loader tối đa 1 lần/request dù CMS có nhiều section cùng loại. */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => (promise ??= load());
}

function renderSection(loaded: LoadedHomeSection, slogan: string, isMainHero: boolean) {
  if ("stats" in loaded) return <StatsSection items={loaded.stats} />;
  if ("categories" in loaded) return <SearchSection data={loaded.section.data} categories={loaded.categories} />;
  if ("tenants" in loaded) return <CoachesSection data={loaded.section.data} tenants={loaded.tenants} />;
  if ("products" in loaded) return <DocumentsSection data={loaded.section.data} products={loaded.products} />;
  if ("community" in loaded) return <CommunitySection data={loaded.section.data} view={loaded.community} />;

  const section = loaded.section;
  switch (section.type) {
    case "hero":
      return <HeroSection data={section.data} slogan={slogan} headingLevel={isMainHero ? "h1" : "h2"} />;
    case "benefits":
      return <BenefitsSection data={section.data} />;
    case "becomeSeller":
      return <BecomeSellerSection data={section.data} />;
    case "steps":
      return <StepsSection data={section.data} />;
    case "faq":
      return <FaqSection data={section.data} />;
    case "finalCta":
      return <FinalCtaSection data={section.data} slogan={slogan} />;
    default:
      return null;
  }
}

export default async function HomePage() {
  const [brand, content] = await Promise.all([getEffectiveBrand(), getHomePageContent()]);
  // ADR-050: chưa có bản PUBLISHED → nội dung mặc định theo brief; `{brand}` thay bằng tên thương hiệu hiệu lực.
  const sections = replaceBrandToken(content.sections, brand.name);
  const getStats = once(getHomeStats);
  const getCategories = once(getHomeSearchCategories);
  const loaded = await Promise.all(sections.filter((s) => s.visible).map((s) => loadSectionData(s, getStats, getCategories)));
  // Một H1 duy nhất: hero đầu tiên mang H1; không có hero hiển thị → H1 ẩn thị giác (tên + slogan thương hiệu) cho
  // trình đọc màn hình/SEO, không gõ cứng chữ.
  const mainHeroId = loaded.find((item) => item?.section.type === "hero")?.section.id ?? null;

  return (
    <div className={`${systemFontVars} font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      {/* Header/footer hệ thống dùng chung mọi trang public (ADR-025) — nội dung menu từ CMS menu (ADR-050). */}
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--brand-primary,#0F3B82)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>
      <SiteHeader />

      {/* Nội dung — điều khiển qua Landing Page CMS (/admin/cms/home); stats/search/coaches/documents lấy dữ liệu thật (ADR-033). */}
      <main id="noi-dung" tabIndex={-1} className="outline-none">
        {mainHeroId ? null : (
          <h1 className="sr-only">
            {brand.name}
            {brand.slogan ? ` — ${brand.slogan}` : ""}
          </h1>
        )}
        {loaded.map((item) => (item ? <div key={item.section.id}>{renderSection(item, brand.slogan, item.section.id === mainHeroId)}</div> : null))}
      </main>

      <SiteFooter />
    </div>
  );
}
