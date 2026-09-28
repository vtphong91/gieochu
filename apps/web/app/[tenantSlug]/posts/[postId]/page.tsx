import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveStorefrontAccess } from "@gieochu/core";
import { getPublishedPost, getPublishedPostMeta, postDisplayTitle } from "../../../../lib/post";
import { getCurrentUser } from "../../../../lib/session";
import { findSlugRedirectTarget, findTenantBySlugForStorefront } from "../../../../lib/storefront";
import { SiteFooter } from "../../../_ui/site-footer";
import { SiteHeader } from "../../../_ui/site-header";
import { systemFontVars } from "../../../_ui/system-fonts";
import { formatPostDate, RelatedProductCard } from "../../_ui/post-parts";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const PAPER = brandColors.background;
const NAV_LINK = "inline-flex min-h-11 items-center rounded-full pr-1 font-medium hover:text-[color:var(--color-primary)] hover:underline";

export async function generateMetadata({ params }: { params: Promise<{ tenantSlug: string; postId: string }> }): Promise<Metadata> {
  const { tenantSlug, postId } = await params;
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (!tenant || tenant.status === "LOCKED") return {};
  const post = await getPublishedPostMeta(tenant.id, postId);
  if (!post) return {};
  return { title: `${postDisplayTitle(post)} — ${tenant.name}`, description: post.excerpt || undefined };
}

/**
 * ADR-029 mục 5 + ADR-025 — `/[tenantSlug]/posts/[postId]`: trang HỆ THỐNG (header/footer hệ thống,
 * `container-prose`). Không có / không PUBLISHED / tenant LOCKED → 404. `bodyHtml` đã sanitize lại lúc render.
 * Khung dữ liệu tối thiểu (Hiếu); Phong dựng giao diện (thẻ tài liệu gắn kèm: `post.product`).
 */
export default async function TenantPostDetailPage({ params }: { params: Promise<{ tenantSlug: string; postId: string }> }) {
  const { tenantSlug, postId } = await params;
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (!tenant) {
    const redirectTarget = await findSlugRedirectTarget(tenantSlug);
    if (redirectTarget) redirect(`/${redirectTarget}/posts/${encodeURIComponent(postId)}`);
    notFound();
  }

  const currentUser = await getCurrentUser();
  const viewer = currentUser?.userId === tenant.ownerId ? "owner" : "guest";
  if (resolveStorefrontAccess(tenant.status, viewer) === "NOT_FOUND") notFound();

  const post = await getPublishedPost(tenant.id, postId);
  if (!post) notFound();

  const base = `/${tenant.slug}/posts`;
  // "Cập nhật" chỉ hiện khi bài được sửa sau lần đăng đầu (lệch > 1 phút) và khác ngày hiển thị.
  const updatedDate = post.updatedAt.getTime() - post.publishedAt.getTime() > 60_000 ? formatPostDate(post.updatedAt) : null;
  const publishedDate = formatPostDate(post.publishedAt);

  // ADR-025: trang hệ thống — header/footer, màu + font hệ thống. Khung đọc `container-prose` (768px, ADR-024).
  return (
    <div className={`${systemFontVars} min-h-dvh overflow-x-clip font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--color-primary)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>

      <SiteHeader />

      <main id="noi-dung" tabIndex={-1} className="container-prose pt-4 pb-16 outline-none sm:pt-6 sm:pb-20">
        <nav aria-label="Đường dẫn">
          <ol className="flex flex-wrap items-center gap-x-2 text-sm" style={{ color: INK_SOFT }}>
            <li>
              <Link href={`/${tenant.slug}`} className={NAV_LINK}>
                {tenant.name}
              </Link>
            </li>
            <li aria-hidden="true">/</li>
            <li>
              <Link href={base} className={NAV_LINK}>
                Bài viết
              </Link>
            </li>
          </ol>
        </nav>

        <article className="mt-2 rounded-2xl border bg-white px-5 py-6 sm:px-10 sm:py-10" style={{ borderColor: LINE }}>
          <header>
            {/* Luôn đúng 1 h1: bài không tiêu đề → h1 là tiêu đề hiển thị rút từ đoạn đầu. */}
            <h1
              className={
                post.title
                  ? "font-[family-name:var(--font-heading)] text-2xl leading-tight font-extrabold text-balance [overflow-wrap:anywhere] sm:text-3xl"
                  : "font-[family-name:var(--font-heading)] text-xl leading-snug font-bold [overflow-wrap:anywhere] sm:text-2xl"
              }
            >
              {postDisplayTitle(post)}
            </h1>
            <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm" style={{ color: INK_SOFT }}>
              <span>
                <Link href={`/${tenant.slug}`} className="font-semibold underline-offset-2 hover:underline" style={{ color: INK }}>
                  {tenant.name}
                </Link>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                Đăng ngày <time dateTime={post.publishedAt.toISOString()}>{publishedDate}</time>
              </span>
              {updatedDate && updatedDate !== publishedDate ? (
                <>
                  <span aria-hidden="true">·</span>
                  <span>
                    Cập nhật <time dateTime={post.updatedAt.toISOString()}>{updatedDate}</time>
                  </span>
                </>
              ) : null}
            </p>
          </header>

          {/* HTML đã qua sanitizeRichTextHtml lúc lưu và lại lúc render (getPublishedPost). */}
          <div
            className="gieochu-rich-content mt-6 border-t pt-6 text-base leading-relaxed [overflow-wrap:anywhere]"
            style={{ borderColor: LINE }}
            dangerouslySetInnerHTML={{ __html: post.bodyHtml }}
          />
        </article>

        {post.product ? (
          <div className="mt-6">
            <RelatedProductCard product={post.product} tenantSlug={tenant.slug} headingId="tai-lieu-lien-quan" />
          </div>
        ) : null}

        <nav aria-label="Điều hướng bài viết" className="mt-8 flex flex-col gap-3 border-t pt-6 text-sm sm:flex-row sm:items-center sm:justify-between" style={{ borderColor: LINE }}>
          <Link href={base} className={`${NAV_LINK} font-semibold`} style={{ color: INK }}>
            ← Tất cả bài viết
          </Link>
          <Link href={`/${tenant.slug}`} className={NAV_LINK} style={{ color: INK_SOFT }}>
            Về trang {tenant.name}
          </Link>
        </nav>
      </main>

      <SiteFooter />
    </div>
  );
}
