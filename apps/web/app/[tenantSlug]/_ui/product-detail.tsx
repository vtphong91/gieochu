import type { ReactNode } from "react";
import type { ProductType } from "@gieochu/db";
import { brandColors } from "@gieochu/config/theme";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { productTypeLabel } from "@gieochu/core/product-type";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import { ProductTypeIcon } from "./icons";
import { ProductRatingInline } from "./product-reviews";

/*
 * Thân trang chi tiết tài liệu — dùng CHUNG cho trang công khai `/[tenantSlug]/[productSlug]` và trang
 * Xem trước trong Studio (ADR-027 §5) để hai nơi luôn khớp nhau. Trang hệ thống (ADR-025): màu + font hệ thống.
 *
 * CHỈ dùng trong Server Component: mô tả chi tiết được sanitize lại lúc render bằng `sanitizeRichTextHtml`
 * (lớp phòng thủ thứ hai — Server Action đã sanitize khi lưu; dữ liệu cũ trước Tiptap có thể là text thuần
 * hoặc chưa qua sanitize). Không import file này từ Client Component (kéo `sanitize-html` vào bundle trình duyệt).
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const AMBER = brandColors.accent;
const SURFACE = brandColors.surface;
const ACCENT_SOFT = brandColors.accentSoft;

const vnd = new Intl.NumberFormat("vi-VN");

/** Cùng định dạng giá với thẻ tài liệu trên trang tenant (`products.tsx`). */
function formatVnd(amount: number): string {
  return `${vnd.format(amount)} ₫`;
}

const HTML_TAG = /<\/?[a-z][\s\S]*?>/i;

type PreparedDescription = { kind: "text"; text: string } | { kind: "html"; html: string } | null;

/** ADR-028 §4: ảnh trong mô tả phục vụ qua f_auto,q_auto,c_limit,w_1200 (cột mô tả ~700px, đủ nét màn hình 2x cỡ vừa). */
const DESCRIPTION_IMAGE_WIDTH = 1200;

/**
 * Mô tả chi tiết: HTML Tiptap (sanitize lại) hoặc text thuần dữ liệu cũ. Không có nội dung hiển thị → null.
 * ADR-028: ảnh ngoài Cloudinary hệ thống bị loại, ảnh hợp lệ được viết lại URL tối ưu.
 */
function prepareDescription(value: string | null, imageCloudName: string | null): PreparedDescription {
  const raw = value?.trim() ?? "";
  if (!raw) return null;
  if (!HTML_TAG.test(raw)) return { kind: "text", text: raw };
  const html = sanitizeRichTextHtml(raw, { imageCloudName, imageWidth: DESCRIPTION_IMAGE_WIDTH });
  // Tiptap lưu "<p></p>" khi người dùng xoá hết chữ — coi như chưa có mô tả.
  const hasContent = /<img/i.test(html) || html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").trim() !== "";
  return hasContent ? { kind: "html", html } : null;
}

export interface ProductDetailData {
  title: string;
  summary: string | null;
  description: string | null;
  type: ProductType;
  tags: string[];
  /** Giá niêm yết, VND nguyên. */
  priceVnd: number;
  /** Giá áp dụng lúc render (đã tính khuyến mãi ở server). */
  effectivePriceVnd: number;
  downloadLimit: number;
  coverUrl: string | null;
  /** ADR-028: cloud name Cloudinary hệ thống (`getSystemCloudinaryCloudName()`) — lọc ảnh trong mô tả; null = loại mọi ảnh. */
  imageCloudName: string | null;
  /** undefined = không hiển thị dòng danh mục (trang công khai chưa có dữ liệu này). */
  categoryName?: string | null;
  /** ADR-029: điểm TB + số đánh giá (cache `ratingSum/ratingCount`); undefined/0 = không hiện dòng sao dưới tiêu đề. */
  rating?: { average: number | null; count: number };
}

