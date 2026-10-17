import Link from "next/link";
import type { Metadata } from "next";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listProducts } from "../../../../lib/product";
import { countNewTenantReviews, listTenantReviews, type TenantReviewFilter } from "../../../../lib/review";
import { AdminPageHeader, EmptyState } from "../../../admin/_ui/kit";
import { IconExternalLink } from "../../../admin/_ui/icons";
import { IconStar } from "../../../[tenantSlug]/_ui/icons";
import { StudioReviewCard, type StudioReviewCardData } from "./_ui/review-card";

export const metadata: Metadata = { title: "Đánh giá" };

const INK = "#12213A";
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const CURSOR_PATTERN = /^[a-z0-9]{1,40}$/i;
const FIELD_CLASS =
  "mt-1.5 min-h-11 w-full rounded-lg border bg-white px-3 text-sm outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15 lg:min-h-10";
const LINK_BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold hover:bg-gray-50 lg:min-h-10";

type Query = { status?: string; product?: string; rating?: string; cursor?: string };

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * ADR-029 (M10a) — Studio → Đánh giá (link trong email "có đánh giá mới" trỏ tới đây). Bộ lọc là form GET (không
 * cần JS, URL chia sẻ được); phân trang cursor 20/trang (tiến tới + về trang đầu). Thao tác trên từng thẻ ở
 * `_ui/review-card.tsx`. Nội dung của khách chỉ đọc (tenant không sửa/xoá được).
 */
