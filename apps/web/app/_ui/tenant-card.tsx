import Link from "next/link";
import type { HomeFeaturedTenant } from "../../lib/home";
import {
  BLUE,
  CARD_CLASS,
  IconArrow,
  INK_SOFT,
  LINE,
  RatingInline,
  STRETCHED_LINK,
  formatCount,
  initialsOf,
  rotatingColor,
  type CardHeadingLevel,
} from "./catalog-parts";

/**
 * Dữ liệu thẻ gian hàng = `HomeFeaturedTenant` (`logoUrl` đã tối ưu, `productCount`, `ratingAvg/ratingCount` tổng,
 * `soldCount` tổng mọi thời gian, `href = /{tenantSlug}`). Trường thừa (vd `sales30d` của Cửa hàng) bị bỏ qua —
 * chủ dự án chốt: số bán 30 ngày chỉ để xếp hạng, KHÔNG hiển thị công khai (ADR-035).
 */
export type TenantCardTenant = HomeFeaturedTenant;

export interface TenantCardProps {
  tenant: TenantCardTenant;
  /** Chỉ số trong danh sách — màu nền avatar chữ xoay vòng. */
  toneIndex?: number;
  /** Cấp heading tên gian hàng (mặc định h3 dưới section H2). */
  headingLevel?: Extract<CardHeadingLevel, "h3" | "h4">;
}

/** ADR-033 mục 4 — thẻ giáo viên/coach: avatar, tên, số tài liệu, sao (khi có), "Đã bán" tổng (khi > 0), link storefront. */
export function TenantCard({ tenant: c, toneIndex = 0, headingLevel = "h3" }: TenantCardProps) {
  const Heading = headingLevel;
  return (
    <article className={`${CARD_CLASS} items-center gap-2 p-4 text-center sm:gap-2.5 sm:p-[26px]`} style={{ borderColor: LINE, outlineColor: BLUE }}>
      <div
        aria-hidden="true"
        className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-[72px] sm:w-[72px]"
        style={{ background: rotatingColor(toneIndex) }}
      >
        {c.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- ảnh đã tối ưu qua cloudinaryDeliveryUrl (ADR-028)
          <img src={c.logoUrl} alt="" width={72} height={72} loading="lazy" decoding="async" className="h-full w-full bg-white object-cover" />
        ) : (
          <span className="font-[family-name:var(--font-heading)] text-xl font-bold text-white sm:text-[22px]">{initialsOf(c.name)}</span>
        )}
      </div>
      <Heading className="line-clamp-2 text-[15px] leading-snug font-bold [overflow-wrap:anywhere] sm:text-[16.5px]">
        <Link href={c.href} className={STRETCHED_LINK}>
          {c.name}
        </Link>
      </Heading>
      <span className="rounded-full border px-3 py-0.5 text-[12.5px] tabular-nums" style={{ borderColor: LINE, color: INK_SOFT }}>
        {formatCount(c.productCount)} tài liệu
      </span>
      {c.ratingAvg !== null || c.soldCount > 0 ? (
        <div className="flex flex-col items-center gap-1 text-[13px] sm:text-[13.5px]">
          {c.ratingAvg !== null ? <RatingInline average={c.ratingAvg} count={c.ratingCount} long /> : null}
          {c.soldCount > 0 ? (
            <span className="tabular-nums" style={{ color: INK_SOFT }}>
              Đã bán {formatCount(c.soldCount)}
            </span>
          ) : null}
        </div>
      ) : null}
      <span
        aria-hidden="true"
        className="mt-auto inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full border border-[color:var(--home-line)] px-3 text-[13px] font-semibold transition-colors group-hover:border-[color:var(--brand-primary,#0F3B82)] group-hover:text-[color:var(--brand-primary,#0F3B82)] sm:text-[13.5px]"
        style={{ ["--home-line" as string]: LINE }}
      >
        Xem gian hàng <IconArrow className="h-3.5 w-3.5" />
      </span>
    </article>
  );
}
