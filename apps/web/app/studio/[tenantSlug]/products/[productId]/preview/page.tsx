import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppError } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../../lib/page-guards";
import { getProductPreviewData } from "../../../../../../lib/product";
import { getSystemCloudinaryCloudName } from "../../../../../../lib/system-cloudinary";
import { getProductRatingSummary, getProductReviews, type ProductRatingSummary, type PublicReview } from "../../../../../../lib/review";
import { brandColors } from "@gieochu/config/theme";
import { SiteFooter } from "../../../../../_ui/site-footer";
import { SiteHeader } from "../../../../../_ui/site-header";
import { systemFontVars } from "../../../../../_ui/system-fonts";
import { ProductDetailView } from "../../../../../[tenantSlug]/_ui/product-detail";
import { ProductReviewsSection } from "../../../../../[tenantSlug]/_ui/product-reviews";
import { IconChevronLeft, IconEye, IconGlobe, IconLayers, IconLock } from "../../../../../admin/_ui/icons";

/** Nhãn trạng thái theo ngôn ngữ "chế độ hiển thị" (ADR-027 §1) — icon + chữ, không chỉ dựa màu. */
const STATUS_PILL = {
  DRAFT: { label: "Riêng tư", Icon: IconLock, bg: "#FEF3C7", fg: "#92400E" },
  PUBLISHED: { label: "Công khai", Icon: IconGlobe, bg: "#DCFCE7", fg: "#166534" },
  ARCHIVED: { label: "Đã lưu trữ", Icon: IconLayers, bg: "#E5E7EB", fg: "#374151" },
} as const;

// ADR-027 §5: trang nội bộ Studio — không bao giờ để công cụ tìm kiếm lập chỉ mục.
export const metadata: Metadata = {
  title: "Xem trước sản phẩm",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/**
 * ADR-027 §5 — Xem trước trang chi tiết sản phẩm (kể cả bản nháp). Chỉ thành viên quản lý tenant
 * (`requireTenantMemberPage`); dữ liệu đọc qua `withTenant` nên tenant khác / id sai → 404.
 * Phần logic tối thiểu (Hiếu) — giao diện giống trang công khai + dải "Bản xem trước" do Phong dựng.
 */
export default async function ProductPreviewPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; productId: string }>;
}) {
  const { tenantSlug, productId } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products/${productId}/preview`);

  let data;
  try {
    data = await getProductPreviewData(tenant.id, productId);
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }
  const { product } = data;
  const imageCloudName = await getSystemCloudinaryCloudName();

  // ADR-029: khối đánh giá CHỈ ĐỌC (không form). Đánh giá công khai chỉ tồn tại/đọc được khi tài liệu Công khai
  // (RLS scope public) — bản nháp/lưu trữ hiện khối trống kèm giải thích.
  let ratingSummary: ProductRatingSummary = { average: null, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
  let reviewItems: PublicReview[] = [];
  let hasMoreReviews = false;
  if (product.status === "PUBLISHED") {
    const [summary, page] = await Promise.all([
      getProductRatingSummary({ id: product.id, ratingSum: product.ratingSum, ratingCount: product.ratingCount }),
      getProductReviews(product.id),
    ]);
    ratingSummary = summary;
    reviewItems = page.items;
    hasMoreReviews = page.nextCursor !== null;
  }

  const editHref = `/studio/${tenantSlug}/products/${product.id}`;
  const pill = STATUS_PILL[product.status];

  // Nằm trong app shell Studio (layout đã có <main>) → dùng <div>. Dải "Bản xem trước" dính đầu vùng làm việc;
  // bên dưới là "khung" mô phỏng đúng trang công khai (SiteHeader + thân trang dùng chung + SiteFooter).
  // globals.css: `.studio-preview-frame .site-header` về position static để header không đè dải xem trước.
  return (
    <div>
      <div
        className="studio-preview-bar sticky top-0 z-30 border-b px-5 py-2.5 text-white lg:px-8"
        style={{ background: brandColors.ink, borderColor: "rgb(255 255 255 / 0.12)" }}
      >
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1.5">
            <p className="flex items-center gap-2 text-sm font-semibold">
              <IconEye className="h-4 w-4 shrink-0" />
              Bản xem trước — khách chưa thấy trang này
            </p>
            <span
              className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold"
              style={{ background: pill.bg, color: pill.fg }}
            >
              <pill.Icon className="h-3.5 w-3.5" />
              <span className="sr-only">Chế độ hiển thị: </span>
              {pill.label}
            </span>
          </div>
          <a
            href={editHref}
            className="inline-flex min-h-11 shrink-0 items-center justify-center gap-1.5 rounded-lg bg-white px-4 text-sm font-semibold transition hover:bg-white/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white sm:min-h-9"
            style={{ color: brandColors.ink }}
          >
            <IconChevronLeft className="h-4 w-4" />
            Quay lại chỉnh sửa
          </a>
        </div>
        {product.status === "PUBLISHED" ? (
          <p className="mt-1 text-xs text-white/80">Tài liệu đang Công khai — trang này hiển thị bản đã lưu mới nhất, giống khách đang thấy.</p>
        ) : null}
      </div>

      <div className="px-3 py-4 sm:px-5 sm:py-6 lg:px-8">
        <div
          className={`studio-preview-frame ${systemFontVars} overflow-clip rounded-2xl border font-[family-name:var(--font-body)] shadow-[0_8px_28px_-16px_rgba(15,23,42,0.25)]`}
          style={{ background: brandColors.background, color: brandColors.ink, borderColor: brandColors.line }}
        >
          <SiteHeader />
          <ProductDetailView
            tenantName={data.tenant.name}
            tenantHref={`/${data.tenant.slug}`}
            product={{
              title: product.title,
              summary: product.summary,
              description: product.description,
              type: product.type,
              tags: product.tags,
              priceVnd: product.priceVnd,
              effectivePriceVnd: product.effectivePriceVnd,
              downloadLimit: product.downloadLimit,
              coverUrl: product.coverUrl,
              imageCloudName,
              categoryName: product.categoryName,
              rating: { average: ratingSummary.average, count: ratingSummary.count },
            }}
            reviews={
              <ProductReviewsSection
                tenantName={data.tenant.name}
                summary={ratingSummary}
                items={reviewItems}
                footer={
                  <p className="rounded-xl px-4 py-3 text-sm" style={{ background: brandColors.surface, color: brandColors.ink }}>
                    Bản xem trước chỉ đọc{hasMoreReviews ? " và chỉ hiện 10 đánh giá mới nhất" : ""}. Khách đã mua viết đánh giá ngay trên trang công khai;
                    trả lời hoặc ẩn đánh giá tại{" "}
                    <a href={`/studio/${tenantSlug}/reviews`} className="font-semibold underline underline-offset-2 hover:no-underline" style={{ color: brandColors.primary }}>
                      Studio → Đánh giá
                    </a>
                    .
                  </p>
                }
              />
            }
            purchase={
              <div>
                <button
                  type="button"
                  disabled
                  aria-describedby="preview-buy-note"
                  className="inline-flex min-h-12 w-full cursor-not-allowed items-center justify-center rounded-full bg-[color:var(--color-primary)] px-8 text-[15px] font-bold text-white opacity-60"
                >
                  Mua ngay
                </button>
                <p id="preview-buy-note" className="mt-2 text-center text-xs" style={{ color: brandColors.inkSoft }}>
                  Nút mua bị tắt trong bản xem trước.
                </p>
              </div>
            }
          />
          <SiteFooter />
        </div>
      </div>
    </div>
  );
}
