"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
// Import trực tiếp từ subpath (không qua barrel "@gieochu/core" — barrel kéo code server-only vào bundle client).
import { HOME_STAT_DEFAULT_LABELS, HOME_STAT_KEYS, type HomeStatKey } from "@gieochu/core/home-sections";
import { PLAN_FEATURE_LABELS, type PlanFeatureKey } from "@gieochu/core/plan-features";
import { formatPlanLimit, PLAN_LIMIT_FIELD_LABELS, PLAN_LIMIT_FIELDS, type PlanLimitField } from "@gieochu/core/plan-limits";
import {
  computeCycleSavingsPercent,
  PRICING_BADGE_MAX,
  PRICING_BENEFIT_MAX,
  PRICING_BENEFITS_MAX,
  PRICING_CELL_TEXT_MAX,
  PRICING_COMPARISON_GROUP_TITLE_MAX,
  PRICING_COMPARISON_GROUPS_MAX,
  PRICING_COMPARISON_ROWS_MAX,
  PRICING_CTA_KEY_LABELS,
  PRICING_CTA_KEYS,
  PRICING_CTA_LABEL_MAX,
  PRICING_CYCLE_LABEL_MAX,
  PRICING_DESCRIPTION_MAX,
  PRICING_EYEBROW_MAX,
  PRICING_FAQ_ANSWER_MAX,
  PRICING_FAQ_MAX,
  PRICING_FAQ_QUESTION_MAX,
  PRICING_NOTE_MAX,
  PRICING_PAYMENT_LABEL_MAX,
  PRICING_PAYMENT_PROVIDER_IDS,
  PRICING_PLAN_BADGE_MAX,
  PRICING_PLAN_ITEMS_MAX,
  PRICING_PRICE_NOTE_LINE_MAX,
  PRICING_PRICE_NOTE_LINES_MAX,
  PRICING_PRICE_NOTE_LINES_MIN,
  PRICING_ROW_HINT_MAX,
  PRICING_ROW_LABEL_MAX,
  PRICING_SAVINGS_TEMPLATE_MAX,
  PRICING_STAT_LABEL_MAX,
  PRICING_SUBTITLE_MAX,
  PRICING_TAGLINE_MAX,
  PRICING_TITLE_MAX,
  PRICING_WHY_US_DESCRIPTION_MAX,
  PRICING_WHY_US_ICON_LABELS,
  PRICING_WHY_US_ICONS,
  PRICING_WHY_US_MAX,
  PRICING_WHY_US_MIN,
  PRICING_WHY_US_TITLE_MAX,
  type PricingComparisonCell,
  type PricingComparisonData,
  type PricingComparisonGroup,
  type PricingComparisonRow,
  type PricingCtaKey,
  type PricingPlanCardItem,
  type PricingPlansData,
  type PricingSection,
  type PricingWhyUsIcon,
} from "@gieochu/core/pricing-sections";
import { pricingProviderLabel, pricingWhyUsIcon } from "../../../../_ui/pricing/pricing-format";
import { Badge, Notice, SelectField, Toggle } from "../../../_ui/kit";
import { IconExternalLink } from "../../../_ui/icons";
import { SortableListEditor } from "../../_ui/sortable-list-editor";
import { ShopTextAreaField, ShopTextField } from "../../shop/_ui/shop-fields";
import { pricingFieldId } from "./pricing-validation";

/**
 * Form từng khu vực của editor CMS Bảng giá (ADR-041 A, đề xuất Phong §5.1). Chỉ lớp trình bày: nhận `data` của section,
 * trả `data` mới qua `onChange`. Tên/giá/chu kỳ/hạn mức/cờ luôn đọc từ `Plan` (chỉ đọc ở đây, sửa ở `/admin/plans`).
 */

const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";

/** Gói dịch vụ editor cần (khớp `PricingPlanInfo` của `lib/pricing-cms.ts`). */
export interface PricingEditorPlan {
  id: string;
  name: string;
  priceVnd: number;
  interval: "MONTH" | "YEAR";
  intervalCount: number;
  maxProducts: number;
  storageMb: number;
  maxFileMb: number;
  imageStorageMb: number;
  isFree: boolean;
  isActive: boolean;
  features: Partial<Record<PlanFeatureKey, boolean>>;
}

export interface PricingFormContext {
  plans: PricingEditorPlan[];
  stats: Record<HomeStatKey, number>;
  enabledProviders: readonly string[];
  implementedFeatures: readonly PlanFeatureKey[];
  graceDays: number;
}

// ───────────── Tiện ích ─────────────

/** id mới cho mục danh sách (gọi trong handler, không lúc render). */
function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Ô tuỳ chọn: chuỗi rỗng → `undefined` (không lưu key thừa, snapshot "chưa đổi" vẫn khớp). */
function opt(value: string): string | undefined {
  return value === "" ? undefined : value;
}

function cycleLabel(plan: PricingEditorPlan): string {
  const unit = plan.interval === "YEAR" ? "năm" : "tháng";
  return plan.intervalCount === 1 ? unit : `${plan.intervalCount} ${unit}`;
}

export function formatEditorPlanPrice(plan: PricingEditorPlan): string {
  return plan.isFree || plan.priceVnd === 0 ? "Miễn phí" : `${plan.priceVnd.toLocaleString("vi-VN")} ₫ / ${cycleLabel(plan)}`;
}

function planOptionLabel(plan: PricingEditorPlan): string {
  return `${plan.name} — ${formatEditorPlanPrice(plan)}${plan.isActive ? "" : " (đang tắt)"}`;
}

/** Nhóm field có tiêu đề nhỏ (không dùng heading — tránh nhảy cấp). */
function FieldGroup({ title, hint, children }: { title: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border p-4" style={{ borderColor: LINE }}>
      <p className="text-sm font-semibold" style={{ color: INK }}>
        {title}
      </p>
      {hint ? (
        <p className="mt-1 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
          {hint}
        </p>
      ) : null}
      <div className="mt-3 space-y-4">{children}</div>
    </div>
  );
}

