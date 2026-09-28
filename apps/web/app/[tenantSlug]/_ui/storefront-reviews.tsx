import type { StorefrontReviewsData } from "@gieochu/core/storefront-sections";
import { productPath } from "@gieochu/core/product-path";
import type { StorefrontReviewItem } from "../../../lib/review";
import { IconCheck } from "./icons";
import { CONTAINER, SectionHeading } from "./primitives";
import { PRODUCT_REVIEWS_ANCHOR } from "./product-reviews";
import { formatReviewDate, reviewerInitial, ReviewStars } from "./review-parts";

/** Nền avatar chữ cái đầu — xoay vòng các cặp màu đã tính tương phản trong `buildStorefrontStyle`. */
const MONOGRAM = [
  { bg: "var(--sf-primary)", fg: "var(--sf-on-primary)" },
  { bg: "var(--sf-accent)", fg: "var(--sf-on-accent)" },
  { bg: "var(--sf-primary-soft)", fg: "var(--sf-primary-text)" },
] as const;

/** 1–2 thẻ: căn giữa, không để cột trống; ≥ 3: lưới 3 cột như section tài liệu. */
function gridCols(count: number): string {
  if (count === 1) return "mx-auto max-w-xl";
  if (count === 2) return "mx-auto max-w-4xl sm:grid-cols-2";
  return "sm:grid-cols-2 lg:grid-cols-3";
}

/**
 * ADR-029 mục 4 — section "Đánh giá" của storefront: đánh giá THẬT của khách đã mua (nhãn "Đã mua"), khác section
 * "Cảm nhận" nhập tay. Mỗi thẻ: sao (có chữ), trích nội dung (tối đa 6 dòng — bản đầy đủ ở trang tài liệu), tên,
 * nhãn "Đã mua", ngày, tên tài liệu link tới khối đánh giá của trang tài liệu. Không có đánh giá → page không render.
 */
export function ReviewsSection({
  anchorId,
  data,
  items,
  tenantSlug,
}: {
  anchorId: string;
  data: StorefrontReviewsData;
  items: StorefrontReviewItem[];
  tenantSlug: string;
}) {
  if (items.length === 0) return null;
  const titleId = `${anchorId}-title`;
  return (
    <section id={anchorId} aria-labelledby={titleId} className="bg-white py-16 sm:py-20">
      <div className={CONTAINER}>
        <SectionHeading id={titleId} title={data.title} />

        <ul className={`mt-12 grid grid-cols-1 gap-6 ${gridCols(items.length)}`}>
          {items.map((review, index) => {
            const tone = MONOGRAM[index % MONOGRAM.length]!;
            const nameId = `${anchorId}-${review.id}-name`;
            return (
              <li key={review.id} className="flex">
                <article
                  aria-labelledby={nameId}
                  className="flex w-full flex-col rounded-xl bg-white px-6 py-7 shadow-[0_6px_24px_-10px_rgba(15,23,42,0.18)] ring-1 ring-black/[0.04]"
                >
                  <ReviewStars rating={review.rating} starClassName="h-5 w-5" className="text-[color:var(--sf-accent-text)]" />
                  {review.body ? (
                    <blockquote className="mt-4 flex-1">
                      <p className="line-clamp-6 text-[15px] leading-relaxed whitespace-pre-line text-[color:var(--sf-ink)] [overflow-wrap:anywhere]">{review.body}</p>
                    </blockquote>
                  ) : (
                    <p className="mt-4 flex-1 text-sm italic" style={{ color: "var(--sf-ink-soft)" }}>
                      Khách chỉ chấm sao, không để lại nhận xét.
                    </p>
                  )}

                  <footer className="mt-6 flex items-start gap-3 border-t pt-4" style={{ borderColor: "var(--sf-line)" }}>
                    <span
                      aria-hidden="true"
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-heading)] text-sm font-extrabold"
                      style={{ background: tone.bg, color: tone.fg }}
                    >
                      {reviewerInitial(review.displayName)}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span id={nameId} className="font-bold [overflow-wrap:anywhere]">
                          {review.displayName}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800">
                          <IconCheck className="h-3 w-3" />
                          Đã mua
                        </span>
                      </p>
                      <p className="mt-1" style={{ color: "var(--sf-ink-soft)" }}>
                        <a
                          href={`${productPath(tenantSlug, review.productSlug)}#${PRODUCT_REVIEWS_ANCHOR}`}
                          className="font-medium text-[color:var(--sf-primary-text)] underline-offset-2 [overflow-wrap:anywhere] hover:underline"
                        >
                          {review.productTitle}
                        </a>
                        <span aria-hidden="true"> · </span>
                        <time dateTime={new Date(review.createdAt).toISOString()}>{formatReviewDate(review.createdAt)}</time>
                      </p>
                    </div>
                  </footer>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
