"use client";

import { useState } from "react";
import Link from "next/link";
import { formatPlanLimit, PLAN_LIMIT_FIELD_LABELS, PLAN_LIMIT_FIELDS } from "@gieochu/core/plan-limits";
import { applyPricingTemplate, type PricingPlansData } from "@gieochu/core/pricing-sections";
import type { PricingCardCtas, PricingCta, PricingPlanCard, PricingPlanInfo } from "../../../lib/pricing-cms";
import { IconCheckCircle, IconXCircle } from "../../admin/_ui/icons";
import { AMBER, AMBER_SOFT, BLUE, FOCUS_RING, GREEN, INK, INK_SOFT, LINE, pastelOf } from "../catalog-parts";
import { describePlanPrice } from "./pricing-format";

/**
 * Khu vực "Thẻ gói" của `/pricing` (ADR-041 A, đề xuất Phong §6). Client vì có nút chuyển chu kỳ Tháng / Năm (state cục bộ —
 * không có JS thì hiện giá chu kỳ chính). Giá/hạn mức/CTA đã tính ở server (`getPricingPageData`); ở đây chỉ trình bày.
 *
 * A11y: mỗi thẻ là `<article aria-labelledby>`; giá có bản đọc trọn câu (`sr-only`); "Gói hiện tại"/nhãn nổi bật là chữ thật
 * (không chỉ viền màu); nút chuyển chu kỳ là nhóm radio (`fieldset` + `legend` ẩn), đổi chu kỳ cập nhật giá tại chỗ, không dời
 * focus, một vùng `role="status"` đọc chu kỳ đang hiển thị. Một nút chính mỗi thẻ (nền primary, chữ trắng — accent + chữ trắng
 * không đạt AA).
 */

type Cycle = "primary" | "alt";
type HeadingLevel = "h2" | "h3";

const GRID_BY_COUNT: Record<number, string> = {
  1: "mx-auto max-w-md",
  2: "mx-auto max-w-4xl sm:grid-cols-2",
  3: "sm:grid-cols-2 lg:grid-cols-3",
};
const GRID_DEFAULT = "sm:grid-cols-2 xl:grid-cols-4";

const PRIMARY_BUTTON = `inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full px-5 text-[15px] font-bold text-white transition-[filter] hover:brightness-110 [touch-action:manipulation] ${FOCUS_RING}`;
const GHOST_BUTTON = `inline-flex min-h-11 w-full items-center justify-center rounded-full border px-5 text-sm font-semibold transition-colors hover:bg-black/[0.03] [touch-action:manipulation] ${FOCUS_RING}`;

export interface PricingPlansProps {
  data: Pick<PricingPlansData, "title" | "subtitle" | "showAutoLimits" | "cycleToggle">;
  cards: PricingPlanCard[];
  /** Ngày hết hạn kỳ hiện tại của người xem (đã định dạng ở server, Asia/Ho_Chi_Minh); null nếu không có. */
  currentPeriodEndLabel: string | null;
}

