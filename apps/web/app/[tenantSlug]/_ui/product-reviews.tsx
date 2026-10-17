import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import type { ProductRatingSummary, PublicReview } from "../../../lib/review";
import { IconCheck } from "./icons";
import { formatRatingAverage, formatReviewDateTime, reviewerInitial, ReviewStars } from "./review-parts";

/*
 * ADR-029 (M10a) — khối "Đánh giá" dưới mô tả của trang chi tiết tài liệu (trang hệ thống, ADR-025: màu + font hệ
 * thống). Không dùng hook → render được trong Server Component. Form viết/sửa đánh giá của khách là slot `composer`
 * (Client Component `review-composer.tsx`) để khối này dùng chung với trang Xem trước (chỉ đọc).
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const AMBER = brandColors.accent;
const SURFACE = brandColors.surface;

/** Anchor khối đánh giá — link "(n đánh giá)" ở khối mua và nút trong Thư viện khách trỏ tới đây. */
export const PRODUCT_REVIEWS_ANCHOR = "danh-gia";

const count = new Intl.NumberFormat("vi-VN");

/** Dòng "★★★★☆ 4,6 (12 đánh giá)" dưới tiêu đề — link cuộn tới khối đánh giá. Chưa có đánh giá → không hiện. */
export function ProductRatingInline({ average, ratingCount }: { average: number | null; ratingCount: number }) {
  if (ratingCount < 1 || average === null) return null;
  const avg = formatRatingAverage(average);
  return (
    <a
      href={`#${PRODUCT_REVIEWS_ANCHOR}`}
      className="group mt-2 inline-flex min-h-11 items-center gap-2 rounded-lg text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]"
    >
      <ReviewStars rating={average} label={`Điểm trung bình ${avg} trên 5 sao`} className="text-[color:var(--color-accent)]" />
      <span className="font-bold tabular-nums" style={{ color: INK }} aria-hidden="true">
        {avg}
      </span>
      <span className="underline-offset-2 group-hover:underline" style={{ color: INK_SOFT }}>
        ({count.format(ratingCount)} đánh giá)
      </span>
    </a>
  );
}

