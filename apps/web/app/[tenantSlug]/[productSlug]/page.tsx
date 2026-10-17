import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { brandColors } from "@gieochu/config/theme";
import { getEnv } from "@gieochu/config";
import { calculateOrderPricing, isReservedProductSlug, productPath as buildProductPath, productUrl, resolveStorefrontAccess } from "@gieochu/core";
import { findTenantBySlugForStorefront, getPublishedProductBySlug } from "../../../lib/storefront";
import { getProductCoverUrl } from "../../../lib/product-cover";
import { getProductRatingSummary, getProductReviews, getReviewEligibility, PRODUCT_REVIEWS_PAGE_SIZE, PRODUCT_REVIEWS_PAGE_SIZE_MAX } from "../../../lib/review";
import { getCurrentUser } from "../../../lib/session";
import { getSystemCloudinaryCloudName } from "../../../lib/system-cloudinary";
import { SiteFooter } from "../../_ui/site-footer";
import { SiteHeader } from "../../_ui/site-header";
import { systemFontVars } from "../../_ui/system-fonts";
import { IconInfo } from "../_ui/icons";
import { ProductDetailView } from "../_ui/product-detail";
import { PRODUCT_REVIEWS_ANCHOR, ProductReviewsSection } from "../_ui/product-reviews";
import { ReviewComposer } from "../_ui/review-composer";
import { ReportAbuseButton } from "../_ui/report-abuse";
import { BuyButton } from "./buy-button";

// ADR-030: URL chuẩn `/{tenantSlug}/{productSlug}` (URL cũ `/{tenantSlug}/products/{productSlug}` → 301 ở
// `../products/[productSlug]/route.ts`). Segment tĩnh cùng cấp (`posts`, `checkout`) thắng segment động này; slug
// dành riêng (RESERVED_PRODUCT_SLUGS) không bao giờ là trang tài liệu → 404.
// ADR-025: trang chi tiết tài liệu là trang HỆ THỐNG — màu + font hệ thống, không mang theme tenant. Thân trang
// dùng chung với trang Xem trước trong Studio (`_ui/product-detail.tsx`, ADR-027 §5).
const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PAPER = brandColors.background;
const SURFACE = brandColors.surface;

/** Id cuid2 / cursor hợp lệ trên URL (chặn chuỗi rác trước khi đưa vào truy vấn). */
const CURSOR_PATTERN = /^[a-z0-9]{1,40}$/i;

/**
 * ADR-029: "Xem thêm" đánh giá không cần JS — server render theo searchParams:
 *  - `?reviews=N` (10, 20, ... tối đa 50): hiện N đánh giá mới nhất (link "Xem thêm" tăng N, giữ vị trí cuộn);
 *  - quá 50 → `?reviewsAfter=<id>`: trang 50 đánh giá cũ hơn tiếp theo (cursor) + link "Về đánh giá mới nhất".
 */
function parseReviewPaging(query: { reviews?: string | string[]; reviewsAfter?: string | string[] }) {
  const after = typeof query.reviewsAfter === "string" && CURSOR_PATTERN.test(query.reviewsAfter) ? query.reviewsAfter : null;
  if (after) return { after, limit: PRODUCT_REVIEWS_PAGE_SIZE_MAX };
  const requested = typeof query.reviews === "string" ? Number.parseInt(query.reviews, 10) : Number.NaN;
  const limit = Number.isFinite(requested)
    ? Math.min(Math.max(Math.ceil(requested / PRODUCT_REVIEWS_PAGE_SIZE) * PRODUCT_REVIEWS_PAGE_SIZE, PRODUCT_REVIEWS_PAGE_SIZE), PRODUCT_REVIEWS_PAGE_SIZE_MAX)
    : PRODUCT_REVIEWS_PAGE_SIZE;
  return { after: null, limit };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string; productSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug, productSlug } = await params;
  if (isReservedProductSlug(productSlug)) return {};
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  // ADR-040: trang tài liệu của gian hàng không ACTIVE trả 404 cho khách → không lộ tiêu đề/mô tả qua metadata.
  if (!tenant || tenant.status !== "ACTIVE") return {};
  const product = await getPublishedProductBySlug(tenant.id, productSlug);
  if (!product) return {};
  return {
    title: `${product.title} — ${tenant.name}`,
    description: product.summary ?? undefined,
    alternates: { canonical: productUrl(getEnv().APP_URL, tenant.slug, product.slug) },
  };
}

