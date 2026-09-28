import type { StorefrontPostsData } from "@gieochu/core/storefront-sections";
import { productPath } from "@gieochu/core/product-path";
import type { PublicPostSummary } from "../../../lib/post";
import { IconDoc, IconNewspaper, IconPin } from "../../admin/_ui/icons";
import { formatPostDate, postCardText } from "./post-parts";
import { CONTAINER, SectionHeading, pillClass } from "./primitives";

/** 1–2 thẻ: căn giữa, không để cột trống; ≥ 3: lưới 3 cột như section tài liệu/đánh giá. */
function gridCols(count: number): string {
  if (count === 1) return "mx-auto max-w-xl";
  if (count === 2) return "mx-auto max-w-4xl sm:grid-cols-2";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

/**
 * ADR-029 mục 5 (M10b) — section "Bài viết" trên storefront (vùng nội dung của tenant → theme `--sf-*`). Bài
 * PUBLISHED thật, bài ghim đứng đầu khi bật `showPinnedFirst`; không có bài → page không render section.
 * Thẻ: ảnh đầu bài (hoặc khối minh hoạ nhạt), ngày, nhãn "Đã ghim", tiêu đề (h3, stretched link), trích đoạn, tên tài
 * liệu gắn kèm (link riêng, lớp trên). Nút pill "Xem tất cả bài viết" → trang hệ thống `/[slug]/posts`.
 */
export function PostsSection({
  anchorId,
  data,
  posts,
  tenantSlug,
}: {
  anchorId: string;
  data: StorefrontPostsData;
  posts: PublicPostSummary[];
  tenantSlug: string;
}) {
  if (posts.length === 0) return null;
  const titleId = `${anchorId}-title`;
  return (
    <section id={anchorId} aria-labelledby={titleId} className="py-16 sm:py-20" style={{ background: "var(--sf-hero-bg)" }}>
      <div className={CONTAINER}>
        <SectionHeading id={titleId} title={data.title} />

        <ul className={`mt-12 grid grid-cols-1 gap-6 ${gridCols(posts.length)}`}>
          {posts.map((post) => {
            const { heading, excerpt, untitled } = postCardText(post);
            const href = `/${tenantSlug}/posts/${post.id}`;
            return (
              <li key={post.id} className="flex">
                <article className="group relative flex w-full flex-col overflow-hidden rounded-xl bg-white shadow-[0_6px_24px_-10px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04] transition-shadow duration-200 hover:shadow-[0_14px_32px_-12px_rgba(15,23,42,0.3)] has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-3 has-[a:focus-visible]:outline-[color:var(--sf-focus)] motion-reduce:transition-none">
                  <div className="relative aspect-[16/9] overflow-hidden bg-[color:var(--sf-primary-soft)]">
                    {post.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary hệ thống, URL đã tối ưu 640px ở server
                      <img
                        src={post.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
                      />
                    ) : (
                      <div
                        aria-hidden="true"
                        className="absolute inset-0 flex items-center justify-center"
                        style={{
                          background: "linear-gradient(135deg, var(--sf-primary-soft) 0%, color-mix(in srgb, var(--sf-accent) 22%, white) 100%)",
                          color: "var(--sf-primary-text)",
                        }}
                      >
                        <IconNewspaper className="h-10 w-10 opacity-60" />
                      </div>
                    )}
                    {post.isPinned ? (
                      <span className="absolute top-3 left-3 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-[color:var(--sf-primary-text)] shadow-sm">
                        <IconPin className="h-3.5 w-3.5" />
                        Đã ghim
                      </span>
                    ) : null}
                  </div>

                  <div className="flex flex-1 flex-col px-5 pt-4 pb-5">
                    <p className="text-xs font-medium" style={{ color: "var(--sf-ink-soft)" }}>
                      <time dateTime={post.publishedAt.toISOString()}>{formatPostDate(post.publishedAt)}</time>
                    </p>
                    <h3
                      className={
                        untitled
                          ? "mt-1.5 line-clamp-5 text-[15px] leading-relaxed font-medium [overflow-wrap:anywhere]"
                          : "mt-1.5 line-clamp-3 font-[family-name:var(--font-heading)] text-lg leading-snug font-bold [overflow-wrap:anywhere]"
                      }
                    >
                      <a href={href} className="outline-none after:absolute after:inset-0 after:content-[''] group-hover:underline group-hover:underline-offset-2">
                        {heading}
                      </a>
                    </h3>
                    {excerpt ? (
                      <p className="mt-2 line-clamp-3 text-sm leading-relaxed [overflow-wrap:anywhere]" style={{ color: "var(--sf-ink-soft)" }}>
                        {excerpt}
                      </p>
                    ) : null}
                    {post.product ? (
                      <div className="mt-auto pt-4">
                        <a
                          href={productPath(tenantSlug, post.product.slug)}
                          className="relative z-10 inline-flex min-h-11 max-w-full items-center gap-2 rounded-full border px-3 py-1.5 text-sm font-medium text-[color:var(--sf-primary-text)] hover:bg-[color:var(--sf-primary-soft)]"
                          style={{ borderColor: "var(--sf-line)" }}
                        >
                          <IconDoc className="h-4 w-4 shrink-0" />
                          <span className="sr-only">Tài liệu liên quan: </span>
                          <span className="truncate" title={post.product.title}>{post.product.title}</span>
                        </a>
                      </div>
                    ) : null}
                  </div>
                </article>
              </li>
            );
          })}
        </ul>

        <div className="mt-12 text-center">
          <a href={`/${tenantSlug}/posts`} className={pillClass("primary")}>
            Xem tất cả bài viết
          </a>
        </div>
      </div>
    </section>
  );
}
