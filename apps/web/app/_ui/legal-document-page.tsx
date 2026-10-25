import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getEnv } from "@gieochu/config";
import { brandColors } from "@gieochu/config/theme";
import { DISPLAY_TIME_ZONE, legalDocumentPath, legalVersionLabel, replaceBrandToken, replaceBrandTokenInHtml, type LegalDocumentKey } from "@gieochu/core";
import { getEffectiveBrand } from "../../lib/branding";
import { getEffectiveLegalVersion, getLegalDocumentMeta, sanitizeLegalHtml } from "../../lib/legal";
import { IconChevronDown, IconChevronRight } from "../admin/_ui/icons";
import { IconArrow } from "./catalog-parts";
import { SiteFooter } from "./site-footer";
import { SiteHeader } from "./site-header";
import { systemFontVars } from "./system-fonts";
import { buildLegalToc, type LegalTocItem } from "./legal-toc";

/**
 * ADR-050 mục 3 + ADR-054 — trang công khai văn bản pháp lý ở URL cấp gốc `/{slug}`: 7 thư mục route mỏng
 * `app/{slug}/page.tsx` cùng dùng component này, mỗi route truyền đúng một khoá (route tĩnh thắng `app/[tenantSlug]`).
 * `/phap-ly/{slug}` cũ redirect 308 (`app/phap-ly/[slug]/route.ts`). Render bản đang hiệu
 * lực (PUBLISHED, `effectiveAt <= now` mới nhất); chưa có → 404. Nội dung sanitize lại khi render, SAU đó mới thay
 * `{brand}` (giá trị thay vào đã escape — `replaceBrandTokenInHtml`), rồi gắn `id` cho H2 để dựng mục lục (`buildLegalToc`).
 *
 * Giao diện đọc dài (GĐ2): skip-link → `<main id="noi-dung">`; breadcrumb; H1 + dòng "Phiên bản · Hiệu lực từ" (`<time>`,
 * giờ VN); mục lục từ H2 — `lg+` cột trái 220px dính dưới header (`top-[112px]`), dưới `lg` là `<details>` đóng sẵn ngay
 * dưới dòng meta. Độ rộng: `container-page` + lưới `220px | minmax(0,768px)` căn giữa (cột đọc = độ rộng `container-prose`,
 * ADR-024 — không thêm utility mới); không đủ 2 mục → bỏ TOC, cột đọc căn giữa. Chữ đọc 16/17px, dòng 1.75 (`.gieochu-legal-content`).
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const PAPER_ALT = brandColors.backgroundAlt;

/** Vòng focus + vùng bấm cho link phụ (breadcrumb, TOC, "Lên đầu trang"). */
const SOFT_LINK = "rounded-sm outline-offset-2 hover:underline focus-visible:outline-2";

const loadVersion = cache(async (key: LegalDocumentKey) => {
  const version = await getEffectiveLegalVersion(key);
  return version ? { key, version } : null;
});

function formatDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, day: "2-digit", month: "2-digit", year: "numeric" });
}

/**
 * ADR-054 mục 3: title = `seoTitle` (token `{brand}`) hoặc "{tiêu đề} | {brand}"; description = `seoDescription` hoặc
 * `summary` (token `{brand}`), không có cả hai → không đặt; canonical = URL cấp gốc. Chưa có bản hiệu lực → noindex.
 */
export async function legalDocumentMetadata(key: LegalDocumentKey): Promise<Metadata> {
  const [loaded, brand] = await Promise.all([loadVersion(key), getEffectiveBrand()]);
  if (!loaded) return { title: brand.name, robots: { index: false, follow: false } };
  const meta = await getLegalDocumentMeta(key);
  const seoTitle = meta?.seoTitle?.trim();
  const description = meta?.seoDescription?.trim() || meta?.summary?.trim() || null;
  return {
    title: seoTitle ? replaceBrandToken(seoTitle, brand.name) : `${loaded.version.title} | ${brand.name}`,
    ...(description ? { description: replaceBrandToken(description, brand.name) } : {}),
    alternates: { canonical: `${getEnv().APP_URL.replace(/\/+$/, "")}${legalDocumentPath(key)}` },
  };
}

function TocList({ items }: { items: LegalTocItem[] }) {
  return (
    <ol className="space-y-0.5 border-l text-sm" style={{ borderColor: LINE }}>
      {items.map((item) => (
        <li key={item.id}>
          <a
            href={`#${item.id}`}
            className={`-ml-px flex min-h-11 items-center border-l-2 border-transparent py-1.5 pr-2 pl-3.5 leading-snug transition-colors hover:border-[color:var(--toc-hover)] lg:min-h-0 ${SOFT_LINK}`}
            style={{ color: INK_SOFT, outlineColor: BLUE, ["--toc-hover" as string]: BLUE }}
          >
            <span className="[overflow-wrap:anywhere]">{item.text}</span>
          </a>
        </li>
      ))}
    </ol>
  );
}

