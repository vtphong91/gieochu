import { useId } from "react";
import Link from "next/link";
import type { HomeSection } from "@gieochu/core";
import { brandColors } from "@gieochu/config/theme";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import type { HomeFeaturedProduct, HomeFeaturedTenant, HomeSearchCategory, HomeStatItem } from "../lib/home";

const INK_SOFT = brandColors.inkSoft;
const PAPER_ALT = brandColors.backgroundAlt;
const INK = brandColors.ink;
const LINE = brandColors.line;
const BLUE = brandColors.primary;
const BLUE_DEEP = brandColors.primaryDeep;
const AMBER = brandColors.accent;
const AMBER_SOFT = brandColors.accentSoft;
const GREEN = brandColors.secondary;

// Bảng màu trang trí cố định, xoay vòng theo chỉ số phần tử — không phải nội
// dung (không cho admin đổi), giữ đúng nguyên tắc chỉ text/link/ảnh mới là
// editable, còn màu sắc/bố cục vẫn do code quyết định.
const ROTATING_COLORS = [BLUE, AMBER, GREEN, BLUE_DEEP];

function IconSprout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V11" />
      <path d="M12 11c0-4 3-6 7-6 0 4-2 7-7 7Z" />
      <path d="M12 14c0-3.2-2.4-5-6-5 0 3.2 2 5.6 6 5Z" />
    </svg>
  );
}

function IconPalette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-1 2-2 0-.6-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-7.7-9-7.7Z" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" />
    </svg>
  );
}