function RatingSummary({ summary }: { summary: ProductRatingSummary }) {
  const max = Math.max(1, summary.count);
  const avg = summary.average !== null ? formatRatingAverage(summary.average) : null;
  return (
    <div className="grid gap-6 rounded-2xl border bg-white p-5 sm:grid-cols-[180px_minmax(0,1fr)] sm:items-center sm:p-6" style={{ borderColor: LINE }}>
      <div className="text-center sm:border-r sm:pr-6" style={{ borderColor: LINE }}>
        <p className="font-[family-name:var(--font-heading)] text-5xl leading-none font-extrabold tabular-nums" style={{ color: INK }}>
          {avg ?? "—"}
          <span className="sr-only"> trên 5 điểm</span>
        </p>
        {summary.average !== null ? (
          <ReviewStars rating={summary.average} label={`Điểm trung bình ${avg} trên 5 sao`} starClassName="h-5 w-5" className="mt-2.5 text-[color:var(--color-accent)]" />
        ) : null}
        <p className="mt-2 text-sm" style={{ color: INK_SOFT }}>
          {count.format(summary.count)} đánh giá
        </p>
      </div>

      <ul aria-label="Phân bố số sao" className="space-y-2">
        {([5, 4, 3, 2, 1] as const).map((star) => {
          const n = summary.distribution[star];
          const percent = Math.round((n / max) * 100);
          return (
            <li key={star} className="grid grid-cols-[3.25rem_minmax(0,1fr)_2.5rem] items-center gap-3 text-sm">
              <span className="font-medium whitespace-nowrap" style={{ color: INK }}>
                {star} sao
              </span>
              {/* Thanh chỉ minh hoạ (aria-hidden) — con số bên phải là thông tin thật. */}
              <span aria-hidden="true" className="h-2.5 overflow-hidden rounded-full" style={{ background: SURFACE }}>
                <span className="block h-full rounded-full" style={{ width: `${percent}%`, background: AMBER }} />
              </span>
              <span className="text-right tabular-nums" style={{ color: INK_SOFT }}>
                {count.format(n)}
                <span className="sr-only"> đánh giá</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/**
 * Một đánh giá công khai: sao (có chữ), tên, nhãn "Đã mua", giờ VN, nội dung text thuần giữ xuống dòng, trả lời.
 * `report` (ADR-038): nút "Báo cáo" kín đáo ở chân đánh giá — chỉ trang công khai truyền.
 */
export function PublicReviewItem({ review, tenantName, report }: { review: PublicReview; tenantName: string; report?: ReactNode }) {
  const nameId = `review-${review.id}-name`;
  return (
    <article aria-labelledby={nameId} className="py-5">
      <header className="flex items-start gap-3">
        <span
          aria-hidden="true"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-heading)] text-sm font-bold"
          style={{ background: SURFACE, color: BLUE }}
        >
          {reviewerInitial(review.displayName)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 id={nameId} className="font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
              {review.displayName}
            </h3>
            {review.verifiedPurchase ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-semibold text-green-800">
                <IconCheck className="h-3 w-3" />
                Đã mua
              </span>
            ) : null}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: INK_SOFT }}>
            <ReviewStars rating={review.rating} className="text-[color:var(--color-accent)]" />
            <time dateTime={new Date(review.createdAt).toISOString()}>{formatReviewDateTime(review.createdAt)}</time>
          </div>
        </div>
      </header>

      {review.body ? (
        <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-line [overflow-wrap:anywhere] sm:pl-[52px]" style={{ color: INK }}>
          {review.body}
        </p>
      ) : null}

      {review.reply ? (
        <div className="mt-3 rounded-xl border-l-4 px-4 py-3 sm:ml-[52px]" style={{ borderColor: BLUE, background: SURFACE }}>
          <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-semibold" style={{ color: BLUE }}>
            Phản hồi từ {tenantName}
            {review.repliedAt ? (
              <time dateTime={new Date(review.repliedAt).toISOString()} className="text-xs font-normal" style={{ color: INK_SOFT }}>
                {formatReviewDateTime(review.repliedAt)}
              </time>
            ) : null}
          </p>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-line [overflow-wrap:anywhere]" style={{ color: INK }}>
            {review.reply}
          </p>
        </div>
      ) : null}

      {report ? <div className="mt-1 flex justify-end sm:pl-[52px]">{report}</div> : null}
    </article>
  );
}

export function ProductReviewsSection({
  tenantName,
  summary,
  items,
  composer,
  loadMore,
  resetHref,
  footer,
  renderReport,
  className = "",
}: {
  tenantName: string;
  summary: ProductRatingSummary;
  items: PublicReview[];
  /** Form viết/sửa đánh giá của khách (trang công khai) — trang Xem trước bỏ trống. */
  composer?: ReactNode;
  /** Link "Xem thêm" (searchParams, server render). `replace` = đổi hẳn trang (xem đánh giá cũ hơn). */
  loadMore?: { href: string; label: string; replace: boolean } | null;
  /** Đang xem trang đánh giá cũ hơn → link quay về mới nhất. */
  resetHref?: string | null;
  footer?: ReactNode;
  /** ADR-038: dựng nút "Báo cáo" cho từng đánh giá (trang công khai); bỏ trống = không có nút (trang Xem trước). */
  renderReport?: (review: PublicReview) => ReactNode;
  className?: string;
}) {
  const headingId = `${PRODUCT_REVIEWS_ANCHOR}-tieu-de`;
  return (
    // scroll-mt: header hệ thống dính 88px — anchor #danh-gia không bị che.
    <section id={PRODUCT_REVIEWS_ANCHOR} aria-labelledby={headingId} className={`scroll-mt-28 ${className}`}>
      <h2 id={headingId} className="font-[family-name:var(--font-heading)] text-xl font-extrabold sm:text-2xl" style={{ color: INK }}>
        Đánh giá
      </h2>
      <span aria-hidden="true" className="mt-3 block h-[3px] w-[45px] rounded-full" style={{ background: AMBER }} />

      <div className="mt-5 space-y-5">
        {summary.count > 0 ? <RatingSummary summary={summary} /> : null}

        {composer}

        {resetHref ? (
          <p className="text-sm" style={{ color: INK_SOFT }}>
            Đang xem các đánh giá cũ hơn.{" "}
            <Link href={resetHref} className="inline-flex min-h-11 items-center font-semibold underline underline-offset-2 hover:no-underline" style={{ color: BLUE }}>
              Về đánh giá mới nhất
            </Link>
          </p>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-white px-6 py-10 text-center" style={{ borderColor: LINE }}>
            <ReviewStars rating={0} label="Chưa có sao nào" starClassName="h-6 w-6" className="text-[color:var(--color-accent)]" />
            <p className="mt-3 font-semibold" style={{ color: INK }}>
              {resetHref ? "Không còn đánh giá nào cũ hơn" : "Chưa có đánh giá"}
            </p>
            <p className="mx-auto mt-1 max-w-sm text-sm" style={{ color: INK_SOFT }}>
              Đánh giá chỉ đến từ khách đã mua tài liệu này.
            </p>
          </div>
        ) : (
          <ol aria-label="Danh sách đánh giá" className="divide-y rounded-2xl border bg-white px-5 sm:px-6" style={{ borderColor: LINE }}>
            {items.map((review) => (
              <li key={review.id} style={{ borderColor: LINE }}>
                <PublicReviewItem review={review} tenantName={tenantName} report={renderReport?.(review)} />
              </li>
            ))}
          </ol>
        )}

        {items.length > 0 ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <p className="text-sm tabular-nums" style={{ color: INK_SOFT }} aria-live="polite">
              {resetHref ? `Đang hiện ${count.format(items.length)} đánh giá cũ hơn` : `Đang hiện ${count.format(items.length)}/${count.format(summary.count)} đánh giá`}
            </p>
            {loadMore ? (
              <Link
                href={loadMore.href}
                scroll={loadMore.replace}
                replace
                className="inline-flex min-h-11 items-center justify-center rounded-full border bg-white px-6 text-sm font-semibold transition-colors hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] motion-reduce:transition-none"
                style={{ borderColor: LINE, color: BLUE }}
              >
                {loadMore.label}
              </Link>
            ) : null}
          </div>
        ) : null}

        {footer}
      </div>
    </section>
  );
}
