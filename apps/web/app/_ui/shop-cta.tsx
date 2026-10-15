import Link from "next/link";
import type { ShopCtaOpenStoreData } from "@gieochu/core/shop-sections";
import { AMBER, AMBER_SOFT, BLUE, BLUE_DEEP, FOCUS_RING, IconArrow, IconDocs, IconStorefront, INK, INK_SOFT, LINE } from "./catalog-parts";

/** Nút chính màu accent — chữ nâu đậm trên cam (≥ 4.5:1, giống CTA trang chủ). */
const ACCENT_BUTTON =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-full px-7 text-[15px] font-bold transition-[filter] hover:brightness-105 sm:text-base [touch-action:manipulation]";
const ACCENT_TEXT = "#241503";

export interface ShopEmptyStateProps {
  /** Mặc định "Cửa hàng chưa có tài liệu nào". */
  title?: string;
  description?: string;
  /** CTA mở gian hàng; `null` = ẩn (vd người xem đã là chủ/thành viên gian hàng). */
  cta?: { label: string; href: string } | null;
  /** Link phụ (vd quay về trang chủ). */
  secondary?: { label: string; href: string };
  /** Cấp heading tiêu đề khối (mặc định h2 — trang vẫn có H1 ở hero). */
  headingLevel?: "h1" | "h2";
}

/**
 * Trạng thái rỗng toàn trang Cửa hàng (chưa có tài liệu Công khai nào): icon + tiêu đề + mô tả + CTA mở gian hàng.
 * Không chỉ nói "không có" — luôn kèm hướng đi tiếp (CTA hoặc link phụ).
 */
export function ShopEmptyState({
  title = "Cửa hàng chưa có tài liệu nào",
  description = "Các giáo viên và coach đang chuẩn bị tài liệu. Hãy quay lại sau — hoặc mở gian hàng để là người đầu tiên đăng bán.",
  cta = { label: "Mở gian hàng miễn phí", href: "/register" },
  secondary,
  headingLevel = "h2",
}: ShopEmptyStateProps) {
  const Heading = headingLevel;
  return (
    <section className="py-14 sm:py-20">
      <div className="container-page">
        <div className="mx-auto flex max-w-[560px] flex-col items-center rounded-3xl border bg-white px-6 py-10 text-center sm:px-10 sm:py-12" style={{ borderColor: LINE, color: INK }}>
          <span aria-hidden="true" className="flex h-16 w-16 items-center justify-center rounded-2xl" style={{ background: AMBER_SOFT, color: AMBER }}>
            <IconDocs className="h-8 w-8" />
          </span>
          <Heading className="mt-5 font-[family-name:var(--font-heading)] text-[22px] leading-snug font-semibold sm:text-[26px]">{title}</Heading>
          <p className="mt-3 text-[14.5px] leading-[1.65] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
            {description}
          </p>
          {cta || secondary ? (
            <div className="mt-7 flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-center">
              {cta ? (
                <Link href={cta.href} className={`${ACCENT_BUTTON} ${FOCUS_RING}`} style={{ background: AMBER, color: ACCENT_TEXT, outlineColor: BLUE }}>
                  {cta.label}
                </Link>
              ) : null}
              {secondary ? (
                <Link
                  href={secondary.href}
                  className={`inline-flex min-h-12 items-center justify-center gap-1.5 rounded-full border px-6 text-[15px] font-semibold ${FOCUS_RING}`}
                  style={{ borderColor: LINE, color: BLUE, outlineColor: BLUE }}
                >
                  {secondary.label} <IconArrow className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export interface OpenStoreCtaProps {
  /** Nội dung section `ctaOpenStore` của CMS Cửa hàng. */
  data: ShopCtaOpenStoreData;
}

/** Section CTA "Mở gian hàng" cuối trang Cửa hàng — khối nền tối bo góc, minh hoạ chỉ hiện từ `sm`. */
export function OpenStoreCta({ data }: OpenStoreCtaProps) {
  return (
    <section className="py-10 sm:py-14 lg:py-16">
      <div className="container-page">
        <div
          className="flex flex-col gap-8 rounded-[28px] p-7 sm:flex-row sm:items-center sm:justify-between sm:p-10 lg:p-14"
          style={{ background: `linear-gradient(120deg, ${BLUE_DEEP} 0%, color-mix(in srgb, ${BLUE} 45%, ${BLUE_DEEP}) 100%)` }}
        >
          <div className="min-w-0 sm:max-w-[620px]">
            <p className="text-[12.5px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_SOFT }}>
              {data.eyebrow}
            </p>
            <h2 className="mt-3 font-[family-name:var(--font-heading)] text-2xl leading-[1.3] font-semibold text-balance text-white [overflow-wrap:anywhere] sm:text-[28px] lg:text-[32px]">
              {data.title}
            </h2>
            <p className="mt-3 text-[14.5px] leading-[1.65] text-white/80 sm:text-[15.5px]">{data.description}</p>
            <Link
              href={data.cta.href}
              className={`${ACCENT_BUTTON} mt-6 w-full outline-offset-2 focus-visible:outline-2 focus-visible:outline-white sm:w-auto`}
              style={{ background: AMBER, color: ACCENT_TEXT }}
            >
              {data.cta.label}
            </Link>
          </div>
          <div aria-hidden="true" className="relative hidden h-[180px] w-[200px] shrink-0 sm:block lg:h-[200px] lg:w-[240px]">
            <div className="absolute top-0 right-0 h-[160px] w-[160px] rounded-full bg-white/[0.06] lg:h-[190px] lg:w-[190px]" />
            <div className="absolute top-8 left-2 flex w-[170px] rotate-3 flex-col items-center gap-3 rounded-2xl bg-white p-5 lg:w-[200px]" style={{ boxShadow: "0 24px 50px rgba(0,0,0,0.35)" }}>
              <span className="flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: AMBER_SOFT, color: AMBER }}>
                <IconStorefront className="h-6 w-6" />
              </span>
              <div className="h-2.5 w-[80%] rounded-full" style={{ background: LINE }} />
              <div className="h-2.5 w-[60%] rounded-full" style={{ background: LINE }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
