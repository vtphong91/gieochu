import type { StorefrontProductsData } from "@gieochu/core";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { productTypeLabel } from "@gieochu/core/product-type";
import { productPath } from "@gieochu/core/product-path";
import type { PublicProduct } from "../../../lib/storefront";
import { IconDoc } from "../../admin/_ui/icons";
import { IconStar, ProductTypeIcon } from "./icons";
import { formatRatingAverage } from "./review-parts";
import { CONTAINER, SectionHeading, pillClass } from "./primitives";

const vnd = new Intl.NumberFormat("vi-VN");

function formatVnd(amount: number): string {
  return `${vnd.format(amount)} ₫`;
}

/** Giá trên dải tối của thẻ ảnh — chữ trắng / trắng mờ (đã đạt tương phản trên nền ≥ 75% đen). */
function PriceLine({ product }: { product: PublicProduct }) {
  const free = product.effectivePriceVnd === 0;
  return (
    <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
      {product.onSale ? <span className="sr-only">Giá khuyến mãi </span> : null}
      <span className="text-base font-extrabold">{free ? "Miễn phí" : formatVnd(product.effectivePriceVnd)}</span>
      {product.onSale ? (
        <span className="text-sm font-medium text-white/80 line-through">
          <span className="sr-only">, giá gốc </span>
          {formatVnd(product.priceVnd)}
        </span>
      ) : null}
    </p>
  );
}

/** ADR-029 mục 3: "★ 4,6 (12)" khi có ≥ 1 đánh giá — sao vàng nhạt + chữ trắng trên dải tối (đạt tương phản). */
function RatingLine({ average, count }: { average: number; count: number }) {
  const avg = formatRatingAverage(average);
  return (
    <p className="flex items-center gap-1 text-sm font-semibold tabular-nums">
      <IconStar filled className="h-4 w-4 text-amber-300" />
      <span aria-hidden="true">{avg}</span>
      <span aria-hidden="true" className="font-normal text-white/80">
        ({vnd.format(count)})
      </span>
      <span className="sr-only">
        Điểm trung bình {avg} trên 5 sao, {vnd.format(count)} đánh giá
      </span>
    </p>
  );
}

/**
 * Thẻ "Recent Work" của mẫu: ảnh bìa phủ kín thẻ bo góc + bóng nhẹ. Để vẫn là
 * thẻ bán hàng, tên + giá nằm trên dải gradient tối ở đáy ảnh (≥ 75% đen dưới
 * chữ → chữ trắng đạt AA với mọi ảnh), nhãn loại tài liệu là chip góc trên phải. Mô tả ngắn (ADR-027 §2)
 * nằm dưới tên, cắt 2 dòng; thẻ tỉ lệ 4:3 dưới lg để dải chữ không phủ gần hết ảnh khi thẻ hẹp.
 * Không có ảnh bìa → nền gradient primary→accent nhạt + icon loại tài liệu.
 */
