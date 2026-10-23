import { useId } from "react";
import Link from "next/link";
import type { HomeCommunityView, HomeCta, HomeSection } from "@gieochu/core";
import type { HomeFeaturedProduct, HomeFeaturedTenant, HomeSearchCategory, HomeStatItem } from "../lib/home";
import { SHOP_SEARCH_PATH, SHOP_SEARCH_Q_MAX, shopSearchHref } from "../lib/shop";
import {
  AMBER,
  AMBER_SOFT,
  BLUE,
  BLUE_DEEP,
  GREEN,
  INK,
  INK_SOFT,
  IconArrow,
  IconChevron,
  IconDocs,
  IconSearch,
  LINE,
  PAPER_ALT,
  ROTATING_COLORS,
  formatCount,
  initialsOf,
} from "./_ui/catalog-parts";
import { DocumentCard } from "./_ui/document-card";
import { TenantCard } from "./_ui/tenant-card";

function IconSprout({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 21V11" />
      <path d="M12 11c0-4 3-6 7-6 0 4-2 7-7 7Z" />
      <path d="M12 14c0-3.2-2.4-5-6-5 0 3.2 2 5.6 6 5Z" />
    </svg>
  );
}

function IconPalette({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 3a9 9 0 1 0 0 18c1.2 0 2-1 2-2 0-.6-.2-1-.5-1.3-.3-.4-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-7.7-9-7.7Z" />
      <circle cx="7.5" cy="10.5" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="9.5" cy="7" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.5" cy="7" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconWallet({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="6" width="18" height="13" rx="2.5" />
      <path d="M3 10h18" />
      <circle cx="16.5" cy="14" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconUsers({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="8.5" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" />
      <circle cx="17" cy="9" r="2.3" />
      <path d="M15.5 14.2c2.6.4 4.5 2.6 4.5 5.3" />
    </svg>
  );
}

function IconCheck({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 12.5 9.5 18 20 6" />
    </svg>
  );
}

function IconQuote({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true" fill="currentColor">
      <path d="M9.6 6C6.5 7.2 4.5 9.9 4.5 13.4V18h5.6v-5.4H7.4c.1-1.9 1.2-3.4 3.1-4.3L9.6 6Zm9 0c-3.1 1.2-5.1 3.9-5.1 7.4V18h5.6v-5.4h-2.7c.1-1.9 1.2-3.4 3.1-4.3L18.6 6Z" />
    </svg>
  );
}

function IconUploadCloud({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 18.5h-.5a4 4 0 0 1-.6-7.96A6 6 0 0 1 17.6 9.1 4.5 4.5 0 0 1 17.5 18.5H17" />
      <path d="M12 12.5v7M9 15.5l3-3 3 3" />
    </svg>
  );
}

/** Lớp phủ trang trí theo màu thương hiệu runtime (`var(--brand-*)`) — không gõ cứng hex. */
function tint(color: string, percent: number): string {
  return `color-mix(in srgb, ${color} ${percent}%, transparent)`;
}

/**
 * Chữ eyebrow cam trên nền kem: `accent` gốc (#D97706) chỉ ~2.8:1 trên `background` → đậm thêm 28% bằng đen để đạt ≥ 4.5:1
 * (≈ #9C5604), vẫn theo màu thương hiệu runtime. Đề xuất đưa thành token `accentInk` (cần Quốc duyệt sửa theme.ts).
 */
const AMBER_TEXT = `color-mix(in srgb, ${AMBER} 72%, black)`;

/** Vòng focus trên nền tối (hero, khối mời mở gian hàng) / nền sáng. */
const FOCUS_ON_DARK = "outline-offset-2 focus-visible:outline-2 focus-visible:outline-white";
const FOCUS_ON_LIGHT = "outline-offset-2 focus-visible:outline-2";
/** CTA chính (accent) và CTA phụ dạng link — vùng bấm ≥ 44px. */
const CTA_PRIMARY = "inline-flex min-h-12 items-center justify-center rounded-full px-[30px] py-3 text-center text-[15px] font-bold transition-[filter] hover:brightness-105 sm:text-base [touch-action:manipulation]";
const CTA_LINK = "inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-1 text-[15px] font-semibold hover:underline underline-offset-4 [touch-action:manipulation]";

const BENEFIT_ICONS = [IconSprout, IconPalette, IconWallet, IconUsers];
const BENEFIT_TONES = [
  { bg: AMBER_SOFT, fg: AMBER },
  { bg: `color-mix(in srgb, ${BLUE} 14%, white)`, fg: BLUE },
  { bg: `color-mix(in srgb, ${GREEN} 16%, white)`, fg: GREEN },
  { bg: AMBER_SOFT, fg: AMBER },
];

type HeroData = Extract<HomeSection, { type: "hero" }>["data"];
type SearchData = Extract<HomeSection, { type: "search" }>["data"];
type BenefitsData = Extract<HomeSection, { type: "benefits" }>["data"];
type CoachesData = Extract<HomeSection, { type: "coaches" }>["data"];
type DocumentsData = Extract<HomeSection, { type: "documents" }>["data"];
type BecomeSellerData = Extract<HomeSection, { type: "becomeSeller" }>["data"];
type StepsData = Extract<HomeSection, { type: "steps" }>["data"];
type CommunityData = Extract<HomeSection, { type: "community" }>["data"];
type FaqData = Extract<HomeSection, { type: "faq" }>["data"];
type FinalCtaData = Extract<HomeSection, { type: "finalCta" }>["data"];

/**
 * Minh hoạ mặc định của hero khi chưa upload ảnh (ADR-050): chồng "trang tài liệu" dựng bằng CSS — chỉ thanh xám + biểu
 * tượng, **không số liệu, không giá, không sao, không chữ gõ cứng**. Toàn bộ là trang trí (`aria-hidden`); màu theo token
 * runtime (`tint()` trên `var(--brand-*)`). Khung cao cố định ở phần tử cha → không CLS.
 */
function HeroIllustration() {
  return (
    <div aria-hidden="true" className="absolute inset-0">
      <div className="absolute top-2 right-4 h-40 w-40 rounded-full sm:h-56 sm:w-56 lg:h-80 lg:w-80" style={{ background: tint(AMBER, 35) }} />
      <div className="absolute bottom-0 left-0 h-28 w-28 rounded-full sm:h-40 sm:w-40 lg:h-56 lg:w-56" style={{ background: tint(GREEN, 35) }} />
      {/* Trang phía sau (lệch phải) — gợi "kệ tài liệu". */}
      <div
        className="absolute top-8 right-6 w-[150px] rotate-6 rounded-[18px] p-4 sm:top-12 sm:right-10 sm:w-[210px] sm:p-5 lg:top-[60px] lg:right-[34px] lg:w-[240px]"
        style={{ background: "rgba(255,255,255,0.9)", boxShadow: "0 24px 50px rgba(6,12,35,0.3)" }}
      >
        <div className="mb-3 h-14 rounded-xl sm:h-24" style={{ background: tint(BLUE, 14) }} />
        <div className="mb-2 h-2 w-[80%] rounded-full" style={{ background: LINE }} />
        <div className="h-2 w-[55%] rounded-full" style={{ background: LINE }} />
      </div>
      {/* Trang chính. */}
      <div
        className="absolute top-3 left-4 w-[190px] -rotate-3 rounded-[18px] bg-white p-5 sm:top-8 sm:left-12 sm:w-[260px] sm:p-6 lg:top-[46px] lg:left-[40px] lg:w-[290px] lg:-rotate-[4deg] lg:p-[26px]"
        style={{ boxShadow: "0 30px 60px rgba(6,12,35,0.35)" }}
      >
        <div className="mb-4 flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg sm:h-[38px] sm:w-[38px] sm:rounded-[10px]" style={{ background: AMBER_SOFT, color: AMBER }}>
            <IconDocs className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="h-2.5 w-[45%] rounded-full" style={{ background: AMBER_SOFT }} />
        </div>
        <div className="mb-2.5 h-2.5 w-[90%] rounded-full" style={{ background: LINE }} />
        <div className="mb-2.5 h-2.5 w-[72%] rounded-full" style={{ background: LINE }} />
        <div className="mb-4 h-2.5 w-[82%] rounded-full" style={{ background: LINE }} />
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full sm:h-8 sm:w-8" style={{ background: tint(GREEN, 16), color: GREEN }}>
            <IconSprout className="h-4 w-4" />
          </div>
          <div className="h-2 w-[38%] rounded-full" style={{ background: LINE }} />
        </div>
      </div>
      {/* Thẻ nổi "đã sẵn sàng" — dấu tích, không chữ/số. */}
      <div
        className="absolute right-2 bottom-3 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 sm:right-6 sm:bottom-10 lg:right-0 lg:bottom-[54px]"
        style={{ boxShadow: "0 18px 40px rgba(6,12,35,0.3)" }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: GREEN }}>
          <IconCheck className="h-4 w-4" />
        </div>
        <div className="space-y-1.5">
          <div className="h-2 w-16 rounded-full sm:w-20" style={{ background: LINE }} />
          <div className="h-2 w-10 rounded-full sm:w-12" style={{ background: LINE }} />
        </div>
      </div>
    </div>
  );
}

/**
 * `slogan` = slogan thương hiệu (dùng khi CMS để trống `brandMessage`). ADR-050: minh hoạ mặc định không còn số liệu gõ cứng.
 * `headingLevel`: hero đầu tiên là H1 duy nhất của trang; page truyền `"h2"` nếu (bất thường) có hero thứ hai.
 * `badge` = eyebrow (đoạn chữ, không phải heading).
 */
export function HeroSection({ data, slogan, headingLevel = "h1" }: { data: HeroData; slogan: string; headingLevel?: "h1" | "h2" }) {
  const Heading = headingLevel;
  const message = data.brandMessage || slogan;
  return (
    <section className="py-11 lg:py-24" style={{ background: `linear-gradient(180deg, ${BLUE_DEEP} 0%, color-mix(in srgb, ${BLUE_DEEP} 82%, ${BLUE}) 100%)` }}>
      <div className="container-page flex flex-col items-center gap-10 lg:flex-row lg:items-center lg:justify-between lg:gap-16">
        <div className="flex w-full max-w-[560px] flex-col items-start gap-5 sm:gap-6">
          {data.badge ? (
            <p
              className="rounded-full border px-4 py-1.5 text-xs font-semibold sm:text-[13.5px]"
              style={{ background: "rgba(255,255,255,0.1)", color: AMBER_SOFT, borderColor: "rgba(244,227,196,0.35)" }}
            >
              {data.badge}
            </p>
          ) : null}
          <Heading className="font-[family-name:var(--font-heading)] text-[32px] leading-[1.18] font-semibold text-balance text-white sm:text-[44px] lg:text-[52px] lg:leading-[1.12]">
            {data.title}
          </Heading>
          <p className="max-w-[480px] text-[15px] leading-[1.65] text-white/75 sm:text-base lg:text-[17px]">{data.subtitle}</p>
          <div className="flex w-full flex-col items-stretch gap-3 sm:w-auto sm:flex-row sm:items-center sm:gap-6">
            <Link href={data.primaryCta.href} className={`${CTA_PRIMARY} ${FOCUS_ON_DARK}`} style={{ background: AMBER, color: "#241503" }}>
              {data.primaryCta.label}
            </Link>
            <Link href={data.secondaryCta.href} className={`${CTA_LINK} text-white ${FOCUS_ON_DARK}`}>
              {data.secondaryCta.label} <IconArrow className="h-4 w-4" />
            </Link>
          </div>
          {message ? (
            <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: AMBER_SOFT }}>
              <IconSprout className="h-4 w-4 shrink-0" />
              {message}
            </p>
          ) : null}
        </div>

        <div className="relative h-[220px] w-full max-w-[420px] shrink-0 sm:h-[340px] lg:h-[420px] lg:w-[460px]">
          {data.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary ngoài, không qua next/image optimize
            <img
              src={data.imageUrl}
              alt={data.imageAlt ?? ""}
              className="h-full w-full rounded-[24px] object-cover"
              style={{ boxShadow: "0 30px 60px rgba(6,12,35,0.35)" }}
            />
          ) : (
            <HeroIllustration />
          )}
        </div>
      </div>
    </section>
  );
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
    <li className="max-w-full">
      <Link
        href={shopSearchHref({ categorySlug: category.slug })}
        className="relative inline-flex max-w-full items-center gap-1.5 rounded-full border bg-white px-3.5 py-1.5 text-[13px] font-semibold outline-offset-2 transition-colors before:absolute before:inset-x-0 before:-inset-y-[5px] before:content-[''] hover:border-[color:var(--chip-hover)] focus-visible:outline-2 sm:text-sm [touch-action:manipulation]"
        style={{ borderColor: LINE, color: INK, outlineColor: BLUE, ["--chip-hover" as string]: BLUE }}
      >
        <span className="[overflow-wrap:anywhere]">{category.name}</span>
        <span className="text-xs font-medium tabular-nums" style={{ color: INK_SOFT }}>
          <span aria-hidden="true">· </span>
          {formatCount(category.productCount)}
          <span className="sr-only"> tài liệu</span>
        </span>
      </Link>
    </li>
  );
}