export async function LegalDocumentPage({ documentKey }: { documentKey: LegalDocumentKey }) {
  const [loaded, brand] = await Promise.all([loadVersion(documentKey), getEffectiveBrand()]);
  if (!loaded) notFound();
  const { version } = loaded;
  const { html, items: toc } = buildLegalToc(replaceBrandTokenInHtml(sanitizeLegalHtml(version.contentHtml), brand.name));
  const hasToc = toc.length >= 2;

  return (
    <div className={`legal-doc ${systemFontVars} flex min-h-dvh flex-col font-[family-name:var(--font-body)]`} style={{ background: brandColors.background, color: INK }}>
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--brand-primary,#0F3B82)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>
      <SiteHeader />
      <main id="noi-dung" tabIndex={-1} className="grow outline-none">
        <div className="container-page py-8 sm:py-12 lg:py-14">
          <div className={hasToc ? "lg:grid lg:grid-cols-[220px_minmax(0,768px)] lg:justify-center lg:gap-14" : "lg:grid lg:grid-cols-[minmax(0,768px)] lg:justify-center"}>
            {hasToc ? (
              <aside className="no-print hidden lg:block">
                <nav aria-labelledby="muc-luc" className="sticky top-[112px] max-h-[calc(100dvh-136px)] overflow-y-auto pb-4">
                  <h2 id="muc-luc" className="mb-3 text-xs font-bold tracking-wide uppercase" style={{ color: INK_SOFT }}>
                    Trên trang này
                  </h2>
                  <TocList items={toc} />
                </nav>
              </aside>
            ) : null}

            <article className="min-w-0" aria-labelledby="dau-trang">
              <nav aria-label="Đường dẫn" className="no-print mb-6 text-sm">
                <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1" style={{ color: INK_SOFT }}>
                  <li className="flex items-center gap-1.5">
                    <Link href="/" className={`inline-flex min-h-11 items-center lg:min-h-0 ${SOFT_LINK}`} style={{ outlineColor: BLUE }}>
                      Trang chủ
                    </Link>
                    <IconChevronRight className="h-3.5 w-3.5 shrink-0" />
                  </li>
                  <li>
                    <span aria-current="page" className="font-semibold" style={{ color: INK }}>
                      {version.title}
                    </span>
                  </li>
                </ol>
              </nav>

              <header className="border-b pb-6 sm:pb-8" style={{ borderColor: LINE }}>
                <h1 id="dau-trang" className="font-[family-name:var(--font-heading)] text-[28px] leading-tight font-semibold text-balance sm:text-4xl">
                  {version.title}
                </h1>
                <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: INK_SOFT }}>
                  <span>Phiên bản {legalVersionLabel(version.version)}</span>
                  <span aria-hidden="true">·</span>
                  <span>
                    Hiệu lực từ <time dateTime={version.effectiveAt.toISOString()}>{formatDate(version.effectiveAt)}</time>
                  </span>
                </p>
              </header>

              {hasToc ? (
                <details className="group no-print mt-6 rounded-2xl border bg-white lg:hidden" style={{ borderColor: LINE }}>
                  <summary
                    className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-4 py-3 text-[15px] font-semibold outline-offset-2 focus-visible:outline-2 [&::-webkit-details-marker]:hidden"
                    style={{ outlineColor: BLUE }}
                  >
                    <span id="muc-luc-mobile">Mục lục ({toc.length} mục)</span>
                    <IconChevronDown className="h-5 w-5 shrink-0 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                  </summary>
                  <nav aria-labelledby="muc-luc-mobile" className="px-4 pb-4">
                    <TocList items={toc} />
                  </nav>
                </details>
              ) : null}

              {/* Nội dung đã sanitize (whitelist Tiptap, không ảnh) — không có HTML thô từ DB; chỉ thêm `id` [a-z0-9-] cho H2. */}
              <div className="gieochu-rich-content gieochu-legal-content mt-8" dangerouslySetInnerHTML={{ __html: html }} />

              <footer className="no-print mt-12 flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm" style={{ borderColor: LINE }}>
                <p style={{ color: INK_SOFT }}>
                  {version.title} · Phiên bản {legalVersionLabel(version.version)}
                </p>
                <a
                  href="#dau-trang"
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-semibold lg:min-h-9 ${SOFT_LINK}`}
                  style={{ color: BLUE, outlineColor: BLUE, background: PAPER_ALT }}
                >
                  <IconArrow className="h-4 w-4 -rotate-90" /> Lên đầu trang
                </a>
              </footer>
            </article>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
