import type { CSSProperties } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { productPath } from "@gieochu/core/product-path";
import { postDisplayTitle, type PublicPostProduct, type PublicPostSummary } from "../../../lib/post";
import { IconDoc, IconNewspaper, IconPin } from "../../admin/_ui/icons";

/*
 * ADR-029 mục 5 (M10b) + ADR-025 — mảnh giao diện bài viết cho TRANG HỆ THỐNG `/[tenantSlug]/posts` và
 * `/[tenantSlug]/posts/[postId]`: màu + font hệ thống (brandColors / --font-heading), không mang theme tenant.
 * Section "Bài viết" trên storefront (theme `--sf-*`) ở `storefront-posts.tsx`, dùng chung helper chữ ở đây.
 * CHỈ dùng trong Server Component (import `lib/post`).
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const SURFACE = brandColors.surface;
const ACCENT_SOFT = brandColors.accentSoft;

const DATE_ONLY = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric" });
const vnd = new Intl.NumberFormat("vi-VN");

/** Ngày theo giờ Việt Nam, ví dụ "28/09/2026". */
export function formatPostDate(value: Date | string): string {
  return DATE_ONLY.format(new Date(value));
}

export function formatVnd(amount: number): string {
  return `${vnd.format(amount)} ₫`;
}

/**
 * Chữ hiển thị của 1 thẻ bài: có tiêu đề → tiêu đề là heading + trích đoạn bên dưới; không tiêu đề (bài ngắn kiểu cập
 * nhật nhanh) → chính trích đoạn là nội dung chính của thẻ (heading), không lặp lại đoạn đầu 2 lần.
 */
export function postCardText(post: Pick<PublicPostSummary, "title" | "excerpt">): { heading: string; excerpt: string | null; untitled: boolean } {
  if (post.title) return { heading: post.title, excerpt: post.excerpt || null, untitled: false };
  return { heading: post.excerpt || postDisplayTitle(post), excerpt: null, untitled: true };
}

/** Nhãn "Đã ghim" — icon + chữ (không chỉ dựa màu). */
export function PinnedLabel({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold ${className ?? ""}`} style={style}>
      <IconPin className="h-3.5 w-3.5" />
      Đã ghim
    </span>
  );
}

/**
 * Thẻ bài trên trang hệ thống `/[tenantSlug]/posts`. Cả thẻ bấm được (stretched link trong heading → tên truy cập chỉ
 * là tiêu đề); dòng tài liệu gắn kèm là link riêng nằm trên lớp stretched (z-10). Ảnh đầu bài (đã tối ưu 640px) hoặc
 * khối minh hoạ nhạt để lưới đều nhau.
 */
export function PostSummaryCard({ post, tenantSlug, headingLevel = 2 }: { post: PublicPostSummary; tenantSlug: string; headingLevel?: 2 | 3 }) {
  const { heading, excerpt, untitled } = postCardText(post);
  const Heading = headingLevel === 2 ? "h2" : "h3";
  const href = `/${tenantSlug}/posts/${post.id}`;
  return (
    <article className="group relative flex h-full flex-col overflow-hidden rounded-2xl border bg-white shadow-[0_8px_28px_-18px_rgba(15,23,42,0.35)] transition-shadow duration-200 hover:shadow-[0_14px_34px_-16px_rgba(15,23,42,0.4)] has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-3 has-[a:focus-visible]:outline-[color:var(--color-primary)] motion-reduce:transition-none" style={{ borderColor: LINE }}>
      <div className="relative aspect-[16/9] overflow-hidden" style={{ background: SURFACE }}>
        {post.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary hệ thống, URL đã tối ưu 640px ở server
          <img src={post.imageUrl} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.03]" />
        ) : (
          <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${SURFACE} 0%, ${ACCENT_SOFT} 100%)`, color: BLUE }}>
            <IconNewspaper className="h-10 w-10 opacity-50" />
          </div>
        )}
        {post.isPinned ? <PinnedLabel className="absolute top-3 left-3 shadow-sm" style={{ background: "#FFFFFF", color: BLUE }} /> : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs font-medium" style={{ color: INK_SOFT }}>
          <time dateTime={post.publishedAt.toISOString()}>{formatPostDate(post.publishedAt)}</time>
        </p>
        <Heading
          className={
            untitled
              ? "mt-1.5 line-clamp-5 text-[15px] leading-relaxed font-medium [overflow-wrap:anywhere]"
              : "mt-1.5 line-clamp-3 font-[family-name:var(--font-heading)] text-lg leading-snug font-bold text-balance [overflow-wrap:anywhere]"
          }
          style={{ color: INK }}
        >
          <Link href={href} className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:underline-offset-2">
            {heading}
          </Link>
        </Heading>
        {excerpt ? (
          <p className="mt-2 line-clamp-3 text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
            {excerpt}
          </p>
        ) : null}

        {post.product ? (
          <div className="mt-auto pt-4">
            <Link
              href={productPath(tenantSlug, post.product.slug)}
              className="relative z-10 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium hover:bg-(--color-primary)/5"
              style={{ borderColor: LINE, color: BLUE }}
            >
              <IconDoc className="h-4 w-4 shrink-0" />
              <span className="sr-only">Tài liệu liên quan: </span>
              <span className="truncate" title={post.product.title}>{post.product.title}</span>
            </Link>
          </div>
        ) : null}
      </div>
    </article>
  );
}

