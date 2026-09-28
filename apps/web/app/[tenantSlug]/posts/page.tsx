import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveStorefrontAccess } from "@gieochu/core";
import { isValidPostId, listPublishedPosts } from "../../../lib/post";
import { getCurrentUser } from "../../../lib/session";
import { findSlugRedirectTarget, findTenantBySlugForStorefront } from "../../../lib/storefront";
import { SiteFooter } from "../../_ui/site-footer";
import { SiteHeader } from "../../_ui/site-header";
import { systemFontVars } from "../../_ui/system-fonts";
import { EmptyState } from "../../admin/_ui/kit";
import { IconNewspaper } from "../../admin/_ui/icons";
import { PostSummaryCard } from "../_ui/post-parts";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const PAPER = brandColors.background;
const PAGER_LINK =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-full border bg-white px-5 text-sm font-semibold transition hover:border-[color:var(--color-primary)] hover:text-[color:var(--color-primary)] motion-reduce:transition-none";

async function resolveTenant(tenantSlug: string) {
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (tenant) return tenant;
  const redirectTarget = await findSlugRedirectTarget(tenantSlug);
  if (redirectTarget) redirect(`/${redirectTarget}/posts`);
  return null;
}

export async function generateMetadata({ params }: { params: Promise<{ tenantSlug: string }> }): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (!tenant || tenant.status === "LOCKED") return {};
  return { title: `Bài viết của ${tenant.name}` };
}

/**
 * ADR-029 mục 5 + ADR-025 — `/[tenantSlug]/posts`: trang HỆ THỐNG (header/footer hệ thống), danh sách bài PUBLISHED
 * (bài ghim đầu trang 1, 12 bài/trang, `?cursor=`). Truy cập theo `resolveStorefrontAccess` như storefront; RLS
 * public ẩn bài của tenant LOCKED. Khung dữ liệu tối thiểu (Hiếu); Phong dựng giao diện (`container-page`).
 */
export default async function TenantPostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ cursor?: string | string[] }>;
}) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) notFound();

  const currentUser = await getCurrentUser();
  const viewer = currentUser?.userId === tenant.ownerId ? "owner" : "guest";
  if (resolveStorefrontAccess(tenant.status, viewer) === "NOT_FOUND") notFound();

  const { cursor: rawCursor } = await searchParams;
  const cursor = typeof rawCursor === "string" && isValidPostId(rawCursor) ? rawCursor : null;
  const page = await listPublishedPosts(tenant.id, cursor);
  const base = `/${tenant.slug}/posts`;

  // ADR-025: trang hệ thống — header/footer, màu + font hệ thống; nội dung trong `container-page` (ADR-024).
  return (
    <div className={`${systemFontVars} min-h-dvh overflow-x-clip font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--color-primary)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>

      <SiteHeader />

      <main id="noi-dung" tabIndex={-1} className="container-page pt-4 pb-16 outline-none sm:pt-6 sm:pb-20">
        <nav aria-label="Đường dẫn">
          <ol className="flex flex-wrap items-center gap-x-1 text-sm" style={{ color: INK_SOFT }}>
            <li>
              <Link href={`/${tenant.slug}`} className="inline-flex min-h-11 items-center rounded-full pr-1 font-medium hover:text-[color:var(--color-primary)] hover:underline">
                <span aria-hidden="true">←&nbsp;</span>
                {tenant.name}
              </Link>
            </li>
          </ol>
        </nav>

        <header className="mt-2 max-w-3xl">
          <h1 className="font-[family-name:var(--font-heading)] text-3xl leading-tight font-extrabold text-balance [overflow-wrap:anywhere] sm:text-4xl">
            Bài viết của {tenant.name}
          </h1>
          {cursor ? (
            <p className="mt-2 text-[15px]" style={{ color: INK_SOFT }}>
              Đang xem các bài cũ hơn.
            </p>
          ) : null}
        </header>

        <div className="mt-8">
          {page.items.length === 0 ? (
            <EmptyState
              icon={<IconNewspaper className="h-6 w-6" />}
              title={cursor ? "Không còn bài nào" : "Chưa có bài viết nào"}
              description={cursor ? "Bạn đã xem hết các bài viết." : `${tenant.name} chưa đăng bài viết nào. Hãy quay lại sau nhé.`}
              action={
                <Link href={cursor ? base : `/${tenant.slug}`} className={PAGER_LINK} style={{ borderColor: LINE, color: INK }}>
                  {cursor ? "Về bài mới nhất" : `Về trang ${tenant.name}`}
                </Link>
              }
            />
          ) : (
            <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" aria-label="Danh sách bài viết">
              {page.items.map((post) => (
                <li key={post.id}>
                  <PostSummaryCard post={post} tenantSlug={tenant.slug} />
                </li>
              ))}
            </ul>
          )}
        </div>

        {page.items.length > 0 && (cursor || page.nextCursor) ? (
          <nav className="mt-10 flex flex-wrap items-center justify-center gap-3" aria-label="Phân trang bài viết">
            {cursor ? (
              <Link href={base} className={PAGER_LINK} style={{ borderColor: LINE, color: INK }}>
                ← Bài mới nhất
              </Link>
            ) : null}
            {page.nextCursor ? (
              <Link href={`${base}?cursor=${page.nextCursor}`} className={PAGER_LINK} style={{ borderColor: LINE, color: INK }}>
                Xem bài cũ hơn →
              </Link>
            ) : (
              <span className="text-sm" style={{ color: INK_SOFT }}>
                Đã hết bài viết.
              </span>
            )}
          </nav>
        ) : null}
      </main>

      <SiteFooter />
    </div>
  );
}