export default async function ProductDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; productSlug: string }>;
  searchParams: Promise<{ reviews?: string | string[]; reviewsAfter?: string | string[] }>;
}) {
  const { tenantSlug, productSlug } = await params;
  if (isReservedProductSlug(productSlug)) notFound();
  const paging = parseReviewPaging(await searchParams);
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (!tenant) notFound();

  const currentUser = await getCurrentUser();
  const isOwner = currentUser?.userId === tenant.ownerId;
  // ADR-040: chỉ gian hàng ACTIVE hiển thị tài liệu. READ_ONLY → khách 404 (chủ vẫn xem); LOCKED → 404 cho mọi
  // người như trước (chủ thấy thông báo khoá ở trang gian hàng, không ở đây). Kiểm trước khi truy vấn sản phẩm.
  const access = resolveStorefrontAccess(tenant.status, isOwner ? "owner" : "guest");
  if (access !== "ACTIVE" && access !== "READ_ONLY") notFound();

  const product = await getPublishedProductBySlug(tenant.id, productSlug);
  if (!product) notFound();

  const pricing = calculateOrderPricing(
    [
      {
        productId: product.id,
        title: product.title,
        priceVnd: product.priceVnd,
        salePriceVnd: product.salePriceVnd,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
      },
    ],
    null,
    0,
    new Date(),
  );
  const effectivePriceVnd = pricing.lines[0]?.finalPriceVnd ?? product.priceVnd;

  // ADR-027: ảnh bìa hiệu lực (Cloudinary, fallback R2).
  // ADR-029: tóm tắt điểm + trang đánh giá + quyền đánh giá của khách đang xem (chủ trang không viết đánh giá).
  const [coverUrl, imageCloudName, ratingSummary, reviewPage, eligibility] = await Promise.all([
    getProductCoverUrl(product),
    getSystemCloudinaryCloudName(),
    getProductRatingSummary(product),
    getProductReviews(product.id, paging.after, paging.limit),
    currentUser && !isOwner ? getReviewEligibility(currentUser.userId, product.id) : Promise.resolve(null),
  ]);

  const productPath = buildProductPath(tenant.slug, product.slug);
  const loadMore = reviewPage.nextCursor
    ? !paging.after && paging.limit < PRODUCT_REVIEWS_PAGE_SIZE_MAX
      ? { href: `${productPath}?reviews=${paging.limit + PRODUCT_REVIEWS_PAGE_SIZE}`, label: "Xem thêm đánh giá", replace: false }
      : { href: `${productPath}?reviewsAfter=${reviewPage.nextCursor}#${PRODUCT_REVIEWS_ANCHOR}`, label: "Xem đánh giá cũ hơn", replace: true }
    : null;

  const composer = isOwner ? null : !currentUser ? (
    <ReviewComposer viewer="guest" loginHref={`/login?next=${encodeURIComponent(`${productPath}#${PRODUCT_REVIEWS_ANCHOR}`)}`} />
  ) : eligibility ? (
    <ReviewComposer
      viewer="customer"
      productId={product.id}
      tenantName={tenant.name}
      canReview={eligibility.canReview}
      existing={eligibility.existing}
      displayNamePreview={eligibility.displayNamePreview}
      profileHref="/account/profile"
    />
  ) : null;

  const purchase = isOwner ? (
    <p className="flex items-start gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: SURFACE, color: INK_SOFT }}>
      <IconInfo className="mt-0.5 h-4 w-4 shrink-0" />
      Đây là sản phẩm của bạn.
    </p>
  ) : (
    // ADR-040: tới đây khách chỉ có thể đang xem gian hàng ACTIVE (không ACTIVE đã 404 ở trên).
    <BuyButton tenantSlug={tenant.slug} productId={product.id} productSlug={product.slug} loggedIn={Boolean(currentUser)} />
  );

  return (
    <div className={`${systemFontVars} min-h-dvh overflow-x-clip font-[family-name:var(--font-body)]`} style={{ background: PAPER, color: INK }}>
      <a
        href="#noi-dung"
        className="sr-only z-30 rounded-full bg-white px-5 py-3 font-semibold text-[color:var(--color-primary)] shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3"
      >
        Bỏ qua tới nội dung chính
      </a>

      <SiteHeader />

      <main id="noi-dung" tabIndex={-1} className="outline-none">
        <ProductDetailView
          tenantName={tenant.name}
          tenantHref={`/${tenant.slug}`}
          product={{
            title: product.title,
            summary: product.summary,
            description: product.description,
            type: product.type,
            tags: product.tags,
            priceVnd: product.priceVnd,
            effectivePriceVnd,
            downloadLimit: product.downloadLimit,
            coverUrl,
            imageCloudName,
            rating: { average: ratingSummary.average, count: ratingSummary.count },
          }}
          purchase={purchase}
          report={
            // ADR-038: ai cũng báo cáo được (khách vãng lai nhập email trong hộp thoại); chủ trang không tự báo cáo.
            isOwner ? undefined : (
              <ReportAbuseButton targetType="PRODUCT" targetId={product.id} targetLabel={`Tài liệu “${product.title}”`} isSignedIn={Boolean(currentUser)} />
            )
          }
          reviews={
            <ProductReviewsSection
              tenantName={tenant.name}
              summary={ratingSummary}
              items={reviewPage.items}
              composer={composer}
              loadMore={loadMore}
              resetHref={paging.after ? `${productPath}#${PRODUCT_REVIEWS_ANCHOR}` : null}
              renderReport={
                isOwner
                  ? undefined
                  : (review) => (
                      <ReportAbuseButton
                        targetType="REVIEW"
                        targetId={review.id}
                        targetLabel={`Đánh giá của ${review.displayName} cho tài liệu “${product.title}”`}
                        isSignedIn={Boolean(currentUser)}
                        label="Báo cáo"
                        srContext={` đánh giá của ${review.displayName}`}
                        className="text-xs"
                      />
                    )
              }
            />
          }
        />
      </main>

      <SiteFooter />
    </div>
  );
}