/**
 * Thẻ "Tài liệu liên quan" dưới nội dung bài (trang chi tiết): ảnh bìa, tên, giá hiệu lực (giá gốc gạch ngang khi
 * khuyến mãi — kèm chữ cho trình đọc màn hình), nút "Xem tài liệu". Chỉ có khi tài liệu PUBLISHED (lib đã lọc).
 */
export function RelatedProductCard({ product, tenantSlug, headingId }: { product: PublicPostProduct; tenantSlug: string; headingId: string }) {
  const free = product.effectivePriceVnd === 0;
  const href = productPath(tenantSlug, product.slug);
  return (
    <section aria-labelledby={headingId} className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: LINE }}>
      <h2 id={headingId} className="text-xs font-bold tracking-[0.08em] uppercase" style={{ color: INK_SOFT }}>
        Tài liệu liên quan
      </h2>
      <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className="relative aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl sm:w-40" style={{ background: SURFACE }}>
          {product.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- host ảnh động (Cloudinary / bucket public)
            <img src={cloudinaryDeliveryUrl(product.coverUrl, { width: 480 })} alt="" loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover" />
          ) : (
            <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${SURFACE} 0%, ${ACCENT_SOFT} 100%)`, color: BLUE }}>
              <IconDoc className="h-8 w-8 opacity-60" />
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-[family-name:var(--font-heading)] text-base leading-snug font-bold [overflow-wrap:anywhere]" style={{ color: INK }}>
            {product.title}
          </p>
          <p className="mt-1 flex flex-wrap items-baseline gap-x-2 tabular-nums">
            {product.onSale ? <span className="sr-only">Giá khuyến mãi </span> : null}
            <span className="text-lg font-extrabold" style={{ color: BLUE }}>
              {free ? "Miễn phí" : formatVnd(product.effectivePriceVnd)}
            </span>
            {product.onSale ? (
              <span className="text-sm line-through" style={{ color: INK_SOFT }}>
                <span className="sr-only">, giá gốc </span>
                {formatVnd(product.priceVnd)}
              </span>
            ) : null}
          </p>
        </div>
        <Link
          href={href}
          className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 text-sm font-bold text-white transition hover:brightness-110 motion-reduce:transition-none"
          style={{ background: BLUE }}
        >
          Xem tài liệu
          <span className="sr-only">: {product.title}</span>
        </Link>
      </div>
    </section>
  );
}
