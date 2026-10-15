import Link from "next/link";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import type { HomeFeaturedProduct } from "../../lib/home";
import {
  BLUE,
  CARD_CLASS,
  INK,
  INK_SOFT,
  IconArrow,
  IconDocs,
  LINE,
  RatingInline,
  SALE_RED,
  STRETCHED_LINK,
  discountPercentOf,
  formatCount,
  formatVnd,
  initialsOf,
  pastelOf,
  rotatingColor,
  type CardHeadingLevel,
} from "./catalog-parts";

/**
 * Dữ liệu thẻ tài liệu: `HomeFeaturedProduct` (PublicProduct + `tenant {slug,name}` + `href` dựng bằng `productPath`)
 * + `typeLabel` tuỳ chọn (Cửa hàng truyền `ShopProduct.typeLabel`; trang chủ không có → không hiện nhãn loại).
 */
export type DocumentCardProduct = HomeFeaturedProduct & { typeLabel?: string };

export interface DocumentCardProps {
  product: DocumentCardProduct;
  /** Chỉ số trong danh sách — chọn màu nền trang trí xoay vòng (khi không có ảnh bìa) và avatar gian hàng. */
  toneIndex?: number;
  /** Cấp heading của tên tài liệu: h3 dưới section H2; h4 trong khối H3 ("Theo từng danh mục"). Mặc định h3. */
  headingLevel?: Extract<CardHeadingLevel, "h3" | "h4">;
  /** Thứ hạng hiển thị dạng chữ "#1" (kệ Bán chạy). Bỏ trống = không hiện. */
  rank?: number;
  /** `default` = thẻ trang chủ (lưới 1–3 cột); `compact` = lưới dày 2 cột mobile / 4 cột desktop (Cửa hàng). */
  density?: "default" | "compact";
}

const DENSITY = {
  default: {
    card: "",
    badges: "top-3 right-3 left-3",
    typeLabel: "bottom-3 left-3",
    body: "p-5 sm:p-[22px]",
    title: "text-[15px] leading-[1.4] sm:text-base",
    seller: "mt-2 gap-2 text-[13.5px]",
    avatar: "h-[22px] w-[22px] text-[10px]",
    meta: "mt-2.5 gap-x-2 text-[13px]",
    footer: "pt-4",
    price: "text-[17px] sm:text-[18px]",
    oldPrice: "text-[13px]",
    icon: "h-12 w-12 sm:h-14 sm:w-14",
  },
  compact: {
    card: "rounded-2xl",
    badges: "top-2 right-2 left-2",
    typeLabel: "bottom-2 left-2",
    body: "p-3 sm:p-4",
    title: "text-[14px] leading-[1.4] sm:text-[15px]",
    seller: "mt-1.5 gap-1.5 text-[13px]",
    avatar: "h-5 w-5 text-[10px]",
    meta: "mt-2 gap-x-3 text-[12.5px]",
    footer: "pt-3",
    price: "text-[15px] sm:text-[16.5px]",
    oldPrice: "text-[12.5px]",
    icon: "h-10 w-10 sm:h-12 sm:w-12",
  },
} as const;

/**
 * Thẻ tài liệu công khai (ADR-033 mục 4, ADR-035 mục 7) — ảnh bìa tối ưu, tên, gian hàng, giá hiệu lực + % giảm,
 * sao + số đánh giá, "Đã bán N" (ẩn khi 0), nhãn loại, thứ hạng. Một link duy nhất (stretched) tới `product.href`.
 * Trả về `<article>`; phần tử danh sách (`<li>`) và lưới do nơi dùng quyết định.
 */