function ProductCard({ product, href }: { product: PublicProduct; href: string }) {
  const discountPercent =
    product.onSale && product.priceVnd > 0 ? Math.max(1, Math.round((1 - product.effectivePriceVnd / product.priceVnd) * 100)) : 0;

  return (
    <li className="group relative aspect-[4/3] overflow-hidden lg:aspect-[16/10] rounded-xl bg-[color:var(--sf-primary-soft)] shadow-[0_8px_28px_-12px_rgba(15,23,42,0.35)] transition-[transform,box-shadow] duration-200 hover:shadow-[0_16px_36px_-14px_rgba(15,23,42,0.45)] motion-safe:hover:-translate-y-1 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-3 has-[a:focus-visible]:outline-[color:var(--sf-focus)]">
      {product.coverUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- host ảnh động (bucket public do admin cấu hình)
        <img
          src={cloudinaryDeliveryUrl(product.coverUrl, { width: 800 })}
          alt=""
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 motion-safe:group-hover:scale-[1.04]"
        />
      ) : (
        <div
          aria-hidden="true"
          className="absolute inset-0 flex items-start justify-center pt-[12%]"
          style={{
            background: "linear-gradient(135deg, var(--sf-primary-soft) 0%, color-mix(in srgb, var(--sf-accent) 22%, white) 100%)",
            color: "var(--sf-primary-text)",
          }}
        >
          <ProductTypeIcon type={product.type} className="h-12 w-12 opacity-60" />
        </div>
      )}

      <span className="absolute top-3 right-3 inline-flex items-center gap-1.5 rounded-full bg-white/95 px-2.5 py-1 text-xs font-semibold text-[color:var(--sf-ink)] shadow-sm">
        <ProductTypeIcon type={product.type} className="h-3.5 w-3.5" />
        {productTypeLabel(product.type)}
      </span>
      {discountPercent > 0 ? (
        <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm" style={{ background: "var(--sf-red)" }}>
          Giảm {discountPercent}%
        </span>
      ) : null}

      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-black/75 px-4 pt-2.5 pb-3.5 text-white before:pointer-events-none before:absolute before:inset-x-0 before:bottom-full before:h-10 before:bg-gradient-to-t before:from-black/75 before:to-transparent before:content-['']">
        <h3 className="font-[family-name:var(--font-heading)] line-clamp-2 text-[15px] leading-snug font-bold [overflow-wrap:anywhere]">
          {/* Stretched link: cả thẻ bấm được, tên truy cập của link chỉ là tiêu đề. */}
          <a href={href} className="outline-none after:absolute after:inset-0 after:content-['']">
            {product.title}
          </a>
        </h3>
        {product.summary ? (
          <p className="mt-1 line-clamp-2 text-sm leading-snug text-white/85 [overflow-wrap:anywhere]">{product.summary}</p>
        ) : null}
        <div className="mt-1 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <PriceLine product={product} />
          {product.ratingCount >= 1 && product.ratingAvg !== null ? <RatingLine average={product.ratingAvg} count={product.ratingCount} /> : null}
        </div>
      </div>
    </li>
  );
}

export function ProductsSection({
  anchorId,
  data,
  tenantSlug,
  products,
  viewAllHref,
}: {
  anchorId: string;
  data: StorefrontProductsData;
  tenantSlug: string;
  products: PublicProduct[];
  /** Trang danh sách đầy đủ (chưa có) — undefined = ẩn nút "Xem tất cả". */
  viewAllHref?: string;
}) {
  const titleId = `${anchorId}-title`;
  return (
    <section id={anchorId} aria-labelledby={titleId} className="py-16 sm:py-20" style={{ background: "var(--sf-hero-bg)" }}>
      <div className={CONTAINER}>
        <SectionHeading id={titleId} title={data.title} subtitle={products.length > 0 ? data.subtitle : undefined} />

        {products.length === 0 ? (
          <div className="mx-auto mt-10 flex max-w-md flex-col items-center rounded-2xl border-2 border-dashed bg-white px-6 py-12 text-center" style={{ borderColor: "var(--sf-line)" }}>
            <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: "var(--sf-primary-soft)", color: "var(--sf-primary-text)" }}>
              <IconDoc className="h-8 w-8" />
            </span>
            <p className="mt-5 text-base font-semibold">Chưa có tài liệu nào được đăng.</p>
            <p className="mt-1 text-sm" style={{ color: "var(--sf-ink-soft)" }}>
              Hãy quay lại sau để xem tài liệu mới nhé.
            </p>
          </div>
        ) : (
          <ul className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} href={productPath(tenantSlug, product.slug)} />
            ))}
          </ul>
        )}

        {viewAllHref && data.ctaLabel && products.length > 0 ? (
          <div className="mt-12 text-center">
            <a href={viewAllHref} className={pillClass("primary")}>
              {data.ctaLabel}
            </a>
          </div>
        ) : null}
      </div>
    </section>
  );
}