function ErrorLine({ id, message }: { id?: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} role="alert" className="text-sm" style={{ color: RED }}>
      {message}
    </p>
  );
}

function VarsHint({ plan = false }: { plan?: boolean }) {
  return (
    <>
      Biến: <code>{"{brand}"}</code> tên nền tảng, <code>{"{graceDays}"}</code> số ngày ân hạn{plan ? <>, <code>{"{plan}"}</code> tên gói</> : null}.
    </>
  );
}

// ───────────── Khu vực ─────────────

export function PricingSectionFields({
  section,
  errors,
  ctx,
  onChange,
}: {
  section: PricingSection;
  errors: Record<string, string>;
  ctx: PricingFormContext;
  onChange: (data: PricingSection["data"]) => void;
}) {
  const fid = (field: string) => pricingFieldId(section.type, field);
  const err = (field: string) => errors[field];

  switch (section.type) {
    case "hero": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <ShopTextField id={fid("eyebrow")} label="Dòng nhỏ trên tiêu đề" value={d.eyebrow} max={PRICING_EYEBROW_MAX} error={err("eyebrow")} onChange={(eyebrow) => onChange({ ...d, eyebrow })} />
          <ShopTextField id={fid("title")} label="Tiêu đề trang (H1)" value={d.title} max={PRICING_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
          <ShopTextAreaField id={fid("subtitle")} label="Đoạn mô tả" value={d.subtitle} max={PRICING_SUBTITLE_MAX} error={err("subtitle")} onChange={(subtitle) => onChange({ ...d, subtitle })} />
          <ShopTextField
            id={fid("badge")}
            label="Huy hiệu dưới mô tả"
            hint="Ví dụ: Không cần thẻ thanh toán"
            required={false}
            value={d.badge ?? ""}
            max={PRICING_BADGE_MAX}
            error={err("badge")}
            onChange={(badge) => onChange({ ...d, badge: opt(badge) })}
          />
          <p className="text-xs" style={{ color: INK_SOFT }}>
            <VarsHint />
          </p>
        </div>
      );
    }
    case "plans":
      return <PlansFields d={section.data} fid={fid} err={err} ctx={ctx} onChange={onChange} />;
    case "priceNote": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <SortableListEditor
            id={fid("lines")}
            label="Các dòng ghi chú dưới thẻ gói"
            hint={<VarsHint />}
            items={d.lines}
            onChange={(lines) => onChange({ ...d, lines })}
            itemLabel={(_, i) => `Dòng ${i + 1}`}
            addLabel="Thêm dòng"
            create={() => ""}
            min={PRICING_PRICE_NOTE_LINES_MIN}
            max={PRICING_PRICE_NOTE_LINES_MAX}
            unit="dòng"
            error={err("lines")}
            focusOnAdd={(i) => fid(`lines.${i}`)}
            renderItem={(line, i, update) => (
              <ShopTextAreaField id={fid(`lines.${i}`)} label={`Nội dung dòng ${i + 1}`} rows={2} value={line} max={PRICING_PRICE_NOTE_LINE_MAX} error={err(`lines.${i}`)} onChange={update} />
            )}
          />
        </div>
      );
    }
    case "stats": {
      const d = section.data;
      const missing = HOME_STAT_KEYS.filter((key) => !d.items.some((item) => item.key === key));
      return (
        <div className="space-y-4">
          <Notice tone="info">Số liệu lấy thật từ hệ thống (không nhập tay). Ô có giá trị bằng 0 tự ẩn; cả dải bằng 0 thì khu vực này ẩn.</Notice>
          <ShopTextField id={fid("title")} label="Tiêu đề" value={d.title} max={PRICING_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
          <SortableListEditor
            id={fid("items")}
            label="Ô số liệu"
            items={d.items}
            onChange={(items) => onChange({ ...d, items })}
            itemLabel={(item) => `Số liệu “${HOME_STAT_DEFAULT_LABELS[item.key]}”`}
            addOptions={[
              {
                label: "Thêm ô số liệu",
                create: () => {
                  const key = missing[0] ?? HOME_STAT_KEYS[0];
                  return { key, label: HOME_STAT_DEFAULT_LABELS[key], visible: true };
                },
                disabled: missing.length === 0,
              },
            ]}
            max={HOME_STAT_KEYS.length}
            unit="ô"
            error={err("items")}
            focusOnAdd={(i) => fid(`items.${i}.label`)}
            renderItem={(item, i, update) => {
              const value = ctx.stats[item.key];
              return (
                <>
                  <p className="text-sm" style={{ color: INK_SOFT }}>
                    Số hiện tại: <strong className="tabular-nums" style={{ color: INK }}>{value.toLocaleString("vi-VN")}</strong>
                    {value === 0 ? " — đang bằng 0 nên ô này tự ẩn trên trang." : null}
                  </p>
                  <Toggle id={fid(`items.${i}.visible`)} label="Hiện ô này" checked={item.visible} onChange={(e) => update({ ...item, visible: e.target.checked })} />
                  <ShopTextField id={fid(`items.${i}.label`)} label="Nhãn dưới số" value={item.label} max={PRICING_STAT_LABEL_MAX} error={err(`items.${i}.label`)} onChange={(label) => update({ ...item, label })} />
                </>
              );
            }}
          />
        </div>
      );
    }
    case "comparison":
      return <ComparisonFields d={section.data} fid={fid} err={err} ctx={ctx} onChange={onChange} />;
    case "whyUs": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <ShopTextField id={fid("title")} label="Tiêu đề" value={d.title} max={PRICING_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
          <ShopTextAreaField
            id={fid("subtitle")}
            label="Mô tả ngắn"
            rows={2}
            required={false}
            value={d.subtitle ?? ""}
            max={PRICING_SUBTITLE_MAX}
            error={err("subtitle")}
            onChange={(subtitle) => onChange({ ...d, subtitle: opt(subtitle) })}
          />
          <SortableListEditor
            id={fid("items")}
            label="Các lý do"
            hint={<VarsHint />}
            items={d.items}
            onChange={(items) => onChange({ ...d, items })}
            itemLabel={(_, i) => `Lý do ${i + 1}`}
            addLabel="Thêm lý do"
            create={() => ({ icon: "bolt" as PricingWhyUsIcon, title: "", description: "" })}
            min={PRICING_WHY_US_MIN}
            max={PRICING_WHY_US_MAX}
            unit="lý do"
            error={err("items")}
            focusOnAdd={(i) => fid(`items.${i}.title`)}
            renderItem={(item, i, update) => (
              <>
                <IconPicker name={fid(`items.${i}.icon`)} value={item.icon} onChange={(icon) => update({ ...item, icon })} />
                <ShopTextField id={fid(`items.${i}.title`)} label="Tiêu đề" value={item.title} max={PRICING_WHY_US_TITLE_MAX} error={err(`items.${i}.title`)} onChange={(title) => update({ ...item, title })} />
                <ShopTextAreaField
                  id={fid(`items.${i}.description`)}
                  label="Mô tả"
                  rows={2}
                  value={item.description}
                  max={PRICING_WHY_US_DESCRIPTION_MAX}
                  error={err(`items.${i}.description`)}
                  onChange={(description) => update({ ...item, description })}
                />
              </>
            )}
          />
        </div>
      );
    }
    case "faq": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <ShopTextField id={fid("title")} label="Tiêu đề" value={d.title} max={PRICING_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
          <SortableListEditor
            id={fid("items")}
            label="Câu hỏi"
            hint={
              <>
                Câu trả lời là văn bản thuần — xuống dòng được giữ nguyên, không dùng HTML. <VarsHint /> Danh sách rỗng thì khu vực này ẩn.
              </>
            }
            items={d.items}
            onChange={(items) => onChange({ ...d, items })}
            itemLabel={(item, i) => `Câu hỏi ${i + 1}${item.question ? ` “${item.question.slice(0, 40)}${item.question.length > 40 ? "…" : ""}”` : ""}`}
            addLabel="Thêm câu hỏi"
            create={() => ({ id: newId("faq"), question: "", answer: "" })}
            max={PRICING_FAQ_MAX}
            unit="câu hỏi"
            error={err("items")}
            confirmRemove={(_, i) => `Xoá câu hỏi ${i + 1}? Có thể khôi phục bằng “Khôi phục bản đang hiển thị” nếu chưa lưu.`}
            focusOnAdd={(i) => fid(`items.${i}.question`)}
            renderItem={(item, i, update) => (
              <>
                <ShopTextField id={fid(`items.${i}.question`)} label="Câu hỏi" value={item.question} max={PRICING_FAQ_QUESTION_MAX} error={err(`items.${i}.question`)} onChange={(question) => update({ ...item, question })} />
                <ShopTextAreaField id={fid(`items.${i}.answer`)} label="Câu trả lời" rows={5} value={item.answer} max={PRICING_FAQ_ANSWER_MAX} error={err(`items.${i}.answer`)} onChange={(answer) => update({ ...item, answer })} />
              </>
            )}
          />
        </div>
      );
    }
    case "ctaFinal": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <Notice tone="info">Đích của nút tự đổi theo người xem (chưa đăng nhập → đăng ký; chưa có gian hàng → mở gian hàng; đã có gian hàng → trang Gói dịch vụ).</Notice>
          <ShopTextField id={fid("title")} label="Tiêu đề" value={d.title} max={PRICING_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
          <ShopTextAreaField id={fid("description")} label="Đoạn mô tả" value={d.description} max={PRICING_DESCRIPTION_MAX} error={err("description")} onChange={(description) => onChange({ ...d, description })} />
          <ShopTextField
            id={fid("buttonLabel")}
            label="Nhãn nút"
            hint="Để trống = dùng nhãn nút theo trạng thái người xem (khu vực Thẻ gói)"
            required={false}
            value={d.buttonLabel ?? ""}
            max={PRICING_CTA_LABEL_MAX}
            error={err("buttonLabel")}
            onChange={(buttonLabel) => onChange({ ...d, buttonLabel: opt(buttonLabel) })}
          />
        </div>
      );
    }
    case "paymentMethods": {
      const d = section.data;
      return (
        <div className="space-y-4">
          {ctx.enabledProviders.length === 0 ? (
            <Notice tone="warning">
              Chưa bật cổng thanh toán nền tảng nào — khu vực này đang tự ẩn trên trang. Bật cổng ở{" "}
              <Link href="/admin/billing/payment" className={`font-semibold underline ${FOCUS}`}>
                Thanh toán nền tảng
              </Link>
              .
            </Notice>
          ) : (
            <Notice tone="info">Danh sách lấy theo cổng thanh toán nền tảng đang bật. Ở đây chỉ đổi nhãn hiển thị.</Notice>
          )}
          <ShopTextField id={fid("title")} label="Tiêu đề" value={d.title} max={PRICING_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
          <ShopTextAreaField
            id={fid("description")}
            label="Mô tả"
            rows={2}
            required={false}
            value={d.description ?? ""}
            max={PRICING_DESCRIPTION_MAX}
            error={err("description")}
            onChange={(description) => onChange({ ...d, description: opt(description) })}
          />
          <FieldGroup title="Nhãn từng cổng">
            {PRICING_PAYMENT_PROVIDER_IDS.map((provider) => {
              const enabled = ctx.enabledProviders.includes(provider);
              return (
                <div key={provider} className="space-y-1.5">
                  <Badge tone={enabled ? "success" : "neutral"}>{enabled ? "Đang bật" : "Đang tắt — không hiển thị"}</Badge>
                  <ShopTextField
                    id={fid(`labels.${provider}`)}
                    label={`Nhãn cổng ${provider}`}
                    hint={`Để trống = “${pricingProviderLabel(provider)}”`}
                    required={false}
                    value={d.labels[provider] ?? ""}
                    max={PRICING_PAYMENT_LABEL_MAX}
                    error={err(`labels.${provider}`)}
                    onChange={(value) => {
                      const labels = { ...d.labels };
                      if (value === "") delete labels[provider];
                      else labels[provider] = value;
                      onChange({ ...d, labels });
                    }}
                  />
                </div>
              );
            })}
          </FieldGroup>
        </div>
      );
    }
  }
}

