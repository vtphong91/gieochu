import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { getEnv } from "@gieochu/config";
import { brandColors } from "@gieochu/config/theme";
import { DISPLAY_TIME_ZONE, legalDocumentPath, legalVersionLabel, replaceBrandToken, replaceBrandTokenInHtml, replaceLegalPlaceholders, type LegalDocumentKey } from "@gieochu/core";
import { getEffectiveBrand } from "../../lib/branding";
import { getEffectiveLegalVersion, getLegalDocumentMeta, sanitizeLegalHtml } from "../../lib/legal";
import { IconAlertTriangle, IconArrowUp, IconChevronDown, IconChevronRight, IconEye } from "../admin/_ui/icons";
import { IconArrow } from "./catalog-parts";
import { LegalBackToTop } from "./legal-back-to-top";
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
 *
 * ADR-057: phần trình bày tách thành `LegalDocumentView` (chỉ nhận props) để trang xem trước của admin dùng chung — thêm
 * thanh "Xem trước — chưa công khai" (`preview`), banner "Bản dự thảo" dưới H1 (`isDraftRelease`), khối "Chính sách liên
 * quan" (`relatedDocuments`), nút lên đầu trang (cột TOC từ `lg`, nút nổi dưới `lg`, link cuối bài) và bản in (globals.css).
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

/** Văn bản liên quan ở cuối trang (danh sách do server dựng — chỉ văn bản đang hiệu lực, trừ văn bản hiện tại). */
export interface LegalRelatedDocument {
  href: string;
  title: string;
}

/** Thanh "Xem trước — chưa công khai" (route xem trước SYSTEM_ADMIN, ADR-057 mục 2). */
export interface LegalPreviewInfo {
  /** Trạng thái phiên bản đang xem, vd "Nháp · Chờ rà soát nội dung". */
  statusLabel: string;
  /** Link quay lại trang soạn (tuỳ chọn). */
  backHref?: string;
}

export interface LegalDocumentViewProps {
  title: string;
  version: number;
  /** `null` = chưa xuất bản (chỉ gặp ở trang xem trước). */
  effectiveAt: Date | null;
  /** HTML đã lưu (đã sanitize lúc lưu) — view sanitize lại, thay `{brand}` rồi dựng mục lục. */
  contentHtml: string;
  brandName: string;
  /** ADR-057 mục 3: phiên bản công bố dạng "Bản dự thảo" — banner dưới H1 + dòng meta "Bản dự thảo". */
  isDraftRelease?: boolean;
  /** Khối "Chính sách liên quan" cuối trang — không truyền / rỗng → không hiện. */
  relatedDocuments?: readonly LegalRelatedDocument[];
  /** Có giá trị → trang đang ở chế độ xem trước của admin. */
  preview?: LegalPreviewInfo;
}

function MetaLine({ version, effectiveAt, isDraftRelease }: { version: number; effectiveAt: Date | null; isDraftRelease: boolean }) {
  return (
    <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: INK_SOFT }}>
      <span>Phiên bản {legalVersionLabel(version)}</span>
      {isDraftRelease ? (
        <>
          <span aria-hidden="true">·</span>
          <span className="font-semibold" style={{ color: INK }}>
            Bản dự thảo
          </span>
        </>
      ) : null}
      <span aria-hidden="true">·</span>
      {effectiveAt ? (
        <span>
          {isDraftRelease ? "Công bố ngày" : "Hiệu lực từ"} <time dateTime={effectiveAt.toISOString()}>{formatDate(effectiveAt)}</time>
        </span>
      ) : (
        <span>Chưa xuất bản</span>
      )}
    </p>
  );
}

/** Banner bản dự thảo: chữ + icon + viền (không chỉ dựa vào màu), `role="note"`, vẫn in ra giấy. */
function DraftReleaseBanner() {
  return (
    <div
      role="note"
      aria-label="Bản dự thảo"
      className="legal-draft-banner mt-5 flex gap-3 rounded-2xl border border-l-4 px-4 py-3.5 sm:px-5"
      style={{ background: brandColors.accentSoft, borderColor: brandColors.accent, color: INK }}
    >
      <IconAlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
      <p className="text-[15px] leading-relaxed">
        <strong className="font-semibold">Bản dự thảo — đang hoàn thiện.</strong> Nội dung có thể thay đổi trước khi chính thức áp dụng.
      </p>
    </div>
  );
}

