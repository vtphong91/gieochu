import { Suspense } from "react";
import type { Metadata } from "next";
import { getEnv } from "@gieochu/config";
import { defaultShopSections, type ShopSection } from "@gieochu/core";
import { getEffectiveBrand } from "../../lib/branding";
import { getCurrentUser } from "../../lib/session";
import {
  getShopCmsSections,
  getShopFeaturedTenants,
  getShopHeroAndCategories,
  getShopHeroStats,
  getShopProductShelves,
  getShopSeo,
  SHOP_PATH,
  shopSearchHref,
  shouldShowOpenStoreCta,
  type ShopHeroAndCategories,
  type ShopHeroStats,
  type ShopProductShelves,
  type ShopFeaturedTenant,
} from "../../lib/shop";
import { CategoryGrid } from "../_ui/category-grid";
import { ProductShelf, ShelfSection, TenantShelf, formatTopRatedCriteria } from "../_ui/product-shelf";
import { ShelfSkeleton } from "../_ui/shelf-skeleton";
import { OpenStoreCta, ShopEmptyState } from "../_ui/shop-cta";
import { ShopHero } from "../_ui/shop-hero";

/**
 * Trang Cửa hàng `/cua-hang` (ADR-035, kế hoạch 2026-10-15 §4.1, §4.6–4.7). Section `visible` của CMS slug `shop`
 * render đúng thứ tự CMS; dữ liệu chia 3 nhóm loader (hero + danh mục / kệ tài liệu / gian hàng) — mỗi nhóm gọi loader
 * MỘT lần, các section cùng nhóm cùng chờ một promise nhưng có `<Suspense>` riêng tại đúng vị trí của mình (thứ tự
 * CMS có thể xen kẽ các nhóm). Section rỗng → component tự trả null.
 */

type SectionOf<T extends ShopSection["type"]> = Extract<ShopSection, { type: T }>;

function findSection<T extends ShopSection["type"]>(sections: readonly ShopSection[], type: T): SectionOf<T> | undefined {
  return sections.find((section): section is SectionOf<T> => section.type === type);
}

function absoluteUrl(path: string): string {
  return `${getEnv().APP_URL.replace(/\/+$/, "")}${path}`;
}

export async function generateMetadata(): Promise<Metadata> {
  const [seo, brand, sections] = await Promise.all([getShopSeo(), getEffectiveBrand(), getShopCmsSections()]);
  const heroSubtitle = findSection(sections, "hero")?.data.subtitle;
  return {
    title: seo.title ?? `${seo.heroTitle ?? "Cửa hàng"} | ${brand.name}`,
    description: seo.description ?? heroSubtitle ?? brand.slogan,
    alternates: { canonical: absoluteUrl(SHOP_PATH) },
  };
}

/** Gọi loader tối đa 1 lần/request dù nhiều nơi cần (hero + kiểm tra trang rỗng cùng dùng số liệu). */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | null = null;
  return () => (promise ??= load());
}

// ───────────────────────── Nhóm (a): hero + danh mục ─────────────────────────

async function HeroBlock({ section, data, stats }: { section: SectionOf<"hero">; data: Promise<ShopHeroAndCategories>; stats: Promise<ShopHeroStats> }) {
  const [{ heroChips, categories }, heroStats] = await Promise.all([data, stats]);
  return <ShopHero data={section.data} categories={categories} chips={heroChips} stats={heroStats} />;
}

async function CategoriesBlock({ section, data, background }: { section: SectionOf<"categories">; data: Promise<ShopHeroAndCategories>; background: Background }) {
  const { categories } = await data;
  return <CategoryGrid title={section.data.title} subtitle={section.data.subtitle} categories={categories} maxVisible={section.data.maxVisible} background={background} />;
}

// ───────────────────────── Nhóm (b): kệ tài liệu ─────────────────────────

type ShelfSectionType = "featured" | "byCategory" | "bestSellers" | "topRated" | "newest";
type Background = "paper" | "alt";

async function ProductShelfBlock({ section, shelves, background }: { section: SectionOf<ShelfSectionType>; shelves: Promise<ShopProductShelves>; background: Background }) {
  const data = await shelves;
  switch (section.type) {
    case "featured":
      return <ProductShelf title={section.data.title} subtitle={section.data.subtitle} products={data.featured} href={shopSearchHref({ sort: "noi-bat" })} background={background} />;
    case "bestSellers":
      return (
        <ProductShelf
          title={section.data.title}
          subtitle={section.data.subtitle}
          products={data.bestSellers}
          href={shopSearchHref({ sort: "ban-chay" })}
          ranked
          background={background}
        />
      );
    case "topRated":
      return (
        <ProductShelf
          title={section.data.title}
          subtitle={section.data.subtitle}
          criteria={formatTopRatedCriteria(section.data.minReviews, section.data.minAvgTenths)}
          products={data.topRated}
          href={shopSearchHref({ sort: "danh-gia-cao" })}
          background={background}
        />
      );
    case "newest":
      return <ProductShelf title={section.data.title} subtitle={section.data.subtitle} products={data.newest} href={shopSearchHref({ sort: "moi-nhat" })} background={background} />;
    case "byCategory": {
      if (data.byCategory.length === 0) return null;
      const cards = section.data.cardsPerBlock;
      return (
        <ShelfSection title={section.data.title} subtitle={section.data.subtitle} background={background}>
          <div className="flex flex-col gap-10 sm:gap-12">
            {data.byCategory.map((shelf) => (
              <ProductShelf
                key={shelf.category.id}
                title={shelf.category.name}
                products={shelf.products}
                href={shelf.href}
                headingLevel="h3"
                desktopLimit={cards}
                mobileLimit={cards}
              />
            ))}
          </div>
        </ShelfSection>
      );
    }
  }
}