export function ProductDetailView({
  tenantName,
  tenantHref,
  product,
  purchase,
  reviews,
}: {
  tenantName: string;
  tenantHref: string;
  product: ProductDetailData;
  /** Khối nút mua / thông báo — trang công khai truyền BuyButton, trang xem trước truyền nút bị vô hiệu. */
  purchase: ReactNode;
  /** ADR-029: khối "Đánh giá" (`ProductReviewsSection`) — nằm dưới mô tả, cột trái. */
  reviews?: ReactNode;
}) {
  const onSale = product.effectivePriceVnd < product.priceVnd;
  const isFree = product.effectivePriceVnd === 0;
  const discountPercent = onSale && product.priceVnd > 0 ? Math.max(1, Math.round((1 - product.effectivePriceVnd / product.priceVnd) * 100)) : 0;
  const typeLabel = productTypeLabel(product.type);
  const description = prepareDescription(product.description, product.imageCloudName);

  return (
    <div className="container-page pt-4 pb-16 sm:pt-6 sm:pb-20">
      <nav aria-label="Đường dẫn">
        <ol className="flex flex-wrap items-center gap-x-1 text-sm" style={{ color: INK_SOFT }}>
          <li>
            <a
              href={tenantHref}
              className="inline-flex min-h-11 items-center rounded-full pr-1 font-medium hover:text-[color:var(--color-primary)] hover:underline"
            >
              <span aria-hidden="true">←&nbsp;</span>
              {tenantName}
            </a>
          </li>
        </ol>
      </nav>

      {/*
        Bố cục thương mại (ADR-024): lg — ảnh bìa + mô tả (+ đánh giá, ADR-029) cột trái 7/12, khối mua cột phải
        5/12 dính khi cuộn suốt các hàng cột trái (top 112px = header hệ thống 88px + 24px). Thứ tự DOM = thứ tự
        trên mobile (ảnh → khối mua → mô tả → đánh giá), trùng thứ tự Tab.
      */}
      <div className="mt-2 grid grid-cols-1 gap-8 lg:grid-cols-12 lg:gap-x-12 lg:gap-y-12">
        <div className="lg:col-span-7 lg:row-start-1">
          <div className="relative aspect-[16/10] overflow-hidden rounded-2xl shadow-[0_8px_28px_-12px_rgba(15,23,42,0.35)]" style={{ background: SURFACE }}>
            {product.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- host ảnh động (Cloudinary / bucket public do admin cấu hình)
              <img
                src={cloudinaryDeliveryUrl(product.coverUrl, { width: 1200 })}
                alt={`Ảnh bìa ${product.title}`}
                fetchPriority="high"
                decoding="async"
                className="absolute inset-0 h-full w-full object-cover"
              />
            ) : (
              <div
                aria-hidden="true"
                className="absolute inset-0 flex flex-col items-center justify-center gap-3"
                style={{ background: `linear-gradient(135deg, ${SURFACE} 0%, ${ACCENT_SOFT} 100%)`, color: BLUE }}
              >
                <ProductTypeIcon type={product.type} className="h-16 w-16 opacity-60 sm:h-20 sm:w-20" />
                <span className="font-[family-name:var(--font-heading)] text-sm font-bold tracking-[0.08em] uppercase opacity-80">{typeLabel}</span>
              </div>
            )}
          </div>
        </div>

        <div className={`self-start lg:sticky lg:top-[112px] lg:col-span-5 lg:col-start-8 lg:row-start-1 ${reviews ? "lg:row-span-3" : "lg:row-span-2"}`}>
          <div className="rounded-2xl border bg-white p-5 shadow-[0_8px_28px_-16px_rgba(15,23,42,0.25)] sm:p-7" style={{ borderColor: LINE }}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold" style={{ background: SURFACE, color: BLUE }}>
                <ProductTypeIcon type={product.type} className="h-3.5 w-3.5" />
                {typeLabel}
              </span>
              {discountPercent > 0 ? <span className="rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">Giảm {discountPercent}%</span> : null}
            </div>

            <h1 className="font-[family-name:var(--font-heading)] mt-4 text-2xl leading-tight font-extrabold text-balance [overflow-wrap:anywhere] sm:text-3xl">
              {product.title}
            </h1>
            {product.rating ? <ProductRatingInline average={product.rating.average} ratingCount={product.rating.count} /> : null}
            {product.summary ? (
              <p className="mt-3 text-[15px] leading-relaxed [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                {product.summary}
              </p>
            ) : null}

            <p className="mt-5 flex flex-wrap items-baseline gap-x-3 gap-y-1 tabular-nums">
              {onSale ? <span className="sr-only">Giá khuyến mãi </span> : null}
              <span className="font-[family-name:var(--font-heading)] text-3xl font-extrabold" style={{ color: BLUE }}>
                {isFree ? "Miễn phí" : formatVnd(product.effectivePriceVnd)}
              </span>
              {onSale ? (
                <span className="text-base font-medium line-through" style={{ color: INK_SOFT }}>
                  <span className="sr-only">, giá gốc </span>
                  {formatVnd(product.priceVnd)}
                </span>
              ) : null}
            </p>

            <div className="mt-6">{purchase}</div>

            <dl className="mt-6 border-t text-sm" style={{ borderColor: LINE }}>
              {product.categoryName !== undefined ? (
                <div className="flex justify-between gap-4 py-3">
                  <dt style={{ color: INK_SOFT }}>Danh mục</dt>
                  <dd className="text-right font-medium [overflow-wrap:anywhere]">{product.categoryName ?? "Chưa chọn"}</dd>
                </div>
              ) : null}
              <div className={`flex justify-between gap-4 py-3 ${product.categoryName !== undefined ? "border-t" : ""}`} style={{ borderColor: LINE }}>
                <dt style={{ color: INK_SOFT }}>Loại tài liệu</dt>
                <dd className="text-right font-medium">{typeLabel}</dd>
              </div>
              <div className="flex justify-between gap-4 border-t py-3" style={{ borderColor: LINE }}>
                <dt style={{ color: INK_SOFT }}>Lượt tải</dt>
                <dd className="text-right font-medium">{product.downloadLimit === 0 ? "Không giới hạn" : `Tối đa ${vnd.format(product.downloadLimit)} lượt`}</dd>
              </div>
            </dl>

            {product.tags.length > 0 ? (
              <div className="border-t pt-4" style={{ borderColor: LINE }}>
                <p id="the-tai-lieu" className="text-sm" style={{ color: INK_SOFT }}>
                  Thẻ
                </p>
                <ul aria-labelledby="the-tai-lieu" className="mt-2 flex flex-wrap gap-2">
                  {product.tags.map((tag) => (
                    <li key={tag} className="rounded-full border px-3 py-1 text-xs font-medium [overflow-wrap:anywhere]" style={{ borderColor: LINE, color: INK }}>
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </div>

        <section aria-labelledby="mo-ta-tai-lieu" className="lg:col-span-7 lg:row-start-2">
          <h2 id="mo-ta-tai-lieu" className="font-[family-name:var(--font-heading)] text-xl font-extrabold sm:text-2xl">
            Giới thiệu tài liệu
          </h2>
          <span aria-hidden="true" className="mt-3 block h-[3px] w-[45px] rounded-full" style={{ background: AMBER }} />
          <div className="mt-5">
            {description?.kind === "html" ? (
              <div
                className="gieochu-rich-content max-w-prose [overflow-wrap:anywhere]"
                // HTML đã qua sanitizeRichTextHtml trong prepareDescription (whitelist khớp bộ extension Tiptap).
                dangerouslySetInnerHTML={{ __html: description.html }}
              />
            ) : description?.kind === "text" ? (
              <p className="max-w-prose text-[15px] leading-[1.75] whitespace-pre-line [overflow-wrap:anywhere] sm:text-base">{description.text}</p>
            ) : (
              <p className="max-w-prose text-[15px] sm:text-base" style={{ color: INK_SOFT }}>
                Tài liệu này chưa có mô tả chi tiết.
              </p>
            )}
          </div>
        </section>

        {reviews ? <div className="min-w-0 lg:col-span-7 lg:row-start-3">{reviews}</div> : null}
      </div>
    </div>
  );
}
