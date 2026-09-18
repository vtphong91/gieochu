import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getPrismaClient } from "@gieochu/db";

interface CmsBlocks {
  hero?: { title: string; subtitle?: string };
  features?: { title: string; description?: string }[];
  faq?: { question: string; answer: string }[];
  richText?: string;
  cta?: { label: string; href: string };
}

async function getPublishedPage(slug: string) {
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

export default async function CmsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = await getPublishedPage(slug);
  if (!page) notFound();

  const blocks = page.blocks as CmsBlocks;

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      {blocks.hero ? (
        <header>
          <h1 className="text-3xl font-bold">{blocks.hero.title}</h1>
          {blocks.hero.subtitle ? <p className="mt-2 text-gray-600">{blocks.hero.subtitle}</p> : null}
        </header>
      ) : (
        <h1 className="text-3xl font-bold">{page.title}</h1>
      )}

      {blocks.features?.length ? (
        <section className="mt-8 space-y-4">
          {blocks.features.map((feature, i) => (
            <div key={i}>
              <h2 className="font-semibold">{feature.title}</h2>
              {feature.description ? <p className="text-sm text-gray-600">{feature.description}</p> : null}
            </div>
          ))}
        </section>
      ) : null}

      {blocks.richText ? (
        <section className="prose mt-8 whitespace-pre-line text-sm text-gray-700">{blocks.richText}</section>
      ) : null}

      {blocks.faq?.length ? (
        <section className="mt-8 space-y-4">
          <h2 className="text-lg font-semibold">Câu hỏi thường gặp</h2>
          {blocks.faq.map((item, i) => (
            <div key={i}>
              <p className="font-medium">{item.question}</p>
              <p className="text-sm text-gray-600">{item.answer}</p>
            </div>
          ))}
        </section>
      ) : null}

      {blocks.cta ? (
        <a
          href={blocks.cta.href}
          className="mt-8 inline-block rounded bg-[var(--color-primary)] px-4 py-2 text-white"
        >
          {blocks.cta.label}
        </a>
      ) : null}
    </main>
  );
}