export function PricingPlans({ data, cards, currentPeriodEndLabel }: PricingPlansProps) {
  const [cycle, setCycle] = useState<Cycle>("primary");
  const [announcement, setAnnouncement] = useState("");
  const hasPair = cards.some((card) => card.altPlan !== null);
  const savings = Array.from(new Set(cards.flatMap((card) => (card.altPlan && card.savingsPercent !== null ? [card.savingsPercent] : []))));
  // % chung trên nút chỉ khi mọi thẻ ghép cặp tiết kiệm như nhau — khác nhau thì để từng thẻ tự ghi (không phóng đại).
  const toggleSavings = savings.length === 1 ? applyPricingTemplate(data.cycleToggle.savingsTemplate, { brand: "", graceDays: 0, percent: savings[0] }) : null;
  const headingLevel: HeadingLevel = data.title ? "h3" : "h2";

  function choose(next: Cycle) {
    setCycle(next);
    setAnnouncement(`Đang hiển thị giá ${next === "alt" ? data.cycleToggle.altLabel : data.cycleToggle.primaryLabel}.`);
  }

  return (
    <section aria-labelledby={data.title ? "pricing-plans-title" : undefined} aria-label={data.title ? undefined : "Các gói dịch vụ"} className="pt-4 pb-10 sm:pb-12">
      <div className="container-page">
        {data.title || data.subtitle ? (
          <div className="mx-auto mb-8 max-w-[680px] text-center">
            {data.title ? (
              <h2 id="pricing-plans-title" className="font-[family-name:var(--font-heading)] text-2xl leading-tight font-semibold text-balance sm:text-[30px]">
                {data.title}
              </h2>
            ) : null}
            {data.subtitle ? (
              <p className="mt-3 text-[15px] leading-relaxed sm:text-base" style={{ color: INK_SOFT }}>
                {data.subtitle}
              </p>
            ) : null}
          </div>
        ) : null}

        {hasPair ? (
          <div className="mb-8 flex justify-center">
            <fieldset className="flex w-full max-w-md gap-1 rounded-full border bg-white p-1 sm:w-auto" style={{ borderColor: LINE }}>
              <legend className="sr-only">Chu kỳ thanh toán</legend>
              {(["primary", "alt"] as const).map((value) => {
                const checked = cycle === value;
                return (
                  <label
                    key={value}
                    className="flex min-h-11 flex-1 cursor-pointer items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 sm:flex-none sm:px-6"
                    style={{ background: checked ? BLUE : "transparent", color: checked ? "#FFFFFF" : INK, outlineColor: BLUE }}
                  >
                    <input type="radio" name="pricing-cycle" value={value} checked={checked} onChange={() => choose(value)} className="sr-only" />
                    {value === "alt" ? data.cycleToggle.altLabel : data.cycleToggle.primaryLabel}
                    {value === "alt" && toggleSavings ? (
                      <span className="rounded-full px-2 py-0.5 text-xs font-bold" style={{ background: checked ? "rgba(255,255,255,0.18)" : AMBER_SOFT, color: checked ? "#FFFFFF" : INK }}>
                        {toggleSavings}
                      </span>
                    ) : null}
                  </label>
                );
              })}
            </fieldset>
          </div>
        ) : null}
        <p role="status" className="sr-only">
          {announcement}
        </p>

        <div className={`grid items-stretch gap-5 ${GRID_BY_COUNT[cards.length] ?? GRID_DEFAULT}`}>
          {cards.map((card) => (
            <PlanCard
              key={card.item.planId}
              card={card}
              useAlt={cycle === "alt" && card.altPlan !== null}
              showLimits={data.showAutoLimits}
              savingsTemplate={data.cycleToggle.savingsTemplate}
              headingLevel={headingLevel}
              currentPeriodEndLabel={currentPeriodEndLabel}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function PlanCard({
  card,
  useAlt,
  showLimits,
  savingsTemplate,
  headingLevel,
  currentPeriodEndLabel,
}: {
  card: PricingPlanCard;
  useAlt: boolean;
  showLimits: boolean;
  savingsTemplate: string;
  headingLevel: HeadingLevel;
  currentPeriodEndLabel: string | null;
}) {
  const plan: PricingPlanInfo = useAlt && card.altPlan ? card.altPlan : card.plan;
  const ctas: PricingCardCtas = useAlt && card.altCtas ? card.altCtas : card.ctas;
  const isCurrent = useAlt ? card.isAltCurrent : card.isCurrent;
  const price = describePlanPrice(plan);
  const highlighted = card.item.highlighted;
  const headingId = `pricing-plan-${card.item.planId}`;
  const Heading = headingLevel;
  const currentLabel = ctas.primary?.kind === "current" ? ctas.primary.label : null;
  const savingsText = useAlt && card.savingsPercent !== null ? applyPricingTemplate(savingsTemplate, { brand: "", graceDays: 0, percent: card.savingsPercent }) : null;

  return (
    <article
      aria-labelledby={headingId}
      className="relative flex h-full flex-col rounded-3xl bg-white p-6 sm:p-7"
      style={{
        border: `${highlighted ? 2 : 1}px solid ${highlighted ? AMBER : isCurrent ? BLUE : LINE}`,
        boxShadow: highlighted ? "0 18px 40px -22px rgba(18,33,58,0.45)" : undefined,
      }}
    >
      {card.item.badge || (isCurrent && currentLabel) ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {card.item.badge ? (
            <span className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold" style={{ background: highlighted ? AMBER : AMBER_SOFT, color: INK }}>
              {card.item.badge}
            </span>
          ) : null}
          {isCurrent && currentLabel ? (
            <span className="inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold" style={{ background: pastelOf(BLUE, 12), color: INK }}>
              <IconCheckCircle className="h-3.5 w-3.5" /> {currentLabel}
            </span>
          ) : null}
        </div>
      ) : null}

      <Heading id={headingId} className="font-[family-name:var(--font-heading)] text-xl leading-snug font-semibold [overflow-wrap:anywhere]">
        {plan.name}
      </Heading>
      {card.item.tagline ? (
        <p className="mt-1.5 text-[14.5px] leading-relaxed" style={{ color: INK_SOFT }}>
          {card.item.tagline}
        </p>
      ) : null}

      <p className="mt-5 flex flex-wrap items-baseline gap-x-1.5 tabular-nums">
        <span aria-hidden="true" className="font-[family-name:var(--font-heading)] text-[32px] leading-none font-bold">
          {price.amount}
        </span>
        {price.period ? (
          <span aria-hidden="true" className="text-[15px]" style={{ color: INK_SOFT }}>
            {price.period}
          </span>
        ) : null}
        <span className="sr-only">{price.spoken}</span>
      </p>
      {savingsText ? (
        <p className="mt-2 inline-flex w-fit items-center rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: pastelOf(GREEN, 14), color: INK }}>
          {savingsText}
        </p>
      ) : null}
      {card.item.note ? (
        <p className="mt-2 text-[13.5px] leading-relaxed" style={{ color: INK_SOFT }}>
          {card.item.note}
        </p>
      ) : null}
      {isCurrent && !plan.isFree && currentPeriodEndLabel ? (
        <p className="mt-2 text-[13.5px]" style={{ color: INK_SOFT }}>
          Hết hạn ngày {currentPeriodEndLabel}
        </p>
      ) : null}

      <div className="mt-6 space-y-2.5">
        <CtaBlock cta={ctas.primary} primary />
        <CtaBlock cta={ctas.secondary} />
      </div>

      {showLimits || card.item.benefits.length > 0 ? (
        <div className="mt-6 border-t pt-5" style={{ borderColor: LINE }}>
          <ul className="space-y-2.5 text-[14.5px] leading-snug">
            {showLimits
              ? PLAN_LIMIT_FIELDS.map((field) => {
                  const value = plan[field];
                  const none = value === 0;
                  return (
                    <li key={field} className="flex items-start gap-2.5">
                      <span className="mt-0.5 shrink-0" style={{ color: none ? INK_SOFT : GREEN }}>
                        {none ? <IconXCircle className="h-[18px] w-[18px]" /> : <IconCheckCircle className="h-[18px] w-[18px]" />}
                      </span>
                      <span style={{ color: none ? INK_SOFT : INK }}>
                        {PLAN_LIMIT_FIELD_LABELS[field]}: <strong className="font-semibold">{formatPlanLimit(field, value)}</strong>
                      </span>
                    </li>
                  );
                })
              : null}
            {card.item.benefits.map((benefit, i) => (
              <li key={`${i}-${benefit}`} className="flex items-start gap-2.5">
                <span className="mt-0.5 shrink-0" style={{ color: GREEN }}>
                  <IconCheckCircle className="h-[18px] w-[18px]" />
                </span>
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

/** Nút chính (nền primary) / phụ (viền); `href = null` → nhãn chữ (gói hiện tại, dòng tự áp dụng khi hết hạn). */
function CtaBlock({ cta, primary = false }: { cta: PricingCta | null; primary?: boolean }) {
  if (!cta) return null;
  if (cta.href) {
    return primary ? (
      <Link href={cta.href} className={PRIMARY_BUTTON} style={{ background: BLUE, outlineColor: BLUE }}>
        {cta.label}
      </Link>
    ) : (
      <Link href={cta.href} className={GHOST_BUTTON} style={{ borderColor: LINE, color: BLUE, outlineColor: BLUE }}>
        {cta.label}
      </Link>
    );
  }
  if (cta.kind === "current") {
    return (
      <p className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-full border text-[15px] font-semibold" style={{ borderColor: LINE, color: INK, background: pastelOf(BLUE, 6) }}>
        <IconCheckCircle className="h-[18px] w-[18px]" /> {cta.label}
      </p>
    );
  }
  return (
    <p className="text-center text-[13.5px] leading-relaxed" style={{ color: INK_SOFT }}>
      {cta.label}
    </p>
  );
}
