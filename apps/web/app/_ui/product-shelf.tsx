import { useId, type ReactNode } from "react";
import Link from "next/link";
import { formatShopAvgTenths } from "@gieochu/core/shop-sections";
import { BLUE, FOCUS_RING, IconArrow, INK_SOFT, LINE, PAPER_ALT } from "./catalog-parts";
import { DocumentCard, type DocumentCardProduct } from "./document-card";
import { TenantCard, type TenantCardTenant } from "./tenant-card";

/** "Từ 3 đánh giá, điểm trung bình từ 4,0" — tiêu chí kệ Đánh giá cao (ADR-035 mục 3), in dưới tiêu đề. */
export function formatTopRatedCriteria(minReviews: number, minAvgTenths: number): string {
  return `Từ ${minReviews} đánh giá, điểm trung bình từ ${formatShopAvgTenths(minAvgTenths)}`;
}

export interface ShelfSectionProps {
  title: string;
  subtitle?: string;
  /** Dòng tiêu chí/ghi chú nhỏ dưới mô tả (vd tiêu chí kệ Đánh giá cao). */
  note?: string;
  /** Link "Xem tất cả …" ở đầu khối (một link duy nhất, ≥44px). */
  viewAll?: { href: string; label: string };
  /**
   * `h2` = section cấp trang (nền full-bleed + `container-page` + khoảng đệm dọc);
   * `h3` = khối con nằm trong một section H2 (vd từng danh mục trong "Theo từng danh mục") — không container/đệm.
   */
  headingLevel?: "h2" | "h3";
  /** Nền section H2: `paper` (trong suốt, theo nền trang) hoặc `alt` (zebra `backgroundAlt`). */
  background?: "paper" | "alt";
  children: ReactNode;
}

/** Khung section/khối có tiêu đề + mô tả + "Xem tất cả" — dùng cho kệ tài liệu, gian hàng, nhóm "Theo từng danh mục". */
export function ShelfSection({ title, subtitle, note, viewAll, headingLevel = "h2", background = "paper", children }: ShelfSectionProps) {
  const titleId = useId();
  const top = headingLevel === "h2";
  const Heading = headingLevel;

  const header = (
    <div className={`flex flex-wrap items-end justify-between gap-x-6 gap-y-3 ${top ? "mb-6 sm:mb-8" : "mb-4 sm:mb-5"}`}>
      <div className="min-w-0 max-w-[720px]">
        <Heading
          id={titleId}
          className={`font-[family-name:var(--font-heading)] font-semibold [overflow-wrap:anywhere] ${
            top ? "text-[24px] leading-tight sm:text-[28px] lg:text-[30px]" : "text-[19px] leading-snug sm:text-[21px]"
          }`}
        >
          {title}
        </Heading>
        {subtitle ? (
          <p className={`mt-2 ${top ? "text-[14.5px] sm:text-[15.5px]" : "text-sm"}`} style={{ color: INK_SOFT }}>
            {subtitle}
          </p>
        ) : null}
        {note ? (
          <p className="mt-1.5 text-[13px] font-medium" style={{ color: INK_SOFT }}>
            {note}
          </p>
        ) : null}
      </div>
      {viewAll ? (
        <Link
          href={viewAll.href}
          className={`inline-flex min-h-11 max-w-full shrink-0 items-center gap-1.5 rounded-full border bg-white px-4 text-sm font-semibold transition-colors hover:bg-[color:var(--shelf-hover)] ${FOCUS_RING}`}
          style={{ borderColor: LINE, color: BLUE, outlineColor: BLUE, ["--shelf-hover" as string]: `color-mix(in srgb, ${BLUE} 6%, white)` }}
        >
          <span className="[overflow-wrap:anywhere]">{viewAll.label}</span>
          <IconArrow className="h-4 w-4 shrink-0" />
        </Link>
      ) : null}
    </div>
  );

  if (!top) {
    return (
      <section aria-labelledby={titleId}>
        {header}
        {children}
      </section>
    );
  }
  return (
    <section aria-labelledby={titleId} className="py-10 sm:py-14 lg:py-16" style={background === "alt" ? { background: PAPER_ALT } : undefined}>
      <div className="container-page">
        {header}
        {children}
      </div>
    </section>
  );
}

