import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import { parseHomeSections, type HomeSection } from "@gieochu/core";
import { getEffectiveBrand } from "../lib/branding";
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
  DocumentsSection,
  FinalCtaSection,
  HeroSection,
  SearchSection,
  StatsSection,
  TestimonialsSection,
} from "./_home-sections";

const INK = brandColors.ink;
const PAPER = brandColors.background;

async function getHomeSections(): Promise<HomeSection[]> {
  const prisma = getPrismaClient();
  const page = await prisma.cmsPage.findUnique({ where: { slug: "home" } });
  if (!page || page.status !== "PUBLISHED") return [];
  // ADR-033 mục 6: parse phòng thủ — dữ liệu nhập tay cũ của section chuyển sang dữ liệu thật không làm vỡ trang.
  return parseHomeSections(page.blocks) ?? [];
}

/** Section đã kèm dữ liệu thật (ADR-033); `null` = không render (vd số liệu toàn 0, chưa có tài liệu/giáo viên nào). */
type LoadedHomeSection =
  | { section: Exclude<HomeSection, { type: "stats" | "search" | "coaches" | "documents" }> }
  | { section: Extract<HomeSection, { type: "stats" }>; stats: HomeStatItem[] }
  | { section: Extract<HomeSection, { type: "search" }>; categories: HomeSearchCategory[] }
  | { section: Extract<HomeSection, { type: "coaches" }>; tenants: HomeFeaturedTenant[] }
  | { section: Extract<HomeSection, { type: "documents" }>; products: HomeFeaturedProduct[] };

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
      return tenants.length > 0 ? { section, tenants } : null;
    }
    case "documents": {
      const products = await getHomeFeaturedProducts({ limit: section.data.limit, pinnedIds: section.data.pinnedProductIds });
      return products.length > 0 ? { section, products } : null;
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

function renderSection(loaded: LoadedHomeSection, brandName: string) {
  if ("stats" in loaded) return <StatsSection items={loaded.stats} />;
  if ("categories" in loaded) return <SearchSection data={loaded.section.data} categories={loaded.categories} />;
  if ("tenants" in loaded) return <CoachesSection data={loaded.section.data} tenants={loaded.tenants} />;
  if ("products" in loaded) return <DocumentsSection data={loaded.section.data} products={loaded.products} />;

  const section = loaded.section;
  switch (section.type) {
    case "hero":
      return <HeroSection data={section.data} />;
    case "benefits":
      return <BenefitsSection data={section.data} />;
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
  const [brand, sections] = await Promise.all([getEffectiveBrand(), getHomeSections()]);
  const getStats = once(getHomeStats);
  const getCategories = once(getHomeSearchCategories);
  const loaded = await Promise.all(sections.filter((s) => s.visible).map((s) => loadSectionData(s, getStats, getCategories)));

  return (
    <div className={`${systemFontVars} font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      {/* Header/footer hệ thống dùng chung mọi trang public (ADR-025) — chrome cố định, không thuộc CMS. */}
      <SiteHeader />

      {/* Nội dung — điều khiển qua Landing Page CMS (/admin/cms/home); stats/search/coaches/documents lấy dữ liệu thật (ADR-033). */}
      {loaded.map((item) => (item ? <div key={item.section.id}>{renderSection(item, brand.name)}</div> : null))}

      <SiteFooter />
    </div>
  );
}