function PreviewBar({ preview }: { preview: LegalPreviewInfo }) {
  return (
    <div role="region" aria-label="Chế độ xem trước" className="legal-preview-bar text-white" style={{ background: brandColors.primaryDeep }}>
      <div className="container-page flex flex-wrap items-center justify-between gap-x-4 gap-y-2 py-2.5 text-sm">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <IconEye className="h-4 w-4 shrink-0" />
          <strong className="font-semibold">Xem trước — chưa công khai</strong>
          <span aria-hidden="true">·</span>
          <span>{preview.statusLabel}</span>
        </p>
        {preview.backHref ? (
          <Link
            href={preview.backHref}
            className="no-print inline-flex min-h-11 items-center rounded-sm font-semibold underline underline-offset-2 outline-offset-2 outline-white focus-visible:outline-2 lg:min-h-0"
          >
            Quay lại trang soạn
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function RelatedDocuments({ items }: { items: readonly LegalRelatedDocument[] }) {
  return (
    <nav aria-labelledby="chinh-sach-lien-quan" className="no-print mt-12 border-t pt-8" style={{ borderColor: LINE }}>
      <h2 id="chinh-sach-lien-quan" className="font-[family-name:var(--font-heading)] text-lg font-semibold">
        Chính sách liên quan
      </h2>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item.href}>
            <Link
              href={item.href}
              className="group flex min-h-14 items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 font-semibold outline-offset-2 transition-colors hover:border-[color:var(--rel-hover)] focus-visible:outline-2 motion-reduce:transition-none"
              style={{ borderColor: LINE, color: INK, outlineColor: BLUE, ["--rel-hover" as string]: BLUE }}
            >
              <span className="[overflow-wrap:anywhere]">{item.title}</span>
              <IconArrow className="h-4 w-4 shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" style={{ color: BLUE }} />
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/**
 * Phần trình bày dùng chung cho trang công khai và trang xem trước (ADR-057) — không đọc DB, chỉ nhận props. Luồng nội dung:
 * sanitize lại → thay `{brand}` (giá trị đã escape) → gắn `id` cho H2 + dựng mục lục. Biến đổi HTML nào cần thêm `class`
 * (vd `[[CẦN XÁC NHẬN…]]` → `<span class="legal-pending">(đang cập nhật)</span>`) phải chạy SAU sanitize (whitelist bỏ
 * `class`), tức là chèn vào luồng này.
 */
export function LegalDocumentView({ title, version, effectiveAt, contentHtml, brandName, isDraftRelease = false, relatedDocuments, preview }: LegalDocumentViewProps) {
  const { html, items: toc } = buildLegalToc(replaceLegalPlaceholders(replaceBrandTokenInHtml(sanitizeLegalHtml(contentHtml), brandName)));
  const hasToc = toc.length >= 2;
  const related = relatedDocuments?.filter((item) => item.href && item.title) ?? [];

  return (
    <div className={`legal-doc ${systemFontVars} flex min-h-dvh flex-col font-[family-name:var(--font-body)]`} style={{ background: brandColors.background, color: INK }}>
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--brand-primary,#0F3B82)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>
      {preview ? <PreviewBar preview={preview} /> : null}
      <SiteHeader />
      <main id="noi-dung" tabIndex={-1} className="grow outline-none">
        <div className="container-page py-8 sm:py-12 lg:py-14">
          <div className={`legal-layout ${hasToc ? "lg:grid lg:grid-cols-[220px_minmax(0,768px)] lg:justify-center lg:gap-14" : "lg:grid lg:grid-cols-[minmax(0,768px)] lg:justify-center"}`}>
            {hasToc ? (
              <aside className="no-print hidden lg:block">
                <nav aria-labelledby="muc-luc" className="sticky top-[112px] max-h-[calc(100dvh-136px)] overflow-y-auto pb-4">
                  <h2 id="muc-luc" className="mb-3 text-xs font-bold tracking-wide uppercase" style={{ color: INK_SOFT }}>
                    Trên trang này
                  </h2>
                  <TocList items={toc} />
                  <a href="#dau-trang" className={`mt-4 ml-3.5 inline-flex items-center gap-1.5 text-sm font-semibold ${SOFT_LINK}`} style={{ color: BLUE, outlineColor: BLUE }}>
                    <IconArrowUp className="h-4 w-4" /> Lên đầu trang
                  </a>
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
                      {title}
                    </span>
                  </li>
                </ol>
              </nav>

              <header className="border-b pb-6 sm:pb-8" style={{ borderColor: LINE }}>
                <h1 id="dau-trang" className="font-[family-name:var(--font-heading)] text-[28px] leading-tight font-semibold text-balance sm:text-4xl">
                  {title}
                </h1>
                {isDraftRelease ? <DraftReleaseBanner /> : null}
                <MetaLine version={version} effectiveAt={effectiveAt} isDraftRelease={isDraftRelease} />
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

              {related.length > 0 ? <RelatedDocuments items={related} /> : null}

              <footer
                className={`no-print flex flex-wrap items-center justify-between gap-3 border-t pt-6 text-sm ${related.length > 0 ? "mt-10" : "mt-12"}`}
                style={{ borderColor: LINE }}
              >
                <p style={{ color: INK_SOFT }}>
                  {title} · Phiên bản {legalVersionLabel(version)}
                  {isDraftRelease ? " · Bản dự thảo" : ""}
                </p>
                <a
                  href="#dau-trang"
                  className={`inline-flex min-h-11 items-center gap-1.5 rounded-full px-3 font-semibold lg:min-h-9 ${SOFT_LINK}`}
                  style={{ color: BLUE, outlineColor: BLUE, background: PAPER_ALT }}
                >
                  <IconArrowUp className="h-4 w-4" /> Lên đầu trang
                </a>
              </footer>
            </article>
          </div>
        </div>
        <LegalBackToTop targetId="dau-trang" />
      </main>
      <SiteFooter />
    </div>
  );
}

export async function LegalDocumentPage({ documentKey }: { documentKey: LegalDocumentKey }) {
  const [loaded, brand] = await Promise.all([loadVersion(documentKey), getEffectiveBrand()]);
  if (!loaded) notFound();
  const { version } = loaded;
  // ADR-057: bản hiển thị có thể là "Bản dự thảo" (banner + dòng meta). Không truyền `relatedDocuments` (nội dung đã có mục "Văn bản liên quan").
  const { isDraftRelease } = version;
  return (
    <LegalDocumentView
      title={version.title}
      version={version.version}
      effectiveAt={version.effectiveAt}
      contentHtml={version.contentHtml}
      brandName={brand.name}
      isDraftRelease={isDraftRelease}
    />
  );
}