export interface ProductShelfProps {
  title: string;
  subtitle?: string;
  /** Phụ đề tiêu chí (kệ Đánh giá cao) — dùng `formatTopRatedCriteria`. */
  criteria?: string;
  products: DocumentCardProduct[];
  /** Đích "Xem tất cả {tên kệ}" — thường `/cua-hang/tai-lieu?sap-xep=…` hoặc `?danh-muc=…`. Bỏ trống = không có link. */
  href?: string;
  /** Ghi đè nhãn link; mặc định "Xem tất cả {title}". */
  viewAllLabel?: string;
  /** Kệ Bán chạy: hiện nhãn chữ "#1", "#2"… theo thứ tự. */
  ranked?: boolean;
  /** `h2` = kệ cấp trang; `h3` = khối trong "Theo từng danh mục" (thẻ tự xuống h4). */
  headingLevel?: "h2" | "h3";
  background?: "paper" | "alt";
  /** Số thẻ tối đa ở desktop (≥ lg, 4 cột). Mặc định 8. */
  desktopLimit?: number;
  /** Số thẻ hiện ở mobile/tablet (< lg, 2 cột). Mặc định 4; thẻ dư ẩn bằng `display:none` (không vào cây a11y). */
  mobileLimit?: number;
}

/** Kệ tài liệu: lưới 2 cột (< lg) / 4 cột (≥ lg), thẻ `compact`. Danh sách rỗng → không render gì. */
export function ProductShelf({
  title,
  subtitle,
  criteria,
  products,
  href,
  viewAllLabel,
  ranked = false,
  headingLevel = "h2",
  background,
  desktopLimit = 8,
  mobileLimit = 4,
}: ProductShelfProps) {
  const items = products.slice(0, Math.max(0, desktopLimit));
  if (items.length === 0) return null;
  const cardHeading = headingLevel === "h2" ? "h3" : "h4";

  return (
    <ShelfSection
      title={title}
      subtitle={subtitle}
      note={criteria}
      viewAll={href ? { href, label: viewAllLabel ?? `Xem tất cả ${title}` } : undefined}
      headingLevel={headingLevel}
      background={background}
    >
      <ul className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
        {items.map((product, i) => (
          <li key={product.id} className={i >= mobileLimit ? "hidden lg:block" : undefined}>
            <DocumentCard product={product} toneIndex={i} headingLevel={cardHeading} rank={ranked ? i + 1 : undefined} density="compact" />
          </li>
        ))}
      </ul>
    </ShelfSection>
  );
}

export interface TenantShelfProps {
  title: string;
  subtitle?: string;
  tenants: TenantCardTenant[];
  href?: string;
  viewAllLabel?: string;
  background?: "paper" | "alt";
}

/** Kệ "Gian hàng nổi bật": lưới 2 cột (< lg) / 4 cột (≥ lg) thẻ `TenantCard` (tổng đã bán + sao). Rỗng → không render. */
export function TenantShelf({ title, subtitle, tenants, href, viewAllLabel, background }: TenantShelfProps) {
  if (tenants.length === 0) return null;
  return (
    <ShelfSection title={title} subtitle={subtitle} viewAll={href ? { href, label: viewAllLabel ?? `Xem tất cả ${title}` } : undefined} background={background}>
      <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-6">
        {tenants.map((tenant, i) => (
          <li key={tenant.id}>
            <TenantCard tenant={tenant} toneIndex={i} />
          </li>
        ))}
      </ul>
    </ShelfSection>
  );
}
