import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveStorefrontAccess, type StorefrontSection } from "@gieochu/core";
import { getEffectiveBrandColors } from "../../lib/branding";
import { getStorefrontPosts } from "../../lib/post";
import { getStorefrontReviews } from "../../lib/review";
import { getCurrentUser } from "../../lib/session";
import {
  findSlugRedirectTarget,
  findTenantBySlugForStorefront,
  getStorefrontProfile,
  getStorefrontSectionProducts,
  resolveStorefrontSections,
} from "../../lib/storefront";
import { SiteFooter } from "../_ui/site-footer";
import { SiteHeader } from "../_ui/site-header";
import { systemFontVars } from "../_ui/system-fonts";
import { ContactSection } from "./_ui/contact";
import { bodyFont, headingFont } from "./_ui/fonts";
import { StorefrontHero } from "./_ui/hero";
import { socialEntries } from "./_ui/icons";
import { StorefrontDemoBanner, StorefrontNotice } from "./_ui/notice";
import { SECTION_ANCHORS } from "./_ui/primitives";
import { ProductsSection } from "./_ui/products";
import { ServicesSection } from "./_ui/services";
import { PostsSection } from "./_ui/storefront-posts";
import { ReviewsSection } from "./_ui/storefront-reviews";
import { TestimonialsSection } from "./_ui/testimonials";
import { buildStorefrontStyle } from "./_ui/theme";

async function resolveTenant(tenantSlug: string) {
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (tenant) return tenant;

  const redirectTarget = await findSlugRedirectTarget(tenantSlug);
  if (redirectTarget) redirect(`/${redirectTarget}`);

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return {};
  return { title: tenant.name, description: tenant.bio ?? undefined };
}

export default async function StorefrontPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) notFound();

  const currentUser = await getCurrentUser();
  const isOwner = currentUser?.userId === tenant.ownerId;
  const viewer = isOwner ? "owner" : "guest";
  const decision = resolveStorefrontAccess(tenant.status, viewer);

  if (decision === "NOT_FOUND") notFound();

  // ADR-023: chỉ section đang bật, đúng thứ tự tenant sắp; khách không thấy đánh giá demo.
  const { sections, isDemo } = resolveStorefrontSections(tenant, { isOwner });
  const productsSection = sections.find((s): s is Extract<StorefrontSection, { type: "products" }> => s.type === "products");
  const reviewsSection = sections.find((s): s is Extract<StorefrontSection, { type: "reviews" }> => s.type === "reviews");
  const postsSection = sections.find((s): s is Extract<StorefrontSection, { type: "posts" }> => s.type === "posts");

  const [products, reviews, posts, profile, systemColors] = await Promise.all([
    productsSection
      ? getStorefrontSectionProducts(tenant.id, {
          limit: productsSection.data.limit,
          featuredProductIds: productsSection.data.featuredProductIds,
        })
      : Promise.resolve([]),
    // ADR-029: đánh giá thật (VISIBLE, sản phẩm PUBLISHED); rỗng → section không render.
    reviewsSection ? getStorefrontReviews(tenant.id, reviewsSection.data) : Promise.resolve([]),
    // ADR-029 mục 5 (M10b): bài PUBLISHED thật; rỗng → section không render.
    postsSection ? getStorefrontPosts(tenant.id, postsSection.data) : Promise.resolve([]),
    getStorefrontProfile(tenant),
    getEffectiveBrandColors(),
  ]);

  // Màu tenant (null → bảng màu hệ thống); cặp chữ/nền tính tương phản trong buildStorefrontStyle.
  const themeStyle = buildStorefrontStyle({
    primary: profile.primaryColor ?? systemColors.primary,
    accent: profile.accentColor ?? systemColors.accent,
  });
  const links = socialEntries(profile.socialLinks);
  const primarySocialHref = links[0]?.href ?? null;
  const hasHero = sections.some((s) => s.type === "hero");

  const tenantName = tenant.name;
  const slug = tenant.slug;

  function renderSection(section: StorefrontSection) {
    const anchorId = SECTION_ANCHORS[section.type].id;
    switch (section.type) {
      case "hero":
        return (
          <StorefrontHero
            key={section.id}
            anchorId={anchorId}
            data={section.data}
            name={tenantName}
            imageUrl={section.data.imageUrl ?? profile.coverUrl}
            logoUrl={profile.logoUrl}
          />
        );
      case "services":
        return <ServicesSection key={section.id} anchorId={anchorId} data={section.data} />;
      case "products":
        // Chưa có trang danh sách tài liệu riêng → không truyền viewAllHref (ẩn nút "Xem tất cả").
        return <ProductsSection key={section.id} anchorId={anchorId} data={section.data} tenantSlug={slug} products={products} />;
      case "testimonials":
        return <TestimonialsSection key={section.id} anchorId={anchorId} data={section.data} />;
      case "reviews":
        return <ReviewsSection key={section.id} anchorId={anchorId} data={section.data} items={reviews} tenantSlug={slug} />;
      case "posts":
        // ADR-029 mục 5 (M10b): bài PUBLISHED thật; rỗng → PostsSection không render.
        return <PostsSection key={section.id} anchorId={anchorId} data={section.data} posts={posts} tenantSlug={slug} />;
      case "contact":
        return (
          <ContactSection
            key={section.id}
            anchorId={anchorId}
            data={section.data}
            tenantSlug={slug}
            tenantName={tenantName}
            fallbackHref={primarySocialHref}
            socialLinks={links}
          />
        );
    }
  }

  // ADR-025: header/footer là của hệ thống (font + màu hệ thống); tenant chỉ sở hữu vùng nội dung
  // `<main class="sf-root">` — theme `--sf-*` và font heading storefront chỉ áp trong phạm vi đó.
  return (
    <div className={`${systemFontVars} min-h-dvh overflow-x-clip bg-white font-[family-name:var(--font-body)]`}>
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--color-primary)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>

      <SiteHeader />

      {decision === "READ_ONLY" || decision === "LOCKED_NOTICE" ? <StorefrontNotice kind={decision} /> : null}
      {isDemo && isOwner ? <StorefrontDemoBanner studioHref={`/studio/${tenant.slug}/storefront`} /> : null}

      <main
        id="noi-dung"
        tabIndex={-1}
        className={`sf-root ${headingFont.variable} ${bodyFont.variable} font-[family-name:var(--font-body)] text-[color:var(--sf-ink)] outline-none`}
        style={themeStyle}
      >
        {/* Luôn có đúng 1 h1: tắt section hero → h1 ẩn trực quan mang tên trang. */}
        {hasHero ? null : <h1 className="sr-only">{tenant.name}</h1>}
        {sections.map(renderSection)}
      </main>

      <SiteFooter />
    </div>
  );
}
