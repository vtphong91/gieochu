import Link from "next/link";
import { formatPlanLimit } from "@gieochu/core/plan-limits";
import type {
  PricingComparisonData,
  PricingComparisonRow,
  PricingCtaFinalData,
  PricingFaqData,
  PricingHeroData,
  PricingPaymentMethodsData,
  PricingPriceNoteData,
  PricingWhyUsData,
} from "@gieochu/core/pricing-sections";
import type { PricingCardCtas, PricingCta, PricingPlanInfo, PricingStatItem } from "../../../lib/pricing-cms";
import { IconAlertTriangle, IconCheckCircle, IconChevronDown, IconXCircle } from "../../admin/_ui/icons";
import { AMBER, AMBER_SOFT, BLUE, BLUE_DEEP, FOCUS_RING, GREEN, INK, INK_SOFT, LINE, PAPER_ALT } from "../catalog-parts";
import { describePlanPrice, formatPricingStat, pricingProviderIcon, pricingProviderLabel, pricingWhyUsIcon } from "./pricing-format";

/**
 * Các khu vực tĩnh (server component) của `/pricing` — ADR-041 A, đề xuất Phong §6. Nội dung đọc từ CMS (`getPricingPageData`,
 * đã thay biến), số/giá/hạn mức đọc từ dữ liệu thật. Khu vực rỗng trả `null` (page tự bỏ). Nền section full-bleed, nội dung bọc
 * `container-page` / `container-prose` (ADR-024). Heading: H1 ở hero, H2 mỗi khu vực, H3 bên trong.
 */

const SECTION_Y = "py-12 sm:py-16";
const H2_CLASS = "font-[family-name:var(--font-heading)] text-2xl leading-tight font-semibold text-balance sm:text-[30px]";