/**
 * Trạng thái rỗng toàn trang: mọi kệ tài liệu rỗng **và** hệ thống thật sự chưa có tài liệu Công khai nào (kệ rỗng vì
 * admin tắt hết section kệ thì không tính là "rỗng"). Đặt ngay dưới hero. CTA trong khối rỗng chỉ hiện khi section CTA
 * riêng không hiển thị (tránh hai nút "Mở gian hàng" liền nhau) và người xem chưa là chủ gian hàng.
 */
async function CatalogEmptyGate({ shelves, stats, withCta }: { shelves: Promise<ShopProductShelves>; stats: () => Promise<ShopHeroStats>; withCta: boolean }) {
  const data = await shelves;
  const anyShelf = data.featured.length + data.byCategory.length + data.bestSellers.length + data.topRated.length + data.newest.length > 0;
  if (anyShelf) return null;
  const { productCount } = await stats();
  if (productCount > 0) return null;
  const showCta = withCta && (await shouldShowOpenStoreCta(await getCurrentUser()));
  return <ShopEmptyState cta={showCta ? undefined : null} secondary={{ label: "Về trang chủ", href: "/" }} />;
}

// ───────────────────────── Nhóm (c): gian hàng + CTA ─────────────────────────

async function TenantsBlock({ section, tenants, background }: { section: SectionOf<"featuredTenants">; tenants: Promise<ShopFeaturedTenant[]>; background: Background }) {
  return <TenantShelf title={section.data.title} subtitle={section.data.subtitle} tenants={await tenants} background={background} />;
}

async function CtaBlock({ section }: { section: SectionOf<"ctaOpenStore"> }) {
  const show = await shouldShowOpenStoreCta(await getCurrentUser());
  return show ? <OpenStoreCta data={section.data} /> : null;
}

export default async function ShopPage() {
  const sections = await getShopCmsSections();
  const hero = findSection(sections, "hero");
  const hasCategories = sections.some((s) => s.type === "categories");
  const hasCtaSection = sections.some((s) => s.type === "ctaOpenStore");

  // Select danh mục của hero cần đủ danh mục kể cả khi admin ẩn section "Danh mục" → bổ sung section mặc định cho
  // loader (cùng một truy vấn danh mục, không tốn thêm). Việc render lưới vẫn theo section thật của CMS.
  const heroCategorySections =
    hero && !hasCategories ? [...sections, ...defaultShopSections().filter((s) => s.type === "categories")] : sections;
  // Loader tự trả rỗng, không truy vấn khi section liên quan đều ẩn → gọi thẳng, không cần rẽ nhánh.
  const heroAndCategories = getShopHeroAndCategories(heroCategorySections);
  const stats = once(getShopHeroStats);
  const shelves = getShopProductShelves(sections);
  const tenants = getShopFeaturedTenants(sections);

  const emptyGate = (
    <Suspense key="empty-gate" fallback={null}>
      <CatalogEmptyGate shelves={shelves} stats={stats} withCta={!hasCtaSection} />
    </Suspense>
  );

  // Nền zebra xen kẽ giữa các section nội dung (hero và CTA có nền riêng).
  let contentIndex = 0;
  const nextBackground = (): Background => (contentIndex++ % 2 === 1 ? "alt" : "paper");

  return (
    <>
      {hero ? null : (
        // Hero bị ẩn trong CMS → vẫn giữ một H1 duy nhất cho trang.
        <div className="container-page pt-10 sm:pt-14">
          <h1 className="font-[family-name:var(--font-heading)] text-[30px] leading-tight font-semibold sm:text-[38px]">Cửa hàng tài liệu</h1>
        </div>
      )}
      {hero ? null : emptyGate}

      {sections.map((section) => {
        switch (section.type) {
          case "hero":
            return [
              <Suspense key={section.id} fallback={<ShelfSkeleton variant="hero" label="Cửa hàng" />}>
                <HeroBlock section={section} data={heroAndCategories} stats={stats()} />
              </Suspense>,
              emptyGate,
            ];
          case "categories":
            return (
              <Suspense key={section.id} fallback={<ShelfSkeleton variant="categories" label="danh mục" />}>
                <CategoriesBlock section={section} data={heroAndCategories} background={nextBackground()} />
              </Suspense>
            );
          case "featured":
          case "byCategory":
          case "bestSellers":
          case "topRated":
          case "newest": {
            const background = nextBackground();
            return (
              <Suspense key={section.id} fallback={<ShelfSkeleton variant="products" label={section.data.title} background={background} />}>
                <ProductShelfBlock section={section} shelves={shelves} background={background} />
              </Suspense>
            );
          }
          case "featuredTenants": {
            const background = nextBackground();
            return (
              <Suspense key={section.id} fallback={<ShelfSkeleton variant="tenants" label={section.data.title} background={background} />}>
                <TenantsBlock section={section} tenants={tenants} background={background} />
              </Suspense>
            );
          }
          case "ctaOpenStore":
            return (
              <Suspense key={section.id} fallback={null}>
                <CtaBlock section={section} />
              </Suspense>
            );
          default:
            return null;
        }
      })}
    </>
  );
}