export function DocumentCard({ product: d, toneIndex = 0, headingLevel = "h3", rank, density = "default" }: DocumentCardProps) {
  const s = DENSITY[density];
  const Heading = headingLevel;
  const tone = rotatingColor(toneIndex);
  const free = d.effectivePriceVnd === 0;
  const discountPercent = discountPercentOf(d);
  const showRank = rank !== undefined && rank > 0;
  const hasBadges = showRank || discountPercent > 0;
  const compact = density === "compact";

  return (
    <article className={`${CARD_CLASS} ${s.card}`} style={{ borderColor: LINE, outlineColor: BLUE }}>
      <div className="relative flex aspect-[16/10] items-center justify-center" style={{ background: pastelOf(tone), color: tone }}>
        {d.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh đã tối ưu qua cloudinaryDeliveryUrl (ADR-028)
          <img
            src={cloudinaryDeliveryUrl(d.coverUrl, { width: 640 })}
            alt=""
            width={640}
            height={400}
            loading="lazy"
            decoding="async"
            className="absolute inset-0 h-full w-full object-cover"
          />
        ) : (
          <IconDocs className={`${s.icon} opacity-80`} />
        )}
        {hasBadges ? (
          // Nhãn chữ (không chỉ dùng màu): thứ hạng, % giảm — xuống dòng khi thẻ hẹp, không tràn.
          <div className={`absolute flex flex-wrap items-start gap-1.5 ${s.badges}`}>
            {showRank ? (
              <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white tabular-nums shadow-sm" style={{ background: BLUE }}>
                <span aria-hidden="true">#{rank}</span>
                <span className="sr-only">Hạng {rank}</span>
              </span>
            ) : null}
            {discountPercent > 0 ? (
              <span className="rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm" style={{ background: SALE_RED }}>
                Giảm {discountPercent}%
              </span>
            ) : null}
          </div>
        ) : null}
        {d.typeLabel ? (
          // Góc dưới ảnh bìa — tách khỏi nhóm nhãn trên để không đè nhau khi thẻ hẹp (2 cột ở 360px).
          <span className={`absolute max-w-[calc(100%-1rem)] truncate rounded-full bg-white px-2.5 py-1 text-xs font-semibold shadow-sm ${s.typeLabel}`} style={{ color: INK }}>
            <span className="sr-only">Loại tài liệu: </span>
            {d.typeLabel}
          </span>
        ) : null}
      </div>
      <div className={`flex grow flex-col ${s.body}`}>
        <Heading className={`line-clamp-2 font-bold [overflow-wrap:anywhere] ${s.title}`}>
          <Link href={d.href} className={STRETCHED_LINK}>
            {d.title}
          </Link>
        </Heading>
        <p className={`flex min-w-0 items-center ${s.seller}`} style={{ color: INK_SOFT }}>
          <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-bold text-white ${s.avatar}`} style={{ background: tone }}>
            {initialsOf(d.tenant.name).slice(0, 1)}
          </span>
          <span className="sr-only">Người bán: </span>
          <span className="truncate" title={d.tenant.name}>
            {d.tenant.name}
          </span>
        </p>
        {d.ratingAvg !== null || d.soldCount > 0 ? (
          <p className={`flex flex-wrap items-center gap-y-1 ${s.meta}`}>
            {d.ratingAvg !== null ? <RatingInline average={d.ratingAvg} count={d.ratingCount} /> : null}
            {/* Thẻ compact hẹp: "Đã bán" hay xuống dòng → bỏ dấu "·" để không treo cuối dòng. */}
            {d.ratingAvg !== null && d.soldCount > 0 && !compact ? (
              <span aria-hidden="true" style={{ color: INK_SOFT }}>
                ·
              </span>
            ) : null}
            {d.soldCount > 0 ? (
              <span className="tabular-nums" style={{ color: INK_SOFT }}>
                Đã bán {formatCount(d.soldCount)}
              </span>
            ) : null}
          </p>
        ) : null}
        <div className={`mt-auto flex items-end justify-between gap-3 ${s.footer}`}>
          <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
            {d.onSale ? <span className="sr-only">Giá khuyến mãi </span> : null}
            <span className={`font-[family-name:var(--font-heading)] font-bold ${s.price}`} style={{ color: BLUE }}>
              {free ? "Miễn phí" : formatVnd(d.effectivePriceVnd)}
            </span>
            {d.onSale ? (
              <span className={`line-through ${s.oldPrice}`} style={{ color: INK_SOFT }}>
                <span className="sr-only">, giá gốc </span>
                {formatVnd(d.priceVnd)}
              </span>
            ) : null}
          </p>
          {compact ? null : (
            <span aria-hidden="true" className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors" style={{ borderColor: LINE }}>
              Xem chi tiết <IconArrow className="h-3.5 w-3.5" />
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