function SectionHeading({ id, title, subtitle, light = false, center = true }: { id: string; title: string; subtitle?: string; light?: boolean; center?: boolean }) {
  return (
    <div className={center ? "mx-auto max-w-[680px] text-center" : "max-w-[680px]"}>
      <h2 id={id} className={H2_CLASS} style={light ? { color: "#FFFFFF" } : undefined}>
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-3 text-[15px] leading-relaxed sm:text-base" style={{ color: light ? "rgba(255,255,255,0.85)" : INK_SOFT }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

// ───────────── Dải xem trước nháp ─────────────

export function PricingPreviewBanner() {
  return (
    <div className="border-b" style={{ background: AMBER_SOFT, borderColor: AMBER }}>
      <div className="container-page flex flex-col gap-2 py-3 text-sm sm:flex-row sm:items-center sm:justify-between">
        <p className="flex items-start gap-2" style={{ color: INK }}>
          <span className="mt-0.5 shrink-0" style={{ color: INK }}>
            <IconAlertTriangle className="h-4 w-4" />
          </span>
          <span>
            <strong>Đang xem bản nháp</strong> — trang công khai chưa thay đổi. Nút hành động hiển thị như khách chưa đăng nhập.
          </span>
        </p>
        <Link href="/admin/cms/pricing" className={`inline-flex min-h-11 shrink-0 items-center font-semibold underline underline-offset-2 sm:min-h-0 ${FOCUS_RING}`} style={{ color: BLUE, outlineColor: BLUE }}>
          Quay lại trình chỉnh sửa
        </Link>
      </div>
    </div>
  );
}

// ───────────── Hero ─────────────

export function PricingHero({ data }: { data: PricingHeroData }) {
  return (
    <section className="pt-12 pb-8 sm:pt-16 sm:pb-10">
      <div className="container-page">
        <div className="mx-auto max-w-[760px] text-center">
          <p className="text-[13px] font-bold tracking-wide uppercase sm:text-sm" style={{ color: BLUE }}>
            {data.eyebrow}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-heading)] text-[30px] leading-[1.2] font-bold text-balance [overflow-wrap:anywhere] sm:text-[40px] lg:text-[46px]">
            {data.title}
          </h1>
          <p className="mx-auto mt-4 max-w-[60ch] text-base leading-relaxed sm:text-lg" style={{ color: INK_SOFT }}>
            {data.subtitle}
          </p>
          {data.badge ? (
            <p className="mt-5 inline-flex items-center gap-1.5 rounded-full border bg-white px-4 py-1.5 text-sm font-semibold" style={{ borderColor: LINE }}>
              <span style={{ color: GREEN }}>
                <IconCheckCircle className="h-4 w-4" />
              </span>
              {data.badge}
            </p>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ───────────── Ghi chú giá ─────────────

export function PricingPriceNote({ data }: { data: PricingPriceNoteData }) {
  if (data.lines.length === 0) return null;
  return (
    <section aria-label="Ghi chú về giá" className="pb-12 sm:pb-16">
      <div className="container-page">
        <ul className="mx-auto max-w-[760px] space-y-1.5 text-center text-[13.5px] leading-relaxed sm:text-sm" style={{ color: INK_SOFT }}>
          {data.lines.map((line, i) => (
            <li key={`${i}-${line}`}>{line}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// ───────────── Số liệu thật ─────────────

export function PricingStats({ title, items }: { title: string; items: PricingStatItem[] }) {
  if (items.length === 0) return null;
  return (
    <section aria-labelledby="pricing-stats-title" className="py-10 sm:py-12" style={{ background: BLUE }}>
      <div className="container-page">
        <h2 id="pricing-stats-title" className="text-center font-[family-name:var(--font-heading)] text-lg font-semibold text-white sm:text-xl">
          {title}
        </h2>
        {/* dl: nhãn (dt) đứng trước số (dd) trong DOM để đọc "Nhãn: số"; hiển thị đảo bằng flex-col-reverse (cùng mẫu trang chủ). */}
        <dl className={`mt-6 grid gap-x-6 gap-y-6 sm:flex sm:flex-wrap sm:justify-around ${items.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
          {items.map((item) => {
            const stat = formatPricingStat(item.value);
            return (
              <div key={item.key} className="flex min-w-0 flex-col-reverse items-center text-center sm:min-w-[140px]">
                <dt className="mt-1 text-[13px] leading-snug sm:text-sm" style={{ color: "rgba(255,255,255,0.85)" }}>
                  {item.label}
                </dt>
                <dd className="font-[family-name:var(--font-heading)] text-[30px] leading-none font-bold text-white tabular-nums sm:text-[36px]">
                  <span aria-hidden="true">{stat.visual}</span>
                  <span className="sr-only">{stat.spoken}</span>
                </dd>
              </div>
            );
          })}
        </dl>
      </div>
    </section>
  );
}

// ───────────── Bảng so sánh ─────────────

type CellView = { kind: "yes" } | { kind: "no" } | { kind: "dash" } | { kind: "text"; text: string };

function cellFor(row: PricingComparisonRow, plan: PricingPlanInfo): CellView {
  switch (row.kind) {
    case "limit": {
      const value = plan[row.field];
      return value === 0 ? { kind: "no" } : { kind: "text", text: formatPlanLimit(row.field, value) };
    }
    case "feature":
      return plan.features[row.featureKey] ? { kind: "yes" } : { kind: "no" };
    case "custom": {
      const cell = row.cells[plan.id];
      if (!cell) return { kind: row.fallback };
      if (cell.value === "text") return cell.text ? { kind: "text", text: cell.text } : { kind: "dash" };
      return { kind: cell.value };
    }
  }
}

function Cell({ view }: { view: CellView }) {
  switch (view.kind) {
    case "yes":
      return (
        <>
          <span aria-hidden="true" className="inline-flex" style={{ color: GREEN }}>
            <IconCheckCircle className="h-5 w-5" />
          </span>
          <span className="sr-only">Có</span>
        </>
      );
    case "no":
      return (
        <>
          <span aria-hidden="true" className="inline-flex" style={{ color: INK_SOFT }}>
            <IconXCircle className="h-5 w-5" />
          </span>
          <span className="sr-only">Không</span>
        </>
      );
    case "dash":
      return (
        <>
          <span aria-hidden="true" style={{ color: INK_SOFT }}>
            —
          </span>
          <span className="sr-only">Không áp dụng</span>
        </>
      );
    case "text":
      return <span className="font-medium [overflow-wrap:anywhere]">{view.text}</span>;
  }
}

function HeaderCta({ cta }: { cta: PricingCta | null }) {
  if (!cta?.href) return null;
  return (
    <Link
      href={cta.href}
      className={`mt-3 hidden min-h-10 items-center justify-center rounded-full px-4 text-[13px] font-bold text-white transition-[filter] hover:brightness-110 md:inline-flex ${FOCUS_RING}`}
      style={{ background: BLUE, outlineColor: BLUE }}
    >
      {cta.label}
    </Link>
  );
}

export function PricingComparison({
  data,
  plans,
  ctasByPlan,
  currentPlanId,
  currentLabel,
}: {
  data: PricingComparisonData;
  plans: PricingPlanInfo[];
  /** CTA của thẻ gói ứng với từng cột (gói có thẻ đang hiện). */
  ctasByPlan: Map<string, PricingCardCtas>;
  currentPlanId: string | null;
  /** Nhãn "Gói hiện tại" (CMS `ctaLabels.current`). */
  currentLabel: string;
}) {
  const groups = data.groups.filter((group) => group.rows.length > 0);
  if (plans.length === 0 || groups.length === 0) return null;
  const minWidth = 176 + plans.length * 136;

  return (
    <section aria-labelledby="pricing-comparison-title" className={SECTION_Y} style={{ background: PAPER_ALT }}>
      <div className="container-page">
        <SectionHeading id="pricing-comparison-title" title={data.title} subtitle={data.subtitle} />
        {plans.length > 2 ? (
          <p className="mt-6 text-center text-[13px] md:hidden" style={{ color: INK_SOFT }}>
            Vuốt ngang trong bảng để xem đủ các gói.
          </p>
        ) : null}
        {/* Bảng thật trong vùng cuộn ngang RIÊNG (trang không cuộn ngang); tabIndex để cuộn bằng phím. `relative` giữ các span
            `sr-only` (absolute) trong vùng cuộn — thiếu nó, chúng kéo rộng cả trang ở màn hẹp. */}
        <div
          role="region"
          aria-labelledby="pricing-comparison-title"
          tabIndex={0}
          className={`relative mt-4 overflow-x-auto rounded-2xl border bg-white md:mt-8 ${FOCUS_RING}`}
          style={{ borderColor: LINE, outlineColor: BLUE }}
        >
          <table className="w-full border-collapse text-left text-[14.5px]" style={{ minWidth }}>
            <caption className="sr-only">{data.title}</caption>
            <thead>
              <tr className="border-b" style={{ borderColor: LINE }}>
                <td className="sticky left-0 z-[1] w-44 bg-white px-4 py-4" />
                {plans.map((plan) => {
                  const price = describePlanPrice(plan);
                  const isCurrent = plan.id === currentPlanId;
                  return (
                    <th key={plan.id} scope="col" className="px-4 py-4 text-center align-top font-normal">
                      <span className="block font-[family-name:var(--font-heading)] text-base font-semibold [overflow-wrap:anywhere]">{plan.name}</span>
                      <span aria-hidden="true" className="mt-1 block text-[13px] tabular-nums" style={{ color: INK_SOFT }}>
                        {price.amount} {price.period}
                      </span>
                      <span className="sr-only">, {price.spoken}</span>
                      {isCurrent ? (
                        <span className="mt-1.5 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: AMBER_SOFT, color: INK }}>
                          <span className="sr-only">(</span>
                          {currentLabel}
                          <span className="sr-only">)</span>
                        </span>
                      ) : null}
                      {data.showPlanHeaderCta ? (
                        <span className="block">
                          <HeaderCta cta={ctasByPlan.get(plan.id)?.primary ?? null} />
                        </span>
                      ) : null}
                    </th>
                  );
                })}
              </tr>
            </thead>
            {groups.map((group) => (
              <tbody key={group.id}>
                <tr>
                  <th scope="rowgroup" colSpan={plans.length + 1} className="px-4 pt-6 pb-2 text-left text-[13px] font-bold tracking-wide uppercase" style={{ color: BLUE }}>
                    <span className="sticky left-4">{group.title}</span>
                  </th>
                </tr>
                {group.rows.map((row) => (
                  <tr key={row.id} className="border-t" style={{ borderColor: LINE }}>
                    <th scope="row" className="sticky left-0 z-[1] w-44 bg-white px-4 py-3.5 align-top font-medium">
                      <span className="block [overflow-wrap:anywhere]">{row.label}</span>
                      {row.hint ? (
                        <span className="mt-0.5 block text-[12.5px] leading-snug font-normal" style={{ color: INK_SOFT }}>
                          {row.hint}
                        </span>
                      ) : null}
                    </th>
                    {plans.map((plan) => (
                      <td key={plan.id} className="px-4 py-3.5 text-center align-middle tabular-nums">
                        <Cell view={cellFor(row, plan)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            ))}
          </table>
        </div>
      </div>
    </section>
  );
}

// ───────────── Vì sao chọn ─────────────

export function PricingWhyUs({ data }: { data: PricingWhyUsData }) {
  if (data.items.length === 0) return null;
  return (
    <section aria-labelledby="pricing-why-title" className={SECTION_Y}>
      <div className="container-page">
        <SectionHeading id="pricing-why-title" title={data.title} subtitle={data.subtitle} />
        <ul className="mt-8 grid gap-4 sm:mt-10 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3">
          {data.items.map((item, i) => {
            const Icon = pricingWhyUsIcon(item.icon);
            return (
              <li key={`${i}-${item.title}`} className="rounded-3xl border bg-white p-6" style={{ borderColor: LINE }}>
                <span aria-hidden="true" className="flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: AMBER_SOFT, color: INK }}>
                  <Icon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 font-[family-name:var(--font-heading)] text-lg leading-snug font-semibold">{item.title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed" style={{ color: INK_SOFT }}>
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

// ───────────── FAQ ─────────────

export function PricingFaq({ data }: { data: PricingFaqData }) {
  if (data.items.length === 0) return null;
  return (
    <section aria-labelledby="pricing-faq-title" className={SECTION_Y} style={{ background: PAPER_ALT }}>
      <div className="container-prose">
        <SectionHeading id="pricing-faq-title" title={data.title} />
        <div className="mt-8 space-y-3">
          {data.items.map((item) => (
            <details key={item.id} className="group rounded-2xl border bg-white" style={{ borderColor: LINE }}>
              <summary
                className={`flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 rounded-2xl px-5 py-4 text-[15.5px] font-semibold [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
                style={{ outlineColor: BLUE }}
              >
                <span className="[overflow-wrap:anywhere]">{item.question}</span>
                <span aria-hidden="true" className="shrink-0 motion-safe:transition-transform group-open:rotate-180" style={{ color: INK_SOFT }}>
                  <IconChevronDown className="h-5 w-5" />
                </span>
              </summary>
              <div className="px-5 pb-5 text-[15px] leading-[1.7] whitespace-pre-line [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                {item.answer}
              </div>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

// ───────────── CTA cuối trang ─────────────

export function PricingCtaFinal({ data, cta }: { data: PricingCtaFinalData; cta: PricingCta }) {
  return (
    <section aria-labelledby="pricing-cta-title" className="py-10 sm:py-14">
      <div className="container-page">
        <div
          className="flex flex-col items-start gap-6 rounded-[28px] p-7 sm:p-10 lg:flex-row lg:items-center lg:justify-between lg:p-14"
          style={{ background: `linear-gradient(120deg, ${BLUE_DEEP} 0%, color-mix(in srgb, ${BLUE} 45%, ${BLUE_DEEP}) 100%)` }}
        >
          <div className="min-w-0 lg:max-w-[640px]">
            <h2 id="pricing-cta-title" className="font-[family-name:var(--font-heading)] text-2xl leading-[1.3] font-semibold text-balance text-white [overflow-wrap:anywhere] sm:text-[28px] lg:text-[32px]">
              {data.title}
            </h2>
            <p className="mt-3 text-[15px] leading-relaxed sm:text-base" style={{ color: "rgba(255,255,255,0.85)" }}>
              {data.description}
            </p>
          </div>
          {cta.href ? (
            <Link
              href={cta.href}
              className="inline-flex min-h-12 w-full shrink-0 items-center justify-center rounded-full bg-white px-7 text-[15px] font-bold transition-[filter] outline-offset-2 hover:brightness-95 focus-visible:outline-2 focus-visible:outline-white sm:w-auto [touch-action:manipulation]"
              style={{ color: BLUE }}
            >
              {cta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

// ───────────── Phương thức thanh toán ─────────────

export function PricingPaymentMethods({ data, providers }: { data: PricingPaymentMethodsData; providers: readonly string[] }) {
  if (providers.length === 0) return null;
  return (
    <section aria-labelledby="pricing-payment-title" className="pt-4 pb-14 sm:pb-20">
      <div className="container-page">
        <SectionHeading id="pricing-payment-title" title={data.title} subtitle={data.description} />
        <ul className="mt-6 flex flex-wrap justify-center gap-3">
          {providers.map((provider) => {
            const Icon = pricingProviderIcon(provider);
            return (
              <li key={provider} className="inline-flex min-h-11 items-center gap-2 rounded-full border bg-white px-4 py-2 text-sm font-semibold" style={{ borderColor: LINE }}>
                <span aria-hidden="true" style={{ color: BLUE }}>
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                {pricingProviderLabel(provider, data.labels[provider as keyof typeof data.labels])}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