function IconCheck({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

function IconArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

function IconSearch({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

function IconChevron({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

function IconDocs({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3.5h6.5L19 8v11.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M14.2 3.5V8h4.6" />
      <path d="M9.5 12.5h5M9.5 15.5h5M9.5 18h3" />
    </svg>
  );
}

function IconStar({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden="true">
      <path d="M12 2.8l2.7 5.6 6.1.8-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.8Z" />
    </svg>
  );
}

function Stars({ count = 5, className }: { count?: number; className?: string }) {
  return (
    <div className={`flex gap-0.5 ${className ?? ""}`} style={{ color: AMBER }}>
      {Array.from({ length: count }).map((_, i) => (
        <IconStar key={i} className="h-3.5 w-3.5" />
      ))}
    </div>
  );
}

const BENEFIT_ICONS = [IconSprout, IconPalette, IconWallet, IconUsers];
const BENEFIT_TONES = [
  { bg: AMBER_SOFT, fg: AMBER },
  { bg: "#DCE6FB", fg: BLUE },
  { bg: "#DAEFE1", fg: GREEN },
  { bg: AMBER_SOFT, fg: AMBER },
];

function initialsOf(name: string): string {
  const cleaned = name.replace(/^(Cô|Thầy|Coach)\s+/i, "");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("vi");
}

type HeroData = Extract<HomeSection, { type: "hero" }>["data"];
type SearchData = Extract<HomeSection, { type: "search" }>["data"];
type BenefitsData = Extract<HomeSection, { type: "benefits" }>["data"];
type CoachesData = Extract<HomeSection, { type: "coaches" }>["data"];
type DocumentsData = Extract<HomeSection, { type: "documents" }>["data"];
type BecomeSellerData = Extract<HomeSection, { type: "becomeSeller" }>["data"];
type TestimonialsData = Extract<HomeSection, { type: "testimonials" }>["data"];
type FinalCtaData = Extract<HomeSection, { type: "finalCta" }>["data"];

export function HeroSection({ data }: { data: HeroData }) {
  return (
    <section
      className="py-11 lg:py-24"
      style={{ background: `linear-gradient(180deg, ${BLUE_DEEP} 0%, #0E1E48 100%)` }}
    >
      <div className="container-page flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <div className="flex w-full max-w-[560px] flex-col items-start gap-5 sm:gap-6">
          <span
            className="rounded-full border px-4 py-1.5 text-xs font-semibold sm:text-[13.5px]"
            style={{ background: "rgba(255,255,255,0.1)", color: AMBER_SOFT, borderColor: "rgba(244,227,196,0.35)" }}
          >
            {data.badge}
          </span>
          <h1 className="font-[family-name:var(--font-heading)] text-[32px] leading-[1.18] font-semibold text-white sm:text-[44px] lg:text-[52px] lg:leading-[1.12]">
            {data.title}
          </h1>
          <p className="max-w-[480px] text-[15px] leading-[1.65] text-white/70 sm:text-base lg:text-[17px]">{data.subtitle}</p>
          <div className="flex w-full flex-col items-stretch gap-4 sm:w-auto sm:flex-row sm:items-center">
            <Link href={data.primaryCta.href} className="rounded-full px-[30px] py-[15px] text-center text-[15px] font-bold sm:text-base" style={{ background: AMBER, color: "#241503" }}>
              {data.primaryCta.label}
            </Link>
            <Link href={data.secondaryCta.href} className="flex items-center justify-center gap-2 text-[15px] font-semibold text-white sm:justify-start">
              {data.secondaryCta.label} <IconArrow className="h-4 w-4" />
            </Link>
          </div>
        </div>

        <div className="relative h-[220px] w-full max-w-[420px] shrink-0 sm:h-[340px] lg:h-[420px] lg:w-[460px]">
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary ngoài, không qua next/image optimize
            <img src={data.imageUrl} alt="" className="h-full w-full rounded-[24px] object-cover" style={{ boxShadow: "0 30px 60px rgba(6,12,35,0.35)" }} />
          ) : (
            <>
              <div className="absolute top-2 right-4 h-40 w-40 rounded-full sm:h-56 sm:w-56 lg:h-80 lg:w-80" style={{ background: "rgba(196,112,10,0.35)" }} />
              <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full sm:h-40 sm:w-40 lg:h-56 lg:w-56" style={{ background: "rgba(22,107,63,0.35)" }} />
          <div
            className="absolute top-3 left-4 w-[190px] -rotate-3 rounded-[18px] bg-white p-5 shadow-2xl sm:top-8 sm:left-12 sm:w-[260px] sm:p-6 lg:top-[46px] lg:left-[70px] lg:w-[300px] lg:-rotate-[4deg] lg:p-[26px]"
            style={{ boxShadow: "0 30px 60px rgba(6,12,35,0.35)" }}
          >
            <div className="mb-3 flex items-center gap-2 sm:mb-4">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg sm:h-[34px] sm:w-[34px] sm:rounded-[9px]" style={{ background: AMBER_SOFT, color: AMBER }}>
                <IconDocs className="h-4 w-4 sm:h-[18px] sm:w-[18px]" />
              </div>
              <span className="rounded-full px-2.5 py-1 text-[11px] font-bold sm:text-xs" style={{ background: AMBER_SOFT, color: AMBER }}>
                Đề thi
              </span>
            </div>
            <div className="mb-2.5 h-2.5 w-[90%] rounded-full" style={{ background: LINE }} />
            <div className="mb-2.5 h-2.5 w-[70%] rounded-full" style={{ background: LINE }} />
            <div className="h-2.5 w-[80%] rounded-full" style={{ background: LINE }} />
          </div>
          <div className="absolute top-0 right-0 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 sm:gap-3 sm:px-[18px] sm:py-3.5" style={{ boxShadow: "0 18px 40px rgba(6,12,35,0.3)" }}>
            <div className="flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9" style={{ background: BLUE }}>
              <IconUsers className="h-4 w-4 text-white sm:h-[18px] sm:w-[18px]" />
            </div>
            <div>
              <div className="text-[13px] leading-tight font-bold sm:text-[15px]">500+</div>
              <div className="text-[10px] leading-tight sm:text-xs" style={{ color: INK_SOFT }}>
                Giáo viên &amp; Coach
              </div>
            </div>
          </div>
          <div
            className="absolute right-1 bottom-3 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-2.5 sm:right-1.5 sm:bottom-6 sm:gap-3 sm:px-[18px] sm:py-3.5"
            style={{ boxShadow: "0 18px 40px rgba(6,12,35,0.3)" }}
          >
            <div className="flex h-8 w-8 items-center justify-center rounded-full sm:h-9 sm:w-9" style={{ background: GREEN }}>
              <IconDocs className="h-4 w-4 text-white sm:h-[18px] sm:w-[18px]" />
            </div>
            <div>
              <div className="text-[13px] leading-tight font-bold sm:text-[15px]">10.000+</div>
              <div className="text-[10px] leading-tight sm:text-xs" style={{ color: INK_SOFT }}>
                Tài liệu chất lượng
              </div>
            </div>
          </div>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

const vnNumber = new Intl.NumberFormat("vi-VN");

function formatCount(value: number): string {
  return vnNumber.format(value);
}

function formatVnd(amount: number): string {
  return `${vnNumber.format(amount)} ₫`;
}

/** "4,6" — 1 chữ số thập phân kiểu vi-VN (giống thẻ storefront, ADR-029). */
function formatRating(average: number): string {
  return average.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/**
 * Số liệu nổi bật: < 1.000 hiện đúng số; từ 1.000 làm tròn XUỐNG hàng trăm kèm "+" ("1.234" → "1.200+") — gọn và
 * không bao giờ phóng đại. `spoken` là bản cho trình đọc màn hình ("Hơn 1.200").
 */
function formatStat(value: number): { visual: string; spoken: string } {
  if (value < 1000) return { visual: formatCount(value), spoken: formatCount(value) };
  const floored = Math.floor(value / 100) * 100;
  return floored === value
    ? { visual: formatCount(value), spoken: formatCount(value) }
    : { visual: `${formatCount(floored)}+`, spoken: `Hơn ${formatCount(floored)}` };
}

/** ADR-033: `items` đã lọc sẵn (ô bật trong CMS và giá trị > 0) — page không render section khi rỗng. */
export function StatsSection({ items }: { items: HomeStatItem[] }) {
  return (
    <section aria-label="Số liệu nổi bật" className="py-8 sm:py-10" style={{ background: PAPER_ALT }}>
      {/* dl: nhãn (dt) đứng trước số (dd) trong DOM để trình đọc màn hình đọc "Nhãn: số"; hiển thị đảo bằng flex-col-reverse. */}
      <dl
        className={`container-page grid gap-x-6 gap-y-7 sm:flex sm:flex-wrap sm:items-start sm:justify-around ${
          items.length === 1 ? "grid-cols-1" : "grid-cols-2 [&>*:last-child:nth-child(odd)]:col-span-2"
        }`}
      >
        {items.map((item) => {
          const stat = formatStat(item.value);
          return (
            <div key={item.key} className="flex min-w-0 flex-col-reverse items-center text-center sm:min-w-[140px]">
              <dt className="mt-1 text-[13px] leading-snug sm:text-sm" style={{ color: INK_SOFT }}>
                {item.label}
              </dt>
              <dd className="font-[family-name:var(--font-heading)] text-[24px] leading-tight font-bold tabular-nums sm:text-[28px] lg:text-[32px]" style={{ color: BLUE }}>
                <span aria-hidden="true">{stat.visual}</span>
                <span className="sr-only">{stat.spoken}</span>
              </dd>
            </div>
          );
        })}
      </dl>
    </section>
  );
}

/** Số chip hiện sẵn; phần còn lại nằm trong <details> (mở được bằng bàn phím) thay vì cắt mất hoặc cuộn ngang. */
const SEARCH_CHIPS_VISIBLE = 10;

function CategoryChip({ category }: { category: HomeSearchCategory }) {
  return (
    <li
      className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.5 text-[13px] font-semibold sm:text-sm"
      style={{ borderColor: LINE, color: INK }}
    >
      <span className="[overflow-wrap:anywhere]">{category.name}</span>
      <span className="text-xs font-medium tabular-nums" style={{ color: INK_SOFT }}>
        <span aria-hidden="true">· </span>
        {formatCount(category.productCount)}
        <span className="sr-only"> tài liệu</span>
      </span>
    </li>
  );
}

/**
 * ADR-033 mục 3: chip lấy từ danh mục đang có tài liệu Công khai. Chưa có trang tìm kiếm/danh mục công khai nên chip
 * là nhãn tĩnh (li), KHÔNG phải link/nút — không giả làm phần tử bấm được. Ô tìm kiếm giữ nguyên hiện trạng.
 */
export function SearchSection({ data, categories }: { data: SearchData; categories: HomeSearchCategory[] }) {
  const titleId = useId();
  const chipsLabelId = useId();
  const visible = categories.slice(0, SEARCH_CHIPS_VISIBLE);
  const rest = categories.slice(SEARCH_CHIPS_VISIBLE);
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24">
      <div className="container-page flex flex-col items-center gap-4 text-center">
        <h2 id={titleId} className="font-[family-name:var(--font-heading)] text-[25px] font-semibold sm:text-[30px] lg:text-[34px]">
          {data.title}
        </h2>
        <p className="mb-1 text-sm sm:text-base" style={{ color: INK_SOFT }}>
          {data.subtitle}
        </p>
        <div className="flex w-full max-w-[680px] items-center gap-3 rounded-full border bg-white py-1.5 pr-1.5 pl-5" style={{ borderColor: LINE, boxShadow: "0 12px 30px rgba(28,35,51,0.06)" }}>
          <IconSearch className="h-[18px] w-[18px] shrink-0" style={{ color: INK_SOFT }} />
          <span className="grow truncate text-left text-[13.5px] sm:text-[15px]" style={{ color: INK_SOFT }}>
            {data.placeholder}
          </span>
          <button type="button" className="shrink-0 rounded-full px-5 py-2.5 text-[13px] font-bold text-white sm:px-[26px] sm:py-3 sm:text-sm" style={{ background: BLUE }}>
            Tìm kiếm
          </button>
        </div>
        {categories.length > 0 ? (
          <div className="mt-2 flex w-full max-w-[880px] flex-col items-center gap-2.5">
            <p id={chipsLabelId} className="text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
              Danh mục đang có tài liệu
            </p>
            <ul aria-labelledby={chipsLabelId} className="flex flex-wrap justify-center gap-2 sm:gap-2.5">
              {visible.map((category) => (
                <CategoryChip key={category.id} category={category} />
              ))}
            </ul>
            {rest.length > 0 ? (
              <details className="group w-full">
                <summary
                  className="mx-auto flex min-h-11 w-fit cursor-pointer list-none items-center gap-1.5 rounded-full px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 [&::-webkit-details-marker]:hidden"
                  style={{ color: BLUE, outlineColor: BLUE }}
                >
                  <span className="group-open:hidden">Xem thêm {formatCount(rest.length)} danh mục</span>
                  <span className="hidden group-open:inline">Thu gọn</span>
                  <IconChevron className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </summary>
                <ul aria-label="Danh mục khác" className="mt-2 flex flex-wrap justify-center gap-2 sm:gap-2.5">
                  {rest.map((category) => (
                    <CategoryChip key={category.id} category={category} />
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function BenefitsSection({ data }: { data: BenefitsData }) {
  return (
    <section className="py-14 sm:py-20 lg:py-24" style={{ background: PAPER_ALT }}>
      <div className="container-page flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-20">
        <div className="lg:w-[400px] lg:shrink-0">
          <span className="text-[13px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER }}>
            {data.eyebrow}
          </span>
          <h2 className="mt-3.5 font-[family-name:var(--font-heading)] text-[25px] leading-[1.3] font-semibold sm:text-[28px] lg:text-[32px] lg:leading-[1.25]">{data.title}</h2>
          <p className="mt-4 text-[14.5px] leading-[1.7] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
            {data.description}
          </p>
        </div>
        <div className="grid grow grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-7">
          {data.items.map((item, i) => {
            const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length]!;
            const tone = BENEFIT_TONES[i % BENEFIT_TONES.length]!;
            return (
              <div key={item.title} className="rounded-3xl border bg-white p-6 sm:p-[30px]" style={{ borderColor: LINE }}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12" style={{ background: tone.bg, color: tone.fg }}>
                  <Icon className="h-[22px] w-[22px] sm:h-6 sm:w-6" />
                </div>
                <div className="mb-2 text-base font-bold sm:text-[17px]">{item.title}</div>
                <div className="text-sm leading-[1.6] sm:text-[14.5px]" style={{ color: INK_SOFT }}>
                  {item.description}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

/** "★ 4,6 (12 đánh giá)" — sao là ký hiệu trang trí (≥3:1), chữ số màu INK để đạt 4.5:1; trình đọc màn hình nghe câu đầy đủ. */
function RatingInline({ average, count, long = false }: { average: number; count: number; long?: boolean }) {
  const avg = formatRating(average);
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <IconStar className="h-3.5 w-3.5 shrink-0" style={{ color: AMBER }} />
      <span aria-hidden="true" className="font-semibold" style={{ color: INK }}>
        {avg}
      </span>
      <span aria-hidden="true" style={{ color: INK_SOFT }}>
        ({formatCount(count)}
        {long ? " đánh giá" : ""})
      </span>
      <span className="sr-only">
        Điểm trung bình {avg} trên 5, {formatCount(count)} đánh giá
      </span>
    </span>
  );
}

/** Tiêu đề + mô tả section (h2) — dùng chung cho 2 section thẻ nổi bật. */
function FeaturedHeading({ id, title, subtitle }: { id: string; title: string; subtitle: string }) {
  return (
    <div className="mb-8 sm:mb-10">
      <h2 id={id} className="font-[family-name:var(--font-heading)] text-[25px] font-semibold sm:text-[28px] lg:text-[32px]">
        {title}
      </h2>
      <p className="mt-2.5 text-[14.5px] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
        {subtitle}
      </p>
    </div>
  );
}

/**
 * Thẻ bấm được toàn bộ bằng "stretched link" trên tiêu đề (1 link/thẻ → tên truy cập = tên giáo viên/tài liệu, không
 * lặp "Xem chi tiết"); vòng focus vẽ trên cả thẻ. Nhấc nhẹ khi hover chỉ khi người dùng không giảm chuyển động.
 */
const CARD_CLASS =
  "group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white transition-[box-shadow,transform] duration-200 hover:shadow-[0_16px_36px_-18px_rgba(18,33,58,0.35)] motion-safe:hover:-translate-y-0.5 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2";

const STRETCHED_LINK = "outline-none after:absolute after:inset-0 after:content-['']";

/** ADR-033 mục 4 — thẻ giáo viên/coach: avatar, tên, số tài liệu, sao (khi có), "Đã bán" (khi > 0), link storefront. */
export function CoachesSection({ data, tenants }: { data: CoachesData; tenants: HomeFeaturedTenant[] }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24">
      <div className="container-page">
        <FeaturedHeading id={titleId} title={data.title} subtitle={data.subtitle} />
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-[26px]">
          {tenants.map((c, i) => (
            <li key={c.id}>
              <article className={`${CARD_CLASS} items-center gap-2 p-4 text-center sm:gap-2.5 sm:p-[26px]`} style={{ borderColor: LINE, outlineColor: BLUE }}>
                <div
                  aria-hidden="true"
                  className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-full sm:h-[72px] sm:w-[72px]"
                  style={{ background: ROTATING_COLORS[i % ROTATING_COLORS.length] }}
                >
                  {c.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element -- ảnh đã tối ưu qua cloudinaryDeliveryUrl (ADR-028)
                    <img src={c.logoUrl} alt="" width={72} height={72} loading="lazy" decoding="async" className="h-full w-full bg-white object-cover" />
                  ) : (
                    <span className="font-[family-name:var(--font-heading)] text-xl font-bold text-white sm:text-[22px]">{initialsOf(c.name)}</span>
                  )}
                </div>
                <h3 className="line-clamp-2 text-[15px] leading-snug font-bold [overflow-wrap:anywhere] sm:text-[16.5px]">
                  <Link href={c.href} className={STRETCHED_LINK}>
                    {c.name}
                  </Link>
                </h3>
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
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** ADR-033 mục 4 — thẻ tài liệu: ảnh bìa tối ưu, tên, gian hàng, giá hiệu lực (khuyến mãi), sao, "Đã bán", link `productPath`. */
export function DocumentsSection({ data, products }: { data: DocumentsData; products: HomeFeaturedProduct[] }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24" style={{ background: PAPER_ALT }}>
      <div className="container-page">
        <FeaturedHeading id={titleId} title={data.title} subtitle={data.subtitle} />
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
          {products.map((d, i) => {
            const tone = ROTATING_COLORS[i % ROTATING_COLORS.length];
            const free = d.effectivePriceVnd === 0;
            const discountPercent = d.onSale && d.priceVnd > 0 ? Math.max(1, Math.round((1 - d.effectivePriceVnd / d.priceVnd) * 100)) : 0;
            return (
              <li key={d.id}>
                <article className={CARD_CLASS} style={{ borderColor: LINE, outlineColor: BLUE }}>
                  <div
                    className="relative flex aspect-[16/10] items-center justify-center"
                    style={{ background: `color-mix(in srgb, ${tone} 10%, white)`, color: tone }}
                  >
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
                      <IconDocs className="h-12 w-12 opacity-80 sm:h-14 sm:w-14" />
                    )}
                    {discountPercent > 0 ? (
                      <span className="absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-bold text-white shadow-sm" style={{ background: "#B91C1C" }}>
                        Giảm {discountPercent}%
                      </span>
                    ) : null}
                  </div>
                  <div className="flex grow flex-col p-5 sm:p-[22px]">
                    <h3 className="line-clamp-2 text-[15px] leading-[1.4] font-bold [overflow-wrap:anywhere] sm:text-base">
                      <Link href={d.href} className={STRETCHED_LINK}>
                        {d.title}
                      </Link>
                    </h3>
                    <p className="mt-2 flex min-w-0 items-center gap-2 text-[13.5px]" style={{ color: INK_SOFT }}>
                      <span
                        aria-hidden="true"
                        className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white"
                        style={{ background: tone }}
                      >
                        {initialsOf(d.tenant.name).slice(0, 1)}
                      </span>
                      <span className="sr-only">Người bán: </span>
                      <span className="truncate" title={d.tenant.name}>
                        {d.tenant.name}
                      </span>
                    </p>
                    {d.ratingAvg !== null || d.soldCount > 0 ? (
                      <p className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px]">
                        {d.ratingAvg !== null ? <RatingInline average={d.ratingAvg} count={d.ratingCount} /> : null}
                        {d.ratingAvg !== null && d.soldCount > 0 ? (
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
                    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
                      <p className="flex flex-wrap items-baseline gap-x-2 tabular-nums">
                        {d.onSale ? <span className="sr-only">Giá khuyến mãi </span> : null}
                        <span className="font-[family-name:var(--font-heading)] text-[17px] font-bold sm:text-[18px]" style={{ color: BLUE }}>
                          {free ? "Miễn phí" : formatVnd(d.effectivePriceVnd)}
                        </span>
                        {d.onSale ? (
                          <span className="text-[13px] line-through" style={{ color: INK_SOFT }}>
                            <span className="sr-only">, giá gốc </span>
                            {formatVnd(d.priceVnd)}
                          </span>
                        ) : null}
                      </p>
                      <span
                        aria-hidden="true"
                        className="inline-flex shrink-0 items-center gap-1 rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors"
                        style={{ borderColor: LINE }}
                      >
                        Xem chi tiết <IconArrow className="h-3.5 w-3.5" />
                      </span>
                    </div>
                  </div>
                </article>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

export function BecomeSellerSection({ data }: { data: BecomeSellerData }) {
  return (
    <section className="py-14 sm:py-20 lg:py-24">
      <div className="container-page">
        <div
          className="flex flex-col gap-10 rounded-[32px] p-8 sm:p-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:p-16"
          style={{ background: `linear-gradient(120deg, ${BLUE_DEEP} 0%, #0E1E48 100%)` }}
        >
          <div className="lg:w-[600px]">
            <span className="text-[12.5px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_SOFT }}>
              {data.eyebrow}
            </span>
            <h2 className="mt-3.5 font-[family-name:var(--font-heading)] text-2xl leading-[1.35] font-semibold text-white sm:text-[28px] lg:text-[32px] lg:leading-[1.3]">
              {data.title} <span style={{ color: "#F4C979" }}>{data.highlight}</span>
            </h2>
            <div className="my-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-4 lg:my-[30px]">
              {data.bullets.map((item) => (
                <div key={item} className="flex items-center gap-2.5 text-sm text-white/85 sm:text-[14.5px]">
                  <IconCheck className="h-4 w-4 shrink-0" style={{ color: "#F4C979" }} /> {item}
                </div>
              ))}
            </div>
            <Link href={data.cta.href} className="inline-block rounded-full px-[30px] py-[15px] text-[15px] font-bold sm:text-base" style={{ background: AMBER, color: "#241503" }}>
              {data.cta.label}
            </Link>
          </div>
          <div className="relative hidden h-[300px] w-[320px] shrink-0 sm:block">
            <div className="absolute top-0 right-0 h-[220px] w-[220px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
            <div className="absolute top-10 left-5 w-[260px] rotate-3 rounded-2xl p-[22px]" style={{ background: "rgba(255,255,255,0.97)", boxShadow: "0 24px 50px rgba(0,0,0,0.35)" }}>
              <div className="mb-2.5 h-2.5 w-[85%] rounded-full" style={{ background: LINE }} />
              <div className="mb-2.5 h-2.5 w-[65%] rounded-full" style={{ background: LINE }} />
              <div className="mb-4 h-2.5 w-[75%] rounded-full" style={{ background: LINE }} />
              <div className="flex items-center justify-between">
                <span className="text-[12.5px] font-bold" style={{ color: AMBER }}>
                  149.000đ
                </span>
                <Stars />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

export function TestimonialsSection({ data, brandName }: { data: TestimonialsData; brandName: string }) {
  return (
    <section className="py-14 sm:py-20 lg:py-24">
      <div className="container-page flex flex-col items-center">
        <h2 className="font-[family-name:var(--font-heading)] text-[25px] font-semibold sm:text-[28px] lg:text-[32px]">Người dùng nói gì về {brandName}</h2>
        <p className="mt-3 mb-9 text-center text-[14.5px] sm:text-[15.5px] lg:mb-11" style={{ color: INK_SOFT }}>
          Những chia sẻ thật từ cộng đồng giáo viên và coach đang bán hàng trên nền tảng
        </p>
        <div className="grid w-full grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-7">
          {data.items.map((t, i) => (
            <div key={t.name} className="rounded-3xl border bg-white p-6 sm:p-[30px]" style={{ borderColor: LINE }}>
              <Stars className="mb-4" />
              <p className="mb-5 text-sm leading-[1.65] italic sm:text-[15px]" style={{ color: INK_SOFT }}>
                &ldquo;{t.quote}&rdquo;
              </p>
              <div className="flex items-center gap-3 border-t pt-4 sm:pt-[18px]" style={{ borderColor: LINE }}>
                <div className="h-10 w-10 shrink-0 rounded-full" style={{ background: ROTATING_COLORS[i % ROTATING_COLORS.length] }} />
                <div>
                  <div className="text-sm font-bold sm:text-[14.5px]">{t.name}</div>
                  <div className="text-xs sm:text-[13px]" style={{ color: INK_SOFT }}>
                    {t.role}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection({ data }: { data: FinalCtaData }) {
  return (
    <section className="py-14 sm:py-[76px]" style={{ background: AMBER }}>
      <div className="container-page flex flex-col items-center gap-5 text-center">
        <h2 className="font-[family-name:var(--font-heading)] text-2xl font-semibold sm:text-[28px] lg:text-[32px]" style={{ color: "#241503" }}>
          {data.title}
        </h2>
        <p className="text-sm sm:text-base" style={{ color: "#4A3006" }}>
          {data.subtitle}
        </p>
        <Link href={data.cta.href} className="mt-1.5 w-full rounded-full px-[30px] py-[15px] text-center text-[15px] font-bold text-white sm:w-auto sm:text-base" style={{ background: BLUE }}>
          {data.cta.label}
        </Link>
      </div>
    </section>
  );
}