export default async function StudioReviewsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<Record<keyof Query, string | string[] | undefined>>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/reviews`);
  const raw = await searchParams;

  const statusParam = one(raw.status);
  const productParam = one(raw.product);
  const ratingParam = Number.parseInt(one(raw.rating) ?? "", 10);
  const cursorParam = one(raw.cursor);

  const filter: TenantReviewFilter = {};
  if (statusParam === "VISIBLE" || statusParam === "HIDDEN") filter.status = statusParam;
  if (productParam && CURSOR_PATTERN.test(productParam)) filter.productId = productParam;
  if (Number.isInteger(ratingParam) && ratingParam >= 1 && ratingParam <= 5) filter.rating = ratingParam;
  const cursor = cursorParam && CURSOR_PATTERN.test(cursorParam) ? cursorParam : null;

  const [page, products, newCount] = await Promise.all([
    listTenantReviews(tenant.id, filter, cursor),
    listProducts(tenant.id),
    countNewTenantReviews(tenant.id),
  ]);

  const base = `/studio/${tenant.slug}/reviews`;
  const filterQuery: Record<string, string> = {
    ...(filter.status ? { status: filter.status } : {}),
    ...(filter.productId ? { product: filter.productId } : {}),
    ...(filter.rating ? { rating: String(filter.rating) } : {}),
  };
  const hasFilter = Object.keys(filterQuery).length > 0;
  const firstPageHref = hasFilter ? `${base}?${new URLSearchParams(filterQuery).toString()}` : base;
  const nextHref = page.nextCursor ? `${base}?${new URLSearchParams({ ...filterQuery, cursor: page.nextCursor }).toString()}` : null;

  const items: StudioReviewCardData[] = page.items.map((r) => ({
    id: r.id,
    productTitle: r.productTitle,
    productSlug: r.productSlug,
    rating: r.rating,
    body: r.body,
    displayName: r.displayName,
    status: r.status,
    hiddenReason: r.hiddenReason,
    hiddenAt: r.hiddenAt ? r.hiddenAt.toISOString() : null,
    moderationLockedAt: r.moderationLockedAt ? r.moderationLockedAt.toISOString() : null,
    moderationReason: r.moderationReason,
    reply: r.reply,
    repliedAt: r.repliedAt ? r.repliedAt.toISOString() : null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  }));

  return (
    // Nằm trong app shell Studio (layout đã có <main>) → dùng <div>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Đánh giá"
        subtitle={
          <>
            Đánh giá của khách đã mua tài liệu. Bạn có thể trả lời công khai, ẩn đánh giá vi phạm (bắt buộc chọn lý do) và khôi phục — không sửa được nội
            dung của khách.
            {newCount > 0 ? (
              <span className="mt-1 block font-medium" style={{ color: INK }}>
                {newCount.toLocaleString("vi-VN")} đánh giá mới trong 7 ngày gần nhất.
              </span>
            ) : null}
          </>
        }
        action={
          <Link href={`/studio/${tenant.slug}/storefront`} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
            Hiện đánh giá trên trang bán hàng
          </Link>
        }
      />

      <form method="get" action={base} className="mt-6 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: LINE }} aria-label="Lọc đánh giá">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)_minmax(0,1fr)_auto] xl:items-end">
          <div>
            <label htmlFor="rv-status" className="block text-sm font-medium" style={{ color: INK }}>
              Trạng thái
            </label>
            <select id="rv-status" name="status" defaultValue={filter.status ?? ""} className={FIELD_CLASS} style={{ borderColor: LINE }}>
              <option value="">Tất cả</option>
              <option value="VISIBLE">Đang hiển thị</option>
              <option value="HIDDEN">Đã ẩn</option>
            </select>
          </div>
          <div>
            <label htmlFor="rv-product" className="block text-sm font-medium" style={{ color: INK }}>
              Tài liệu
            </label>
            <select id="rv-product" name="product" defaultValue={filter.productId ?? ""} className={FIELD_CLASS} style={{ borderColor: LINE }}>
              <option value="">Tất cả tài liệu</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="rv-rating" className="block text-sm font-medium" style={{ color: INK }}>
              Số sao
            </label>
            <select id="rv-rating" name="rating" defaultValue={filter.rating ? String(filter.rating) : ""} className={FIELD_CLASS} style={{ borderColor: LINE }}>
              <option value="">Mọi mức sao</option>
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} sao
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-wrap gap-2 sm:col-span-2 xl:col-span-1">
            <button
              type="submit"
              className="inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-5 text-sm font-semibold text-white hover:brightness-110 lg:min-h-10"
              style={{ background: "#0F3B82" }}
            >
              Lọc
            </button>
            {hasFilter ? (
              <Link href={base} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
                Xoá lọc
              </Link>
            ) : null}
          </div>
        </div>
      </form>

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState
            icon={<IconStar filled={false} className="h-6 w-6" />}
            title={cursor ? "Không còn đánh giá nào" : hasFilter ? "Không có đánh giá khớp bộ lọc" : "Chưa có đánh giá nào"}
            description={
              cursor
                ? "Bạn đã xem hết danh sách."
                : hasFilter
                  ? "Thử bỏ bớt điều kiện lọc."
                  : "Khi khách đã mua tài liệu viết đánh giá, đánh giá sẽ hiện ở đây và bạn nhận email báo."
            }
            action={
              cursor || hasFilter ? (
                <Link href={cursor ? firstPageHref : base} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
                  {cursor ? "Về trang đầu" : "Xem tất cả đánh giá"}
                </Link>
              ) : (
                <Link
                  href={`/${tenant.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex min-h-11 items-center gap-2 text-sm font-semibold underline underline-offset-2 hover:no-underline"
                  style={{ color: INK }}
                >
                  <IconExternalLink className="h-4 w-4" /> Xem trang bán hàng
                  <span className="sr-only">(mở tab mới)</span>
                </Link>
              )
            }
          />
        ) : (
          <ul className="space-y-3" aria-label="Danh sách đánh giá">
            {items.map((review) => (
              <li key={review.id}>
                <StudioReviewCard tenantSlug={tenant.slug} tenantName={tenant.name} review={review} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {items.length > 0 && (cursor || nextHref) ? (
        <nav className="mt-6 flex flex-wrap items-center gap-3 text-sm" aria-label="Phân trang">
          {cursor ? (
            <Link href={firstPageHref} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
              ← Về trang đầu
            </Link>
          ) : null}
          {nextHref ? (
            <Link href={nextHref} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
              Trang sau →
            </Link>
          ) : (
            <span style={{ color: INK_SOFT }}>Đã hết danh sách.</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
