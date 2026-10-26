import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { getPrismaClient } from "@gieochu/db";
import { isSystemCmsSlug } from "@gieochu/core";
import { getEffectiveBrand } from "../../../lib/branding";
import { brandColors } from "@gieochu/config/theme";
import { getActivePlans } from "../../../lib/pricing";
import { renderCmsRichText } from "../../../lib/cms-markdown";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});
const inter = Inter({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

interface CmsBlocks {
  hero?: { title: string; subtitle?: string };
  features?: { title: string; description?: string }[];
  stats?: { value: string; label: string }[];
  testimonials?: { quote: string; name: string; role?: string }[];
  pricingTable?: { source: "plans" };
  faq?: { question: string; answer: string }[];
  richText?: string;
  cta?: { label: string; href: string };
}

async function getPublishedPage(slug: string) {
  // ADR-035 bổ sung: `home`/`shop` lưu dạng section riêng (không phải `CmsBlocks`) — không render ở /p/*.
  if (isSystemCmsSlug(slug)) return null;
  const prisma = getPrismaClient();
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page || page.status !== "PUBLISHED") return null;
  return page;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) return {};
  return { title: page.seoTitle ?? page.title, description: page.seoDescription ?? undefined };
}

function IconCheck({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

export default async function CmsRenderedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  const brand = await getEffectiveBrand();
  const blocks = page.blocks as CmsBlocks;
  const plans = blocks.pricingTable?.source === "plans" ? await getActivePlans() : null;
  const richTextHtml = typeof blocks.richText === "string" ? renderCmsRichText(blocks.richText, brand.name) : "";

  return (
    <div
      className={`${beVietnamPro.variable} ${inter.variable} min-h-dvh font-[family-name:var(--font-body)]`}
      style={{ background: brandColors.background, color: brandColors.ink }}
    >
      {/* Border full-bleed ở <header>; nội dung bọc container-page (ADR-024). */}
      <header className="border-b" style={{ borderColor: brandColors.line }}>
        <div className="container-page flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 items-center justify-center rounded-[9px] text-sm font-bold text-white" style={{ background: brandColors.primary }}>
              G
            </span>
            <span className="font-[family-name:var(--font-heading)] text-base font-semibold">{brand.name}</span>
          </Link>
          <Link href="/login" className="text-sm font-semibold" style={{ color: brandColors.primary }}>
            Đăng nhập
          </Link>
        </div>
      </header>

      <main className="container-prose py-14 sm:py-20">
        {blocks.hero ? (
          <header>
            <h1 className="font-[family-name:var(--font-heading)] text-3xl leading-tight font-semibold sm:text-4xl">
              {blocks.hero.title}
            </h1>
            {blocks.hero.subtitle ? (
              <p className="mt-3 text-base leading-relaxed sm:text-lg" style={{ color: brandColors.inkSoft }}>
                {blocks.hero.subtitle}
              </p>
            ) : null}
          </header>
        ) : (
          <h1 className="font-[family-name:var(--font-heading)] text-3xl font-semibold">{page.title}</h1>
        )}

        {blocks.stats?.length ? (
          <section className="mt-10 grid grid-cols-2 gap-6 rounded-2xl border p-6 sm:grid-cols-4" style={{ borderColor: brandColors.line, background: "white" }}>
            {blocks.stats.map((stat, i) => (
              <div key={i}>
                <div className="font-[family-name:var(--font-heading)] text-2xl font-bold" style={{ color: brandColors.primary }}>
                  {stat.value}
                </div>
                <div className="mt-0.5 text-xs" style={{ color: brandColors.inkSoft }}>
                  {stat.label}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        {blocks.features?.length ? (
          <section className="mt-12 grid gap-5 sm:grid-cols-2">
            {blocks.features.map((feature, i) => (
              <div key={i} className="rounded-2xl border p-5" style={{ borderColor: brandColors.line, background: "white" }}>
                <span
                  className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg"
                  style={{ background: brandColors.surface, color: brandColors.primary }}
                >
                  <IconCheck className="h-4 w-4" />
                </span>
                <h2 className="font-[family-name:var(--font-heading)] font-semibold">{feature.title}</h2>
                {feature.description ? (
                  <p className="mt-1 text-sm" style={{ color: brandColors.inkSoft }}>
                    {feature.description}
                  </p>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {richTextHtml ? (
          // ADR-060: Markdown render ở server → HTML đã sanitize (không HTML thô/script/on*/javascript:), `{brand}` đã thay
          // (lib/cms-markdown.ts). Typography dùng lại lớp của trang pháp lý.
          <section
            className="gieochu-rich-content gieochu-legal-content mt-12"
            style={{ color: brandColors.ink }}
            dangerouslySetInnerHTML={{ __html: richTextHtml }}
          />
        ) : null}

        {plans ? (
          <section className="mt-12">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold">Bảng giá</h2>
            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {plans.map((plan) => (
                <div
                  key={plan.id}
                  className="rounded-2xl border p-5"
                  style={{ borderColor: plan.isFree ? brandColors.primary : brandColors.line, background: "white" }}
                >
                  <h3 className="font-[family-name:var(--font-heading)] font-semibold">{plan.name}</h3>
                  <p className="mt-1.5 text-xl font-bold">
                    {plan.priceVnd === 0 ? "Miễn phí" : `${plan.priceVnd.toLocaleString("vi-VN")}đ`}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {blocks.testimonials?.length ? (
          <section className="mt-12 grid gap-5 sm:grid-cols-2">
            {blocks.testimonials.map((t, i) => (
              <div key={i} className="rounded-2xl p-5" style={{ background: brandColors.surface }}>
                <p className="text-sm leading-relaxed" style={{ color: brandColors.ink }}>
                  &ldquo;{t.quote}&rdquo;
                </p>
                <p className="mt-3 text-xs font-semibold">{t.name}</p>
                {t.role ? (
                  <p className="text-xs" style={{ color: brandColors.inkSoft }}>
                    {t.role}
                  </p>
                ) : null}
              </div>
            ))}
          </section>
        ) : null}

        {blocks.faq?.length ? (
          <section className="mt-12">
            <h2 className="font-[family-name:var(--font-heading)] text-xl font-semibold">Câu hỏi thường gặp</h2>
            <div className="mt-5 space-y-5">
              {blocks.faq.map((item, i) => (
                <div key={i}>
                  <p className="font-medium">{item.question}</p>
                  <p className="mt-1 text-sm" style={{ color: brandColors.inkSoft }}>
                    {item.answer}
                  </p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        {blocks.cta ? (
          <Link
            href={blocks.cta.href}
            className="mt-12 inline-block rounded-full px-7 py-3 text-sm font-bold text-white"
            style={{ background: brandColors.accent }}
          >
            {blocks.cta.label}
          </Link>
        ) : null}
      </main>
    </div>
  );
}
