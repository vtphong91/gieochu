import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import { homeSectionsSchema, type HomeSection } from "@gieochu/core";
import { getEffectiveBrand } from "../lib/branding";
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
  const [brand, sections] = await Promise.all([getEffectiveBrand(), getHomeSections()]);

  return (
    <div className={`${systemFontVars} font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      {/* Header/footer hệ thống dùng chung mọi trang public (ADR-025) — chrome cố định, không thuộc CMS. */}
      <SiteHeader />

      {/* Nội dung — điều khiển qua Landing Page CMS (/admin/cms/home) */}
      {sections
        .filter((s) => s.visible)
        .map((s) => <div key={s.id}>{renderSection(s, brand.name)}</div>)}

      <SiteFooter />
    </div>
  );
}