/**
 * ADR-033 mục 3: chip lấy từ danh mục đang có tài liệu Công khai. ADR-035 (GĐ2): ô tìm là form GET `q` tới
 * `/cua-hang/tai-lieu`, chip là link `?danh-muc={slug}` — giữ nguyên giao diện cũ, chỉ đổi đích.
 */
export function SearchSection({ data, categories }: { data: SearchData; categories: HomeSearchCategory[] }) {
  const titleId = useId();
  const chipsLabelId = useId();
  const queryId = useId();
  const visible = categories.slice(0, SEARCH_CHIPS_VISIBLE);
  const rest = categories.slice(SEARCH_CHIPS_VISIBLE);
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24">
      <div className="container-page flex flex-col items-center gap-4 text-center">
        {data.eyebrow ? (
          <p className="text-[13px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_TEXT }}>
            {data.eyebrow}
          </p>
        ) : null}
        <h2 id={titleId} className="font-[family-name:var(--font-heading)] text-[25px] font-semibold sm:text-[30px] lg:text-[34px]">
          {data.title}
        </h2>
        <p className="mb-1 text-sm sm:text-base" style={{ color: INK_SOFT }}>
          {data.subtitle}
        </p>
        <form
          action={SHOP_SEARCH_PATH}
          method="get"
          role="search"
          className="flex w-full max-w-[680px] items-center gap-3 rounded-full border bg-white py-1.5 pr-1.5 pl-5 focus-within:outline-2 focus-within:outline-offset-2"
          style={{ borderColor: LINE, boxShadow: "0 12px 30px rgba(28,35,51,0.06)", outlineColor: BLUE }}
        >
          <IconSearch className="h-[18px] w-[18px] shrink-0" style={{ color: INK_SOFT }} />
          {/* Nhãn ẩn thị giác: giữ giao diện "ô tìm" cũ (một hàng pill) — tiêu đề H2 ngay trên đã nói rõ mục đích. */}
          <label htmlFor={queryId} className="sr-only">
            {data.title}
          </label>
          <input
            id={queryId}
            type="search"
            name="q"
            placeholder={data.placeholder}
            maxLength={SHOP_SEARCH_Q_MAX}
            enterKeyHint="search"
            autoComplete="off"
            className="min-w-0 grow bg-transparent text-left text-base outline-none placeholder:text-[color:var(--search-placeholder)] sm:text-[15px]"
            style={{ color: INK, ["--search-placeholder" as string]: INK_SOFT }}
          />
          <button
            type="submit"
            className="relative shrink-0 cursor-pointer rounded-full px-5 py-2.5 text-[13px] font-bold text-white transition-[filter] outline-offset-2 before:absolute before:inset-x-0 before:-inset-y-[2px] before:content-[''] hover:brightness-110 focus-visible:outline-2 sm:px-[26px] sm:py-3 sm:text-sm [touch-action:manipulation]"
            style={{ background: BLUE, outlineColor: BLUE }}
          >
            {data.submitLabel}
          </button>
        </form>
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
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24" style={{ background: PAPER_ALT }}>
      <div className="container-page flex flex-col gap-10 lg:flex-row lg:justify-between lg:gap-20">
        <div className="lg:w-[400px] lg:shrink-0">
          <p className="text-[13px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_TEXT }}>
            {data.eyebrow}
          </p>
          <h2 id={titleId} className="mt-3.5 font-[family-name:var(--font-heading)] text-[25px] leading-[1.3] font-semibold text-balance sm:text-[28px] lg:text-[32px] lg:leading-[1.25]">
            {data.title}
          </h2>
          <p className="mt-4 text-[14.5px] leading-[1.7] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
            {data.description}
          </p>
        </div>
        <ul className="grid grow grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-7">
          {data.items.map((item, i) => {
            const Icon = BENEFIT_ICONS[i % BENEFIT_ICONS.length]!;
            const tone = BENEFIT_TONES[i % BENEFIT_TONES.length]!;
            return (
              <li key={`${i}-${item.title}`} className="rounded-3xl border bg-white p-6 sm:p-[30px]" style={{ borderColor: LINE }}>
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl sm:h-12 sm:w-12" style={{ background: tone.bg, color: tone.fg }}>
                  <Icon className="h-[22px] w-[22px] sm:h-6 sm:w-6" />
                </div>
                <h3 className="mb-2 text-base font-bold sm:text-[17px]">{item.title}</h3>
                <p className="text-sm leading-[1.6] sm:text-[14.5px]" style={{ color: INK_SOFT }}>
                  {item.description}
                </p>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/** Tiêu đề + mô tả section (h2) — dùng chung cho 2 section thẻ nổi bật. ADR-050: eyebrow + nút "xem tất cả" từ CMS. */
function FeaturedHeading({ id, title, subtitle, eyebrow, cta }: { id: string; title: string; subtitle: string; eyebrow?: string; cta?: HomeCta }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:mb-10 sm:flex-row sm:items-end sm:justify-between">
      <div>
        {eyebrow ? (
          <p className="mb-2 text-[13px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_TEXT }}>
            {eyebrow}
          </p>
        ) : null}
        <h2 id={id} className="font-[family-name:var(--font-heading)] text-[25px] font-semibold sm:text-[28px] lg:text-[32px]">
          {title}
        </h2>
        <p className="mt-2.5 text-[14.5px] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
          {subtitle}
        </p>
      </div>
      {cta ? (
        <Link href={cta.href} className={`${CTA_LINK} shrink-0 justify-start ${FOCUS_ON_LIGHT}`} style={{ color: BLUE, outlineColor: BLUE }}>
          {cta.label} <IconArrow className="h-4 w-4" />
        </Link>
      ) : null}
    </div>
  );
}

/** ADR-033 mục 4 — thẻ giáo viên/coach: avatar, tên, số tài liệu, sao (khi có), "Đã bán" (khi > 0), link storefront. */
export function CoachesSection({ data, tenants }: { data: CoachesData; tenants: HomeFeaturedTenant[] }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24">
      <div className="container-page">
        <FeaturedHeading id={titleId} title={data.title} subtitle={data.subtitle} eyebrow={data.eyebrow} cta={data.cta} />
        <ul className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4 lg:gap-[26px]">
          {tenants.map((c, i) => (
            <li key={c.id}>
              <TenantCard tenant={c} toneIndex={i} />
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
        <FeaturedHeading id={titleId} title={data.title} subtitle={data.subtitle} eyebrow={data.eyebrow} cta={data.cta} />
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3 lg:gap-7">
          {products.map((d, i) => (
            <li key={d.id}>
              <DocumentCard product={d} toneIndex={i} />
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * Minh hoạ "gian hàng của bạn" (ADR-050): thẻ hồ sơ + lưới 3 ô tài liệu + thẻ nổi tải lên — chỉ thanh xám + biểu tượng,
 * **không giá, không sao, không số**. Trang trí (`aria-hidden`); ẩn dưới `sm` như cũ.
 */
function SellerIllustration() {
  return (
    <div aria-hidden="true" className="relative hidden h-[300px] w-[320px] shrink-0 sm:block">
      <div className="absolute top-0 right-0 h-[220px] w-[220px] rounded-full" style={{ background: "rgba(255,255,255,0.06)" }} />
      <div
        className="absolute top-8 left-3 w-[270px] rotate-2 rounded-2xl p-5"
        style={{ background: "rgba(255,255,255,0.97)", boxShadow: "0 24px 50px rgba(0,0,0,0.35)" }}
      >
        <div className="mb-4 flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full" style={{ background: AMBER_SOFT, color: AMBER }}>
            <IconSprout className="h-5 w-5" />
          </div>
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-[70%] rounded-full" style={{ background: LINE }} />
            <div className="h-2 w-[45%] rounded-full" style={{ background: LINE }} />
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {[BLUE, AMBER, GREEN].map((color, i) => (
            <div key={i} className="rounded-xl p-2" style={{ background: tint(color, 10) }}>
              <div className="mb-2 flex h-9 items-center justify-center rounded-lg" style={{ background: tint(color, 18), color }}>
                <IconDocs className="h-4 w-4" />
              </div>
              <div className="mb-1 h-1.5 w-[85%] rounded-full" style={{ background: LINE }} />
              <div className="h-1.5 w-[60%] rounded-full" style={{ background: LINE }} />
            </div>
          ))}
        </div>
      </div>
      <div
        className="absolute right-0 bottom-6 flex items-center gap-2.5 rounded-2xl bg-white px-3.5 py-3 -rotate-2"
        style={{ boxShadow: "0 18px 40px rgba(0,0,0,0.3)" }}
      >
        <div className="flex h-8 w-8 items-center justify-center rounded-full text-white" style={{ background: BLUE }}>
          <IconUploadCloud className="h-4 w-4" />
        </div>
        <div className="h-2 w-[72px] rounded-full" style={{ background: LINE }} />
      </div>
    </div>
  );
}

export function BecomeSellerSection({ data }: { data: BecomeSellerData }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24">
      <div className="container-page">
        <div
          className="flex flex-col gap-10 rounded-[32px] p-7 sm:p-12 lg:flex-row lg:items-center lg:justify-between lg:gap-16 lg:p-16"
          style={{ background: `linear-gradient(120deg, ${BLUE_DEEP} 0%, color-mix(in srgb, ${BLUE_DEEP} 82%, ${BLUE}) 100%)` }}
        >
          <div className="min-w-0 lg:max-w-[600px]">
            <p className="text-[12.5px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_SOFT }}>
              {data.eyebrow}
            </p>
            <h2
              id={titleId}
              className="mt-3.5 font-[family-name:var(--font-heading)] text-2xl leading-[1.35] font-semibold text-balance text-white sm:text-[28px] lg:text-[32px] lg:leading-[1.3]"
            >
              {data.title} {data.highlight ? <span style={{ color: "#F4C979" }}>{data.highlight}</span> : null}
            </h2>
            {data.body.length > 0 ? (
              <div className="mt-4 space-y-3">
                {data.body.map((paragraph, index) => (
                  <p key={index} className="text-sm leading-[1.7] text-white/80 sm:text-[15px]">
                    {paragraph}
                  </p>
                ))}
              </div>
            ) : null}
            {data.bullets.length > 0 ? (
              <ul className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-x-7 sm:gap-y-4">
                {data.bullets.map((item, index) => (
                  <li key={`${index}-${item}`} className="flex items-start gap-2.5 text-sm text-white/85 sm:text-[14.5px]">
                    <IconCheck className="mt-0.5 h-4 w-4 shrink-0" style={{ color: "#F4C979" }} /> {item}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="mt-7 flex flex-col items-stretch gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-6 lg:mt-[30px]">
              <Link href={data.cta.href} className={`${CTA_PRIMARY} ${FOCUS_ON_DARK}`} style={{ background: AMBER, color: "#241503" }}>
                {data.cta.label}
              </Link>
              {data.secondaryCta ? (
                <Link href={data.secondaryCta.href} className={`${CTA_LINK} text-white ${FOCUS_ON_DARK}`}>
                  {data.secondaryCta.label} <IconArrow className="h-4 w-4" />
                </Link>
              ) : null}
            </div>
          </div>
          <SellerIllustration />
        </div>
      </div>
    </section>
  );
}

/** Lưới thẻ bước theo số bước (2–6) — class tĩnh để Tailwind sinh được. ≤ 4 bước: một hàng ở `lg` (có đường nối). */
const STEP_GRID: Record<number, string> = {
  2: "sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
  4: "sm:grid-cols-2 lg:grid-cols-4",
  5: "sm:grid-cols-2 lg:grid-cols-3",
  6: "sm:grid-cols-2 lg:grid-cols-3",
};

/**
 * ADR-050 — "Cách bắt đầu": `<ol>` thật (trình đọc màn hình đọc "danh sách N mục"); số bước hiển thị là trang trí
 * (`aria-hidden`), tiêu đề H3 có tiền tố ẩn "Bước n:". Mobile: dòng thời gian dọc (vòng số + vạch nối); `sm+`: thẻ.
 * Đường nối ngang giữa các thẻ chỉ ở `lg` khi các bước nằm một hàng — trang trí.
 */
export function StepsSection({ data }: { data: StepsData }) {
  const titleId = useId();
  const count = data.items.length;
  if (count === 0) return null;
  const oneRow = count <= 4;
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24" style={{ background: PAPER_ALT }}>
      <div className="container-page flex flex-col items-center">
        {data.eyebrow ? (
          <p className="mb-2 text-center text-[13px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_TEXT }}>
            {data.eyebrow}
          </p>
        ) : null}
        <h2 id={titleId} className="text-center font-[family-name:var(--font-heading)] text-[25px] font-semibold text-balance sm:text-[28px] lg:text-[32px]">
          {data.title}
        </h2>
        <ol role="list" className={`mt-9 grid w-full grid-cols-1 gap-0 sm:mt-11 sm:gap-5 lg:gap-6 ${STEP_GRID[count] ?? STEP_GRID[6]}`}>
          {data.items.map((item, index) => {
            const last = index === count - 1;
            return (
              <li key={item.id} className="relative flex gap-4 sm:flex-col sm:gap-0 sm:rounded-3xl sm:border sm:bg-white sm:p-6" style={{ borderColor: LINE }}>
                <div className="flex flex-col items-center sm:mb-4 sm:items-start">
                  <span
                    aria-hidden="true"
                    className="relative z-[1] flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-heading)] text-[15px] font-bold text-white tabular-nums"
                    style={{ background: BLUE, boxShadow: `0 0 0 6px ${tint(BLUE, 12)}` }}
                  >
                    {index + 1}
                  </span>
                  {last ? null : <span aria-hidden="true" className="mt-2 w-0.5 flex-1 rounded-full sm:hidden" style={{ background: LINE }} />}
                </div>
                {/* Đường nối ngang (lg, một hàng): từ mép phải thẻ này tới thẻ sau, ngang tâm vòng số. */}
                {oneRow && !last ? (
                  <span aria-hidden="true" className="absolute top-[44px] -right-6 hidden h-0.5 w-6 lg:block" style={{ background: LINE }} />
                ) : null}
                <div className={`min-w-0 pt-1.5 sm:pt-0 ${last ? "" : "pb-7 sm:pb-0"}`}>
                  <h3 className="mb-1.5 text-base font-bold sm:mb-2 sm:text-[17px]">
                    <span className="sr-only">Bước {index + 1}: </span>
                    {item.title}
                  </h3>
                  <p className="text-sm leading-[1.6] sm:text-[14.5px]" style={{ color: INK_SOFT }}>
                    {item.description}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
        {data.cta ? (
          <Link href={data.cta.href} className={`mt-9 w-full sm:mt-10 sm:w-auto ${CTA_PRIMARY} ${FOCUS_ON_LIGHT}`} style={{ background: AMBER, color: "#241503", outlineColor: BLUE }}>
            {data.cta.label}
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/** Ngày lịch `YYYY-MM-DD` (đã là ngày giờ VN) → "23/10/2026"; định dạng theo UTC để không lệch ngày. */
function formatDevlogDate(date: string): string {
  return new Date(`${date}T00:00:00Z`).toLocaleDateString("vi-VN", { timeZone: "UTC", day: "2-digit", month: "2-digit", year: "numeric" });
}

/** Lưới lời chứng thực theo số mục — 1 mục căn giữa, không kéo giãn hết chiều ngang. */
function testimonialGrid(count: number): string {
  if (count === 1) return "grid-cols-1 sm:w-full sm:max-w-[560px]";
  if (count === 2) return "grid-cols-1 sm:grid-cols-2 lg:max-w-[960px]";
  return "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3";
}

/**
 * ADR-050 — "Cùng nhau phát triển": `view` đã resolve ở server (`resolveCommunityView`) — lời chứng thực chỉ gồm mục đã
 * xác nhận đồng ý, **không sao**; nhật ký sắp mới nhất trước; lời mời là fallback. Tiêu đề/mô tả từ CMS.
 * - testimonials: `<figure>` = trích dẫn (`blockquote`) + `figcaption` (tên, vai trò); vòng chữ cái đầu thay ảnh (trang trí).
 * - devlog: dòng thời gian dọc — `<time>` + H3 + tóm tắt + "Đọc thêm" (tuỳ chọn).
 * - invite: một thẻ lời mời + 1 CTA.
 */
export function CommunitySection({ data, view }: { data: CommunityData; view: HomeCommunityView }) {
  const titleId = useId();
  if (view.kind !== "invite" && view.items.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24">
      <div className="container-page flex flex-col items-center">
        {data.eyebrow ? (
          <p className="mb-2 text-center text-[13px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_TEXT }}>
            {data.eyebrow}
          </p>
        ) : null}
        <h2 id={titleId} className="text-center font-[family-name:var(--font-heading)] text-[25px] font-semibold text-balance sm:text-[28px] lg:text-[32px]">
          {data.title}
        </h2>
        {data.description ? (
          <p className="mt-3 max-w-[720px] text-center text-[14.5px] leading-[1.7] sm:text-[15.5px]" style={{ color: INK_SOFT }}>
            {data.description}
          </p>
        ) : null}

        {view.kind === "testimonials" ? (
          <ul className={`mt-9 grid w-full gap-5 sm:mt-11 lg:gap-7 ${testimonialGrid(view.items.length)}`}>
            {view.items.map((t, i) => {
              const color = ROTATING_COLORS[i % ROTATING_COLORS.length]!;
              return (
                <li key={t.id} className="flex">
                  <figure className="flex w-full flex-col rounded-3xl border bg-white p-6 sm:p-[30px]" style={{ borderColor: LINE }}>
                    <IconQuote className="mb-3 h-7 w-7" style={{ color: tint(AMBER, 55) }} />
                    <blockquote className="mb-5 grow text-[15px] leading-[1.7]" style={{ color: INK }}>
                      <p>{t.quote}</p>
                    </blockquote>
                    <figcaption className="flex items-center gap-3 border-t pt-4 sm:pt-[18px]" style={{ borderColor: LINE }}>
                      <span
                        aria-hidden="true"
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                        style={{ background: tint(color, 14), color }}
                      >
                        {initialsOf(t.name)}
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-bold sm:text-[14.5px]">{t.name}</span>
                        {t.role ? (
                          <span className="block text-xs sm:text-[13px]" style={{ color: INK_SOFT }}>
                            {t.role}
                          </span>
                        ) : null}
                      </span>
                    </figcaption>
                  </figure>
                </li>
              );
            })}
          </ul>
        ) : view.kind === "devlog" ? (
          <ol role="list" className="mt-9 w-full max-w-[768px] sm:mt-11">
            {view.items.map((item, index) => {
              const last = index === view.items.length - 1;
              return (
                <li key={item.id} className="relative flex gap-4 sm:gap-5">
                  <div aria-hidden="true" className="flex flex-col items-center">
                    <span className="mt-6 h-3 w-3 shrink-0 rounded-full" style={{ background: index === 0 ? AMBER : BLUE, boxShadow: `0 0 0 5px ${tint(index === 0 ? AMBER : BLUE, 16)}` }} />
                    {last ? null : <span className="mt-2 w-0.5 flex-1 rounded-full" style={{ background: LINE }} />}
                  </div>
                  <article className={`min-w-0 flex-1 rounded-2xl border bg-white p-5 sm:p-6 ${last ? "" : "mb-4"}`} style={{ borderColor: LINE }}>
                    <time dateTime={item.date} className="text-xs font-semibold tracking-wide tabular-nums" style={{ color: INK_SOFT }}>
                      {formatDevlogDate(item.date)}
                    </time>
                    <h3 className="mt-1 text-base font-bold sm:text-[17px]">{item.title}</h3>
                    <p className="mt-1.5 text-sm leading-[1.65] sm:text-[14.5px]" style={{ color: INK_SOFT }}>
                      {item.summary}
                    </p>
                    {item.href ? (
                      <Link
                        href={item.href}
                        className={`mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-sm text-sm font-semibold hover:underline lg:min-h-0 lg:py-1 ${FOCUS_ON_LIGHT}`}
                        style={{ color: BLUE, outlineColor: BLUE }}
                      >
                        Đọc thêm<span className="sr-only">: {item.title}</span> <IconArrow className="h-3.5 w-3.5" />
                      </Link>
                    ) : null}
                  </article>
                </li>
              );
            })}
          </ol>
        ) : (
          <div
            className="mt-8 flex w-full max-w-[720px] flex-col items-center gap-5 rounded-3xl border bg-white px-6 py-8 text-center sm:px-10 sm:py-10"
            style={{ borderColor: LINE }}
          >
            <span aria-hidden="true" className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: tint(GREEN, 14), color: GREEN }}>
              <IconUsers className="h-6 w-6" />
            </span>
            <p className="text-[15px] leading-[1.7] whitespace-pre-line sm:text-base" style={{ color: INK }}>
              {view.text}
            </p>
            {view.cta ? (
              <Link
                href={view.cta.href}
                className={`w-full sm:w-auto ${CTA_PRIMARY} text-white ${FOCUS_ON_LIGHT}`}
                style={{ background: BLUE, outlineColor: BLUE }}
              >
                {view.cta.label}
              </Link>
            ) : null}
          </div>
        )}
      </div>
    </section>
  );
}

/**
 * ADR-050 — FAQ bằng `<details>/<summary>` gốc (mở bằng bàn phím Enter/Space, không cần JS). Câu hỏi là H3 trong `<summary>`,
 * vùng bấm ≥ 48px, vòng focus rõ, mũi tên xoay (tắt chuyển động khi `prefers-reduced-motion`); trạng thái mở có viền primary +
 * mũi tên đổi hướng (không chỉ màu). Không mở sẵn câu nào. Không có câu hỏi → không render section.
 */
export function FaqSection({ data }: { data: FaqData }) {
  const titleId = useId();
  if (data.items.length === 0) return null;
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-20 lg:py-24" style={{ background: PAPER_ALT }}>
      <div className="container-prose">
        {data.eyebrow ? (
          <p className="mb-2 text-center text-[13px] font-bold tracking-wide sm:text-[13.5px]" style={{ color: AMBER_TEXT }}>
            {data.eyebrow}
          </p>
        ) : null}
        <h2 id={titleId} className="text-center font-[family-name:var(--font-heading)] text-[25px] font-semibold text-balance sm:text-[28px] lg:text-[32px]">
          {data.title}
        </h2>
        <div className="mt-8 space-y-3 sm:mt-10">
          {data.items.map((item) => (
            <details
              key={item.id}
              className="group rounded-2xl border bg-white transition-colors open:border-[color:var(--faq-open)] motion-reduce:transition-none"
              style={{ borderColor: LINE, ["--faq-open" as string]: BLUE }}
            >
              <summary
                className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-3.5 outline-offset-2 focus-visible:outline-2 sm:px-6 sm:py-4 [&::-webkit-details-marker]:hidden [touch-action:manipulation]"
                style={{ outlineColor: BLUE }}
              >
                <h3 className="text-[15px] leading-snug font-semibold sm:text-base">{item.question}</h3>
                <span
                  aria-hidden="true"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-[background-color] group-open:bg-[color:var(--faq-open)] group-open:text-white motion-reduce:transition-none"
                  style={{ background: PAPER_ALT, color: BLUE }}
                >
                  <IconChevron className="h-4 w-4 transition-transform group-open:rotate-180 motion-reduce:transition-none" />
                </span>
              </summary>
              <div className="px-5 pb-5 sm:px-6">
                <p className="border-t pt-4 text-[14.5px] leading-[1.75] whitespace-pre-line sm:text-[15px]" style={{ color: INK_SOFT, borderColor: LINE }}>
                  {item.answer}
                </p>
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCtaSection({ data, slogan }: { data: FinalCtaData; slogan: string }) {
  const titleId = useId();
  return (
    <section aria-labelledby={titleId} className="py-14 sm:py-[76px]" style={{ background: AMBER }}>
      <div className="container-page flex flex-col items-center gap-5 text-center">
        <h2 id={titleId} className="font-[family-name:var(--font-heading)] text-2xl font-semibold text-balance sm:text-[28px] lg:text-[32px]" style={{ color: "#241503" }}>
          {data.title}
        </h2>
        <p className="max-w-[640px] text-sm leading-[1.7] sm:text-base" style={{ color: "#2E1C04" }}>
          {data.subtitle}
        </p>
        <div className="mt-1.5 flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
          <Link href={data.cta.href} className={`w-full sm:w-auto ${CTA_PRIMARY} text-white ${FOCUS_ON_LIGHT}`} style={{ background: BLUE, outlineColor: "#241503" }}>
            {data.cta.label}
          </Link>
          {data.secondaryCta ? (
            <Link
              href={data.secondaryCta.href}
              className={`w-full border-2 sm:w-auto ${CTA_PRIMARY} ${FOCUS_ON_LIGHT}`}
              style={{ borderColor: "#241503", color: "#241503", outlineColor: "#241503" }}
            >
              {data.secondaryCta.label}
            </Link>
          ) : null}
        </div>
        {data.showSlogan && slogan ? (
          <p className="flex items-center gap-2 text-sm font-semibold" style={{ color: "#2E1C04" }}>
            <IconSprout className="h-4 w-4 shrink-0" />
            {slogan}
          </p>
        ) : null}
      </div>
    </section>
  );
}