// ───────────── Biểu tượng "Vì sao chọn" ─────────────

function IconPicker({ name, value, onChange }: { name: string; value: PricingWhyUsIcon; onChange: (icon: PricingWhyUsIcon) => void }) {
  return (
    <fieldset>
      <legend className="text-sm font-medium" style={{ color: INK }}>
        Biểu tượng
      </legend>
      <div className="mt-1.5 grid grid-cols-2 gap-2 min-[420px]:grid-cols-4">
        {PRICING_WHY_US_ICONS.map((icon) => {
          const Icon = pricingWhyUsIcon(icon);
          const checked = icon === value;
          const id = `${name}-${icon}`;
          return (
            <label
              key={icon}
              htmlFor={id}
              className="flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs font-medium transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand-primary,#0F3B82)]"
              style={{ borderColor: checked ? brandColors.primary : LINE, background: checked ? brandColors.surface : "white", color: INK }}
            >
              <input id={id} type="radio" name={name} value={icon} checked={checked} onChange={() => onChange(icon)} className="sr-only" />
              <Icon className="h-5 w-5 shrink-0" />
              <span>{PRICING_WHY_US_ICON_LABELS[icon]}</span>
              {checked ? <span className="sr-only">(đang chọn)</span> : null}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

// ───────────── Thẻ gói ─────────────

function PlansFields({
  d,
  fid,
  err,
  ctx,
  onChange,
}: {
  d: PricingPlansData;
  fid: (field: string) => string;
  err: (field: string) => string | undefined;
  ctx: PricingFormContext;
  onChange: (data: PricingPlansData) => void;
}) {
  const plansById = new Map(ctx.plans.map((plan) => [plan.id, plan]));
  const used = new Set(d.items.flatMap((item) => [item.planId, ...(item.altPlanId ? [item.altPlanId] : [])]));
  const unused = ctx.plans.filter((plan) => !used.has(plan.id));
  const autoAdded = unused.filter((plan) => plan.isActive);
  const hasPair = d.items.some((item) => item.altPlanId);

  function setItems(items: PricingPlanCardItem[]) {
    onChange({ ...d, items });
  }

  /** Bật "nổi bật" ở một thẻ → tắt ở mọi thẻ khác (tối đa 1 thẻ nổi bật). */
  function updateItem(index: number, next: PricingPlanCardItem) {
    const turnedOn = next.highlighted && !d.items[index]?.highlighted;
    setItems(d.items.map((item, i) => (i === index ? next : turnedOn ? { ...item, highlighted: false } : item)));
  }

  return (
    <div className="space-y-4">
      <Notice tone="info">
        Tên, giá, chu kỳ, hạn mức và tính năng lấy từ{" "}
        <Link href="/admin/plans" className={`font-semibold underline ${FOCUS}`}>
          Gói dịch vụ
        </Link>{" "}
        — không nhập ở đây. Thứ tự thẻ trên trang = thứ tự trong danh sách dưới.
      </Notice>

      <FieldGroup title="Tiêu đề khu vực" hint="Để trống cả hai thì khu vực không có tiêu đề riêng — tên gói trở thành tiêu đề cấp 2.">
        <ShopTextField id={fid("title")} label="Tiêu đề" required={false} value={d.title ?? ""} max={PRICING_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title: opt(title) })} />
        <ShopTextAreaField
          id={fid("subtitle")}
          label="Mô tả ngắn"
          rows={2}
          required={false}
          value={d.subtitle ?? ""}
          max={PRICING_SUBTITLE_MAX}
          error={err("subtitle")}
          onChange={(subtitle) => onChange({ ...d, subtitle: opt(subtitle) })}
        />
        <Toggle id={fid("showAutoLimits")} label="Hiện hạn mức gói (số tài liệu, dung lượng…) trên thẻ" checked={d.showAutoLimits} onChange={(e) => onChange({ ...d, showAutoLimits: e.target.checked })} />
      </FieldGroup>

      <FieldGroup
        title="Nút chuyển chu kỳ (Tháng / Năm)"
        hint={hasPair ? "Đang có thẻ ghép gói năm — nút chuyển chu kỳ sẽ hiện trên trang." : "Chưa thẻ nào ghép gói chu kỳ dài — nút chuyển chu kỳ đang ẩn trên trang."}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <ShopTextField
            id={fid("cycleToggle.primaryLabel")}
            label="Nhãn chu kỳ chính"
            value={d.cycleToggle.primaryLabel}
            max={PRICING_CYCLE_LABEL_MAX}
            error={err("cycleToggle.primaryLabel")}
            onChange={(primaryLabel) => onChange({ ...d, cycleToggle: { ...d.cycleToggle, primaryLabel } })}
          />
          <ShopTextField
            id={fid("cycleToggle.altLabel")}
            label="Nhãn chu kỳ ghép cặp"
            value={d.cycleToggle.altLabel}
            max={PRICING_CYCLE_LABEL_MAX}
            error={err("cycleToggle.altLabel")}
            onChange={(altLabel) => onChange({ ...d, cycleToggle: { ...d.cycleToggle, altLabel } })}
          />
        </div>
        <ShopTextField
          id={fid("cycleToggle.savingsTemplate")}
          label="Nhãn tiết kiệm"
          hint="Bắt buộc chứa {percent} — % tính tự động từ giá thật"
          value={d.cycleToggle.savingsTemplate}
          max={PRICING_SAVINGS_TEMPLATE_MAX}
          error={err("cycleToggle.savingsTemplate")}
          onChange={(savingsTemplate) => onChange({ ...d, cycleToggle: { ...d.cycleToggle, savingsTemplate } })}
        />
      </FieldGroup>

      <SortableListEditor
        id={fid("items")}
        label="Thẻ gói"
        hint="Chỉ 1 thẻ được đánh dấu nổi bật. Gói đang tắt không hiển thị dù có thẻ."
        items={d.items}
        onChange={setItems}
        itemLabel={(item, i) => `Thẻ ${i + 1} — ${plansById.get(item.planId)?.name ?? "gói không còn tồn tại"}`}
        addOptions={[
          {
            label: "Thêm thẻ gói",
            create: () => ({ planId: (unused.find((p) => p.isActive) ?? unused[0])?.id ?? "", visible: true, highlighted: false, benefits: [] }),
            disabled: unused.length === 0,
            disabledHint: "Mọi gói đều đã có thẻ (hoặc đang được ghép cặp).",
          },
        ]}
        max={PRICING_PLAN_ITEMS_MAX}
        unit="thẻ"
        error={err("items")}
        confirmRemove={(item) => {
          const plan = plansById.get(item.planId);
          return plan?.isActive
            ? `Bỏ thẻ “${plan.name}” khỏi cấu hình? Gói vẫn đang bật nên trang sẽ tự hiện lại thẻ này ở cuối với nội dung mặc định (muốn ẩn hẳn: tắt “Hiện thẻ này”).`
            : null;
        }}
        focusOnAdd={(i) => fid(`items.${i}.planId`)}
        renderItem={(item, i) => <PlanCardFields item={item} index={i} items={d.items} fid={fid} err={err} ctx={ctx} onChange={(next) => updateItem(i, next)} />}
      />

      {autoAdded.length > 0 ? (
        <Notice tone="info">
          Gói đang bật chưa có thẻ — trang tự thêm ở cuối với nội dung mặc định: <strong>{autoAdded.map((plan) => plan.name).join(", ")}</strong>.
        </Notice>
      ) : null}

      <FieldGroup title="Nhãn nút theo trạng thái người xem" hint="Đích của nút do hệ thống quyết theo người xem; ở đây chỉ đổi chữ. Dùng {plan} để chèn tên gói.">
        <div className="grid gap-4 md:grid-cols-2">
          {PRICING_CTA_KEYS.map((key: PricingCtaKey) => (
            <ShopTextField
              key={key}
              id={fid(`ctaLabels.${key}`)}
              label={PRICING_CTA_KEY_LABELS[key]}
              value={d.ctaLabels[key]}
              max={PRICING_CTA_LABEL_MAX}
              error={err(`ctaLabels.${key}`)}
              onChange={(value) => onChange({ ...d, ctaLabels: { ...d.ctaLabels, [key]: value } })}
            />
          ))}
        </div>
      </FieldGroup>
    </div>
  );
}

function PlanSummary({ plan }: { plan: PricingEditorPlan }) {
  return (
    <div className="rounded-lg border px-3.5 py-3 text-sm" style={{ borderColor: LINE, background: "#F9FAFB" }}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold" style={{ color: INK }}>
          {formatEditorPlanPrice(plan)}
        </span>
        {plan.isActive ? <Badge tone="success">Đang bật</Badge> : <Badge tone="neutral">Gói đang tắt — không hiển thị</Badge>}
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
        {PLAN_LIMIT_FIELDS.map((field) => `${PLAN_LIMIT_FIELD_LABELS[field]}: ${formatPlanLimit(field, plan[field])}`).join(" · ")}
      </p>
      <Link
        href={`/admin/plans/${encodeURIComponent(plan.id)}`}
        target="_blank"
        rel="noreferrer"
        className={`mt-1.5 inline-flex min-h-11 items-center gap-1.5 text-xs font-semibold underline lg:min-h-6 ${FOCUS}`}
        style={{ color: brandColors.primary }}
      >
        Sửa giá & hạn mức ở Gói dịch vụ <IconExternalLink className="h-3.5 w-3.5" />
        <span className="sr-only">(mở tab mới)</span>
      </Link>
    </div>
  );
}

function PlanCardFields({
  item,
  index,
  items,
  fid,
  err,
  ctx,
  onChange,
}: {
  item: PricingPlanCardItem;
  index: number;
  items: readonly PricingPlanCardItem[];
  fid: (field: string) => string;
  err: (field: string) => string | undefined;
  ctx: PricingFormContext;
  onChange: (next: PricingPlanCardItem) => void;
}) {
  const f = (field: string) => `items.${index}.${field}`;
  const plan = ctx.plans.find((p) => p.id === item.planId);
  const alt = item.altPlanId ? ctx.plans.find((p) => p.id === item.altPlanId) : undefined;
  const usedElsewhere = new Set(items.flatMap((other, i) => (i === index ? [] : [other.planId, ...(other.altPlanId ? [other.altPlanId] : [])])));
  const savings = plan && alt ? computeCycleSavingsPercent(plan, alt) : null;

  return (
    <>
      <SelectField
        id={fid(f("planId"))}
        label="Gói"
        value={plan ? item.planId : ""}
        error={err(f("planId"))}
        onChange={(e) => {
          const planId = e.target.value;
          const picked = ctx.plans.find((p) => p.id === planId);
          // Đổi sang gói Free → bỏ ghép cặp (gói Free không ghép chu kỳ); gói ghép trùng gói chính → bỏ.
          const altPlanId = picked?.isFree || item.altPlanId === planId ? undefined : item.altPlanId;
          onChange({ ...item, planId, altPlanId });
        }}
        className="min-h-11 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15"
      >
        {plan ? null : (
          <option value="" disabled>
            Gói không còn tồn tại — chọn gói khác
          </option>
        )}
        {ctx.plans.map((p) => (
          <option key={p.id} value={p.id} disabled={usedElsewhere.has(p.id) || p.id === item.altPlanId}>
            {planOptionLabel(p)}
            {usedElsewhere.has(p.id) ? " · đã dùng ở thẻ khác" : ""}
          </option>
        ))}
      </SelectField>
      {plan ? <PlanSummary plan={plan} /> : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-6">
        <Toggle id={fid(f("visible"))} label="Hiện thẻ này" checked={item.visible} onChange={(e) => onChange({ ...item, visible: e.target.checked })} />
        <Toggle
          id={fid(f("highlighted"))}
          label="Thẻ nổi bật (tối đa 1 — chọn ở đây sẽ bỏ ở thẻ khác)"
          checked={item.highlighted}
          onChange={(e) => onChange({ ...item, highlighted: e.target.checked })}
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <ShopTextField
          id={fid(f("badge"))}
          label="Nhãn trên thẻ"
          hint="Ví dụ: Phổ biến nhất"
          required={false}
          value={item.badge ?? ""}
          max={PRICING_PLAN_BADGE_MAX}
          error={err(f("badge"))}
          onChange={(badge) => onChange({ ...item, badge: opt(badge) })}
        />
        <ShopTextField
          id={fid(f("ctaLabel"))}
          label="Nhãn nút riêng"
          hint="Để trống = nhãn theo trạng thái; dùng {plan}"
          required={false}
          value={item.ctaLabel ?? ""}
          max={PRICING_CTA_LABEL_MAX}
          error={err(f("ctaLabel"))}
          onChange={(ctaLabel) => onChange({ ...item, ctaLabel: opt(ctaLabel) })}
        />
      </div>
      <ShopTextField
        id={fid(f("tagline"))}
        label="Câu giới thiệu dưới tên gói"
        required={false}
        value={item.tagline ?? ""}
        max={PRICING_TAGLINE_MAX}
        error={err(f("tagline"))}
        onChange={(tagline) => onChange({ ...item, tagline: opt(tagline) })}
      />
      <ShopTextField
        id={fid(f("note"))}
        label="Ghi chú nhỏ dưới giá"
        required={false}
        value={item.note ?? ""}
        max={PRICING_NOTE_MAX}
        error={err(f("note"))}
        onChange={(note) => onChange({ ...item, note: opt(note) })}
      />

      <div>
        <SelectField
          id={fid(f("altPlanId"))}
          label="Gói ghép cặp chu kỳ (không bắt buộc)"
          hint={plan?.isFree ? "Gói Miễn phí không ghép cặp chu kỳ." : "Ví dụ: thẻ gói tháng ghép với gói năm cùng hạng — khách đổi bằng nút Tháng / Năm."}
          value={item.altPlanId ?? ""}
          disabled={plan?.isFree}
          error={err(f("altPlanId"))}
          onChange={(e) => onChange({ ...item, altPlanId: opt(e.target.value) })}
          className="min-h-11 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15 disabled:cursor-not-allowed disabled:bg-gray-50"
        >
          <option value="">Không ghép cặp</option>
          {item.altPlanId && !alt ? (
            <option value={item.altPlanId} disabled>
              Gói không còn tồn tại
            </option>
          ) : null}
          {ctx.plans
            .filter((p) => !p.isFree && p.id !== item.planId)
            .map((p) => (
              <option key={p.id} value={p.id} disabled={usedElsewhere.has(p.id)}>
                {planOptionLabel(p)}
                {usedElsewhere.has(p.id) ? " · đã dùng ở thẻ khác" : ""}
              </option>
            ))}
        </SelectField>
        {plan && alt ? (
          <p className="mt-1.5 text-xs" style={{ color: INK_SOFT }} aria-live="polite">
            {savings !== null ? (
              <>
                Tiết kiệm <strong style={{ color: INK }}>{savings}%</strong> so với mua “{plan.name}” lặp lại cùng thời gian (tính từ giá thật).
              </>
            ) : (
              "Gói ghép cặp không rẻ hơn — nhãn tiết kiệm sẽ ẩn."
            )}
            {alt.isActive ? null : " Gói ghép cặp đang tắt — trang coi như không ghép."}
          </p>
        ) : null}
      </div>

      <SortableListEditor
        id={fid(f("benefits"))}
        label="Quyền lợi (gạch đầu dòng)"
        hint="Chỉ ghi quyền lợi có thật của gói."
        items={item.benefits}
        onChange={(benefits) => onChange({ ...item, benefits })}
        itemLabel={(_, i) => `Quyền lợi ${i + 1}`}
        addLabel="Thêm quyền lợi"
        create={() => ""}
        max={PRICING_BENEFITS_MAX}
        unit="quyền lợi"
        error={err(f("benefits"))}
        focusOnAdd={(i) => fid(f(`benefits.${i}`))}
        renderItem={(benefit, i, update) => (
          <ShopTextField id={fid(f(`benefits.${i}`))} label={`Nội dung quyền lợi ${i + 1}`} value={benefit} max={PRICING_BENEFIT_MAX} error={err(f(`benefits.${i}`))} onChange={update} />
        )}
      />
    </>
  );
}

// ───────────── Bảng so sánh ─────────────

const ROW_KIND_LABELS: Record<PricingComparisonRow["kind"], string> = {
  limit: "Hạn mức gói (lấy từ Gói dịch vụ)",
  feature: "Tính năng gói (cờ tính năng)",
  custom: "Tự nhập theo từng gói",
};

const CELL_CHOICES: { value: "" | PricingComparisonCell["value"]; label: string }[] = [
  { value: "", label: "Theo giá trị mặc định của dòng" },
  { value: "yes", label: "Có" },
  { value: "no", label: "Không" },
  { value: "text", label: "Chữ tự nhập" },
];

const FALLBACK_LABELS: Record<"yes" | "no" | "dash", string> = { yes: "Có", no: "Không", dash: "— (không áp dụng)" };

function ComparisonFields({
  d,
  fid,
  err,
  ctx,
  onChange,
}: {
  d: PricingComparisonData;
  fid: (field: string) => string;
  err: (field: string) => string | undefined;
  ctx: PricingFormContext;
  onChange: (data: PricingComparisonData) => void;
}) {
  const activePlans = ctx.plans.filter((plan) => plan.isActive);
  const firstFeature = ctx.implementedFeatures[0];

  function rowOptions(): { label: string; create: () => PricingComparisonRow; disabled?: boolean; disabledHint?: string }[] {
    return [
      { label: "Dòng hạn mức", create: () => ({ id: newId("cmp-row"), kind: "limit", field: "maxProducts", label: PLAN_LIMIT_FIELD_LABELS.maxProducts }) },
      {
        label: "Dòng tính năng",
        create: () => ({ id: newId("cmp-row"), kind: "feature", featureKey: firstFeature ?? "coupons", label: firstFeature ? PLAN_FEATURE_LABELS[firstFeature] : "" }),
        disabled: !firstFeature,
        disabledHint: "Chưa có cờ tính năng nào được hệ thống chặn theo gói — chưa thêm được dòng tính năng (chỉ quảng cáo tính năng có thật).",
      },
      { label: "Dòng tự nhập", create: () => ({ id: newId("cmp-row"), kind: "custom", label: "", cells: {}, fallback: "yes" }) },
    ];
  }

  return (
    <div className="space-y-4">
      <Notice tone="info">
        Cột của bảng = các gói đang bật (gói Miễn phí trước, giá tăng dần). Dòng hạn mức và tính năng lấy giá trị thật từ Gói dịch vụ; dòng tự nhập do bạn điền theo
        từng gói.
      </Notice>
      <ShopTextField id={fid("title")} label="Tiêu đề" value={d.title} max={PRICING_TITLE_MAX} error={err("title")} onChange={(title) => onChange({ ...d, title })} />
      <ShopTextAreaField
        id={fid("subtitle")}
        label="Mô tả ngắn"
        rows={2}
        required={false}
        value={d.subtitle ?? ""}
        max={PRICING_SUBTITLE_MAX}
        error={err("subtitle")}
        onChange={(subtitle) => onChange({ ...d, subtitle: opt(subtitle) })}
      />
      <Toggle
        id={fid("showPlanHeaderCta")}
        label="Hiện nút hành động ở đầu cột gói (từ màn hình máy tính bảng)"
        checked={d.showPlanHeaderCta}
        onChange={(e) => onChange({ ...d, showPlanHeaderCta: e.target.checked })}
      />

      <SortableListEditor
        id={fid("groups")}
        label="Nhóm dòng"
        items={d.groups}
        onChange={(groups) => onChange({ ...d, groups })}
        itemLabel={(group, i) => `Nhóm ${i + 1}${group.title ? ` “${group.title}”` : ""}`}
        addLabel="Thêm nhóm"
        create={() => ({ id: newId("cmp-group"), title: "", rows: [] })}
        max={PRICING_COMPARISON_GROUPS_MAX}
        unit="nhóm"
        error={err("groups")}
        confirmRemove={(group) => (group.rows.length > 0 ? `Xoá nhóm “${group.title || "chưa đặt tên"}” cùng ${group.rows.length} dòng bên trong?` : null)}
        focusOnAdd={(i) => fid(`groups.${i}.title`)}
        renderItem={(group: PricingComparisonGroup, g, updateGroup) => (
          <>
            <ShopTextField
              id={fid(`groups.${g}.title`)}
              label="Tên nhóm"
              value={group.title}
              max={PRICING_COMPARISON_GROUP_TITLE_MAX}
              error={err(`groups.${g}.title`)}
              onChange={(title) => updateGroup({ ...group, title })}
            />
            <SortableListEditor
              id={fid(`groups.${g}.rows`)}
              label="Các dòng"
              items={group.rows}
              onChange={(rows) => updateGroup({ ...group, rows })}
              itemLabel={(row, r) => `Dòng ${r + 1}${row.label ? ` “${row.label}”` : ""}`}
              addOptions={rowOptions()}
              max={PRICING_COMPARISON_ROWS_MAX}
              unit="dòng"
              error={err(`groups.${g}.rows`)}
              focusOnAdd={(r) => fid(`groups.${g}.rows.${r}.label`)}
              renderItem={(row, r, updateRow) => (
                <ComparisonRowFields row={row} base={`groups.${g}.rows.${r}`} fid={fid} err={err} ctx={ctx} activePlans={activePlans} onChange={updateRow} />
              )}
            />
          </>
        )}
      />
    </div>
  );
}

function ComparisonRowFields({
  row,
  base,
  fid,
  err,
  ctx,
  activePlans,
  onChange,
}: {
  row: PricingComparisonRow;
  base: string;
  fid: (field: string) => string;
  err: (field: string) => string | undefined;
  ctx: PricingFormContext;
  activePlans: PricingEditorPlan[];
  onChange: (row: PricingComparisonRow) => void;
}) {
  const f = (field: string) => `${base}.${field}`;
  const selectClass =
    "min-h-11 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15";

  return (
    <>
      <p className="text-xs font-semibold" style={{ color: INK_SOFT }}>
        Loại dòng: {ROW_KIND_LABELS[row.kind]}
      </p>
      <div className="grid gap-4 md:grid-cols-2">
        <ShopTextField id={fid(f("label"))} label="Nhãn dòng" value={row.label} max={PRICING_ROW_LABEL_MAX} error={err(f("label"))} onChange={(label) => onChange({ ...row, label })} />
        <ShopTextField
          id={fid(f("hint"))}
          label="Giải thích nhỏ dưới nhãn"
          required={false}
          value={row.hint ?? ""}
          max={PRICING_ROW_HINT_MAX}
          error={err(f("hint"))}
          onChange={(hint) => onChange({ ...row, hint: opt(hint) })}
        />
      </div>

      {row.kind === "limit" ? (
        <>
          <SelectField id={fid(f("field"))} label="Hạn mức" value={row.field} error={err(f("field"))} className={selectClass} onChange={(e) => onChange({ ...row, field: e.target.value as PlanLimitField })}>
            {PLAN_LIMIT_FIELDS.map((field) => (
              <option key={field} value={field}>
                {PLAN_LIMIT_FIELD_LABELS[field]}
              </option>
            ))}
          </SelectField>
          <PreviewValues label="Giá trị trên trang" values={activePlans.map((plan) => [plan.name, formatPlanLimit(row.field, plan[row.field])])} />
        </>
      ) : null}

      {row.kind === "feature" ? (
        <>
          <SelectField
            id={fid(f("featureKey"))}
            label="Cờ tính năng"
            value={row.featureKey}
            error={err(f("featureKey"))}
            className={selectClass}
            onChange={(e) => onChange({ ...row, featureKey: e.target.value as PlanFeatureKey })}
          >
            {ctx.implementedFeatures.includes(row.featureKey) ? null : (
              <option value={row.featureKey} disabled>
                {PLAN_FEATURE_LABELS[row.featureKey]} (chưa triển khai)
              </option>
            )}
            {ctx.implementedFeatures.map((key) => (
              <option key={key} value={key}>
                {PLAN_FEATURE_LABELS[key]}
              </option>
            ))}
          </SelectField>
          {ctx.implementedFeatures.includes(row.featureKey) ? (
            <PreviewValues label="Giá trị trên trang" values={activePlans.map((plan) => [plan.name, plan.features[row.featureKey] ? "Có" : "Không"])} />
          ) : (
            <Notice tone="warning">Cờ “{PLAN_FEATURE_LABELS[row.featureKey]}” chưa được hệ thống chặn theo gói — dòng này sẽ không hiện trên trang. Nên xoá dòng.</Notice>
          )}
        </>
      ) : null}

      {row.kind === "custom" ? <CustomCells row={row} f={f} fid={fid} err={err} ctx={ctx} activePlans={activePlans} selectClass={selectClass} onChange={onChange} /> : null}
    </>
  );
}

function PreviewValues({ label, values }: { label: string; values: [string, string][] }) {
  if (values.length === 0) return null;
  return (
    <p className="text-xs leading-relaxed" style={{ color: INK_SOFT }}>
      {label}: {values.map(([name, value]) => `${name}: ${value}`).join(" · ")}
    </p>
  );
}

function CustomCells({
  row,
  f,
  fid,
  err,
  ctx,
  activePlans,
  selectClass,
  onChange,
}: {
  row: Extract<PricingComparisonRow, { kind: "custom" }>;
  f: (field: string) => string;
  fid: (field: string) => string;
  err: (field: string) => string | undefined;
  ctx: PricingFormContext;
  activePlans: PricingEditorPlan[];
  selectClass: string;
  onChange: (row: PricingComparisonRow) => void;
}) {
  const known = new Set(ctx.plans.map((plan) => plan.id));
  const orphanIds = Object.keys(row.cells).filter((id) => !known.has(id));

  function setCell(planId: string, cell: PricingComparisonCell | null) {
    const cells = { ...row.cells };
    if (cell) cells[planId] = cell;
    else delete cells[planId];
    onChange({ ...row, cells });
  }

  return (
    <>
      <SelectField
        id={fid(f("fallback"))}
        label="Giá trị mặc định (gói chưa điền ô, kể cả gói mới thêm)"
        value={row.fallback}
        error={err(f("fallback"))}
        className={selectClass}
        onChange={(e) => onChange({ ...row, fallback: e.target.value as "yes" | "no" | "dash" })}
      >
        {(Object.keys(FALLBACK_LABELS) as ("yes" | "no" | "dash")[]).map((value) => (
          <option key={value} value={value}>
            {FALLBACK_LABELS[value]}
          </option>
        ))}
      </SelectField>
      <fieldset className="rounded-lg border p-3" style={{ borderColor: LINE }} aria-describedby={err(f("cells")) ? fid(`${f("cells")}-error`) : undefined}>
        <legend className="px-1 text-sm font-medium" style={{ color: INK }}>
          Ô theo từng gói đang bật
        </legend>
        <ErrorLine id={fid(`${f("cells")}-error`)} message={err(f("cells"))} />
        {activePlans.length === 0 ? (
          <p className="text-sm" style={{ color: INK_SOFT }}>
            Chưa có gói nào đang bật.
          </p>
        ) : (
          <div className="space-y-3">
            {activePlans.map((plan) => {
              const cell = row.cells[plan.id];
              const cellId = fid(f(`cells.${plan.id}.value`));
              return (
                <div key={plan.id} className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] sm:items-start">
                  <SelectField
                    id={cellId}
                    label={plan.name}
                    value={cell?.value ?? ""}
                    className={selectClass}
                    onChange={(e) => {
                      const value = e.target.value as "" | PricingComparisonCell["value"];
                      setCell(plan.id, value === "" ? null : { value, text: value === "text" ? (cell?.text ?? "") : undefined });
                    }}
                  >
                    {CELL_CHOICES.map((choice) => (
                      <option key={choice.value} value={choice.value}>
                        {choice.value === "" ? `${choice.label} (${FALLBACK_LABELS[row.fallback]})` : choice.label}
                      </option>
                    ))}
                  </SelectField>
                  {cell?.value === "text" ? (
                    <ShopTextField
                      id={fid(f(`cells.${plan.id}.text`))}
                      label={`Chữ hiển thị cho ${plan.name}`}
                      value={cell.text ?? ""}
                      max={PRICING_CELL_TEXT_MAX}
                      error={err(f(`cells.${plan.id}.text`))}
                      onChange={(text) => setCell(plan.id, { value: "text", text })}
                    />
                  ) : null}
                </div>
              );
            })}
          </div>
        )}
        {orphanIds.length > 0 ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs" style={{ color: "#92400E" }}>
            <span>Có {orphanIds.length} ô gắn với gói không còn tồn tại — sẽ báo lỗi khi lưu.</span>
            <button
              type="button"
              onClick={() => {
                const cells = { ...row.cells };
                for (const id of orphanIds) delete cells[id];
                onChange({ ...row, cells });
              }}
              className={`min-h-11 cursor-pointer rounded-lg border px-3 font-semibold lg:min-h-8 ${FOCUS}`}
              style={{ borderColor: LINE, color: INK }}
            >
              Bỏ các ô đó
            </button>
          </div>
        ) : null}
      </fieldset>
    </>
  );
}
