"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
// Import trực tiếp từ subpath (không qua barrel "@gieochu/core") — đây là
// "use client" component, còn barrel index.ts kéo theo cả code server-only
// (argon2) khiến Next cố bundle cho browser rồi lỗi "Module not found: fs".
import {
  HOME_BODY_PARAGRAPHS_MAX,
  HOME_COMMUNITY_ITEMS_MAX,
  HOME_COMMUNITY_MODE_LABELS,
  HOME_COMMUNITY_MODES,
  HOME_FAQ_ANSWER_MAX,
  HOME_FAQ_MAX,
  HOME_FAQ_QUESTION_MAX,
  HOME_FEATURED_LIMIT_MAX,
  HOME_FEATURED_LIMIT_MIN,
  HOME_HERO_STAT_BADGES_MAX,
  HOME_HERO_STAT_DEFAULT_LABELS,
  HOME_HERO_STAT_LABEL_MAX,
  HOME_HERO_STAT_MIN_VALUE_DEFAULT,
  HOME_MIN_TO_SHOW_MIN,
  HOME_PINNED_MAX,
  HOME_SECTION_LABELS,
  HOME_STAT_KEYS,
  HOME_STEPS_MAX,
  HOME_STEPS_MIN,
  homePublishIssues,
  type HomeCommunityMode,
  type HomeCta,
  type HomeHeroStatBadge,
  type HomeSection,
  type HomeSectionData,
  type HomeStatKey,
} from "@gieochu/core/home-sections";
import { collectStrings, findContentClaimWarnings } from "@gieochu/core/cms-content-guard";
import { SEO_DESCRIPTION_MAX, SEO_TITLE_MAX, seoLengthWarning } from "@gieochu/core/seo";
import { Badge, GhostButton, Notice, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { useUnsavedChanges } from "../../_ui/unsaved-changes";
import { IconCheckCircle, IconChevronDown, IconEye, IconEyeOff, IconGlobe, IconPlus, IconTrash } from "../../_ui/icons";
import { CollapsibleSection, sectionStatus } from "../../_ui/collapsible-section";
import { ArrayObjectEditor } from "./array-object-editor";
import { ImageUploadField } from "../../_ui/image-upload-field";
import {
  publishHomeAction,
  restoreLiveHomeAction,
  saveHomeDraftAction,
  searchHomeProductOptionsAction,
  searchHomeTenantOptionsAction,
  type HomeEditorActionState,
} from "./actions";
import { PinPicker, type PinOption } from "./pin-picker";
import { toProductPinOption, toTenantPinOption } from "./pin-options";

const INK = brandColors.ink;
const LINE = "#E5E7EB";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
/** Nút icon trong danh sách section (cùng chuẩn editor Cửa hàng): 44×44 dưới lg (target chạm), 36×36 từ lg. */
const ICON_BTN = `inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg transition hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent motion-reduce:transition-none lg:h-9 lg:w-9 ${FOCUS}`;
const TEXTAREA_CLASS =
  "mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15";

/** Tên ô số liệu trong editor (không phải nhãn hiển thị — nhãn hiển thị sửa được). */
const STAT_EDITOR_NAMES: Record<HomeStatKey, string> = {
  tenants: "Số người bán đang hoạt động",
  products: "Số tài liệu Công khai",
  sold: "Tổng lượt mua",
  reviews: "Số đánh giá hiển thị",
};

async function searchTenantPins(query: string, includeIds: string[]): Promise<PinOption[]> {
  return (await searchHomeTenantOptionsAction(query, includeIds)).map(toTenantPinOption);
}

async function searchProductPins(query: string, includeIds: string[]): Promise<PinOption[]> {
  return (await searchHomeProductOptionsAction(query, includeIds)).map(toProductPinOption);
}

const LIMIT_CHOICES = Array.from({ length: HOME_FEATURED_LIMIT_MAX - HOME_FEATURED_LIMIT_MIN + 1 }, (_, i) => HOME_FEATURED_LIMIT_MIN + i);

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** Chọn số thẻ bằng danh sách cố định (3–12) — không có trạng thái nhập sai/kẹp giá trị khi đang gõ. */
function LimitField({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  return (
    <SelectField
      id={id}
      label="Số thẻ hiển thị"
      hint={`Từ ${HOME_FEATURED_LIMIT_MIN} đến ${HOME_FEATURED_LIMIT_MAX} thẻ. Mục ghim vượt số này sẽ không hiện.`}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {LIMIT_CHOICES.map((n) => (
        <option key={n} value={n}>
          {n} thẻ
        </option>
      ))}
    </SelectField>
  );
}

/** ADR-050: ngưỡng tối thiểu — ít hơn số thẻ đủ điều kiện này thì section không hiện. */
function MinToShowField({ id, value, limit, onChange }: { id: string; value: number; limit: number; onChange: (v: number) => void }) {
  const choices = Array.from({ length: limit - HOME_MIN_TO_SHOW_MIN + 1 }, (_, i) => HOME_MIN_TO_SHOW_MIN + i);
  return (
    <SelectField
      id={id}
      label="Chỉ hiện khi có ít nhất"
      hint="Ít hơn số này (dữ liệu thật) thì section tự ẩn ngoài trang chủ."
      value={Math.min(value, limit)}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {choices.map((n) => (
        <option key={n} value={n}>
          {n} thẻ
        </option>
      ))}
    </SelectField>
  );
}

/** Ghi chú cố định đầu form của section lấy dữ liệu thật (ADR-033). */
function LiveDataNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border px-3.5 py-2.5 text-sm" style={{ background: "#E8F1FF", borderColor: "#BFDBFE", color: "#1E3A8A" }}>
      {children}
    </p>
  );
}

/** Giá trị thật hiện tại của 4 số liệu (`getHomeStats`) — để admin chọn ngưỡng thẻ Hero. */
export type HomeEditorLiveStats = Record<HomeStatKey, number>;

const viNumber = new Intl.NumberFormat("vi-VN");

/** ADR-050 lần 3: thẻ số liệu nổi bật của Hero — tối đa 3, mỗi số liệu 1 thẻ, sắp xếp Lên/Xuống. */
function HeroStatBadgesEditor({ badges, liveStats, onChange }: { badges: HomeHeroStatBadge[]; liveStats: HomeEditorLiveStats; onChange: (badges: HomeHeroStatBadge[]) => void }) {
  const used = new Set(badges.map((badge) => badge.metric));
  const firstFree = HOME_STAT_KEYS.find((key) => !used.has(key));
  return (
    <div className="space-y-3">
      <LiveDataNote>
        Thẻ số liệu nổi bật quanh ảnh hero — con số lấy tự động từ dữ liệu thật (tính cả khi section “Số liệu nổi bật” đang ẩn).
        Thẻ tắt, có giá trị thật bằng 0 hoặc nhỏ hơn ngưỡng sẽ tự ẩn. Số hiển thị được làm gọn và làm tròn xuống (vd 120+, 1,2K+).
      </LiveDataNote>
      <ItemList<HomeHeroStatBadge>
        label="Thẻ số liệu nổi bật"
        items={badges}
        max={Math.min(HOME_HERO_STAT_BADGES_MAX, HOME_STAT_KEYS.length)}
        itemName="Thẻ"
        create={() => {
          const metric = firstFree ?? HOME_STAT_KEYS[0];
          return { id: newId("hero-stat"), metric, label: HOME_HERO_STAT_DEFAULT_LABELS[metric], minValue: HOME_HERO_STAT_MIN_VALUE_DEFAULT, enabled: true };
        }}
        onChange={onChange}
        render={(badge, _index, update) => {
          const current = liveStats[badge.metric];
          const shown = badge.enabled && current > 0 && current >= badge.minValue;
          const labelError = badge.label.trim() ? undefined : `Nhập nhãn (tối đa ${HOME_HERO_STAT_LABEL_MAX} ký tự).`;
          return (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <SelectField
                id={`${badge.id}-metric`}
                label="Số liệu"
                value={badge.metric}
                onChange={(e) => {
                  const metric = e.target.value as HomeStatKey;
                  // Nhãn còn là mặc định của số liệu cũ → đổi theo số liệu mới; nhãn đã sửa tay thì giữ.
                  const label = badge.label === HOME_HERO_STAT_DEFAULT_LABELS[badge.metric] ? HOME_HERO_STAT_DEFAULT_LABELS[metric] : badge.label;
                  update({ ...badge, metric, label });
                }}
              >
                {HOME_STAT_KEYS.map((key) => (
                  <option key={key} value={key} disabled={key !== badge.metric && used.has(key)}>
                    {STAT_EDITOR_NAMES[key]} (hiện tại: {viNumber.format(liveStats[key])})
                  </option>
                ))}
              </SelectField>
              <TextField
                id={`${badge.id}-label`}
                label="Nhãn"
                maxLength={HOME_HERO_STAT_LABEL_MAX}
                required
                value={badge.label}
                error={labelError}
                onChange={(e) => update({ ...badge, label: e.target.value })}
              />
              <TextField
                id={`${badge.id}-min`}
                label="Chỉ hiện khi đạt ít nhất"
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={badge.minValue}
                hint={`Giá trị hiện tại: ${viNumber.format(current)} — ${shown ? "thẻ đang hiện" : badge.enabled ? "dưới ngưỡng, thẻ đang ẩn" : "thẻ đang tắt"}.`}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  update({ ...badge, minValue: Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0 });
                }}
              />
              <div className="flex min-h-11 items-end">
                <Toggle
                  checked={badge.enabled}
                  label="Hiển thị thẻ"
                  onChange={(e) => update({ ...badge, enabled: e.target.checked })}
                />
              </div>
            </div>
          );
        }}
      />
    </div>
  );
}

export interface HomeEditorPinOptions {
  tenants: PinOption[];
  products: PinOption[];
}

export interface HomeSeoValue {
  seoTitle: string;
  seoDescription: string;
}

function CtaEditor({ id, label, value, onChange }: { id: string; label: string; value: HomeCta; onChange: (v: HomeCta) => void }) {
  return (
    <div className="rounded-lg border p-3.5" style={{ borderColor: LINE }}>
      <p className="mb-2.5 text-sm font-medium" style={{ color: INK }}>
        {label}
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextField id={`${id}-label`} label="Nhãn nút" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
        <TextField id={`${id}-href`} label="Đích (/… hoặc https://…)" value={value.href} onChange={(e) => onChange({ ...value, href: e.target.value })} />
      </div>
    </div>
  );
}

/** CTA tuỳ chọn: để trống cả nhãn và đích = không có nút. */
function OptionalCtaEditor({ id, label, value, onChange }: { id: string; label: string; value: HomeCta | undefined; onChange: (v: HomeCta | undefined) => void }) {
  const current = value ?? { label: "", href: "" };
  return (
    <div className="rounded-lg border p-3.5" style={{ borderColor: LINE }}>
      <p className="mb-2.5 text-sm font-medium" style={{ color: INK }}>
        {label} <span className="font-normal text-gray-500">(không bắt buộc — để trống cả hai ô = không có nút)</span>
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextField
          id={`${id}-label`}
          label="Nhãn nút"
          value={current.label}
          onChange={(e) => {
            const next = { ...current, label: e.target.value };
            onChange(next.label || next.href ? next : undefined);
          }}
        />
        <TextField
          id={`${id}-href`}
          label="Đích (/… hoặc https://…)"
          value={current.href}
          onChange={(e) => {
            const next = { ...current, href: e.target.value };
            onChange(next.label || next.href ? next : undefined);
          }}
        />
      </div>
    </div>
  );
}

function TextAreaField({ id, label, value, rows = 3, maxLength, hint, onChange }: { id: string; label: string; value: string; rows?: number; maxLength?: number; hint?: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <textarea id={id} rows={rows} value={value} maxLength={maxLength} onChange={(e) => onChange(e.target.value)} aria-describedby={hint ? `${id}-hint` : undefined} className={TEXTAREA_CLASS} style={{ borderColor: LINE }} />
      {hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs text-gray-500">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Ô chữ tuỳ chọn: chuỗi rỗng lưu thành `undefined`. */
function optional(value: string): string | undefined {
  return value.length > 0 ? value : undefined;
}

function LinesField({ id, label, value, onChange }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <textarea
        id={id}
        rows={Math.max(3, value.length)}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))}
        className={TEXTAREA_CLASS}
        style={{ borderColor: LINE }}
      />
      <p className="mt-1.5 text-xs text-gray-500">Mỗi dòng = 1 mục. Để trống = không có bullet.</p>
    </div>
  );
}

/** Danh sách mục có id: Lên/Xuống/Xoá + Thêm. */
function ItemList<T extends { id: string }>({
  label,
  items,
  min = 0,
  max,
  itemName,
  create,
  onChange,
  render,
}: {
  label: string;
  items: T[];
  min?: number;
  max: number;
  itemName: string;
  create: () => T;
  onChange: (items: T[]) => void;
  render: (item: T, index: number, update: (next: T) => void) => React.ReactNode;
}) {
  function moveItem(index: number, dir: -1 | 1) {
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(next);
  }
  return (
    <div>
      <p className="text-sm font-medium" style={{ color: INK }}>
        {label} ({items.length}/{max})
      </p>
      <div className="mt-1.5 space-y-3">
        {items.map((item, index) => (
          <div key={item.id} className="rounded-lg border p-3.5" style={{ borderColor: LINE }}>
            <div className="mb-2 flex items-center justify-between gap-2">
              <p className="text-xs font-semibold text-gray-500">
                {itemName} {index + 1}
              </p>
              <div className="flex items-center gap-1">
                <button type="button" disabled={index === 0} onClick={() => moveItem(index, -1)} aria-label={`Đưa ${itemName} ${index + 1} lên`} className={`${ICON_BTN} text-gray-600`}>
                  <IconChevronDown className="h-3.5 w-3.5 rotate-180" />
                </button>
                <button type="button" disabled={index === items.length - 1} onClick={() => moveItem(index, 1)} aria-label={`Đưa ${itemName} ${index + 1} xuống`} className={`${ICON_BTN} text-gray-600`}>
                  <IconChevronDown className="h-3.5 w-3.5" />
                </button>
                <button type="button" disabled={items.length <= min} onClick={() => onChange(items.filter((_, i) => i !== index))} aria-label={`Xoá ${itemName} ${index + 1}`} className={`${ICON_BTN} hover:bg-red-50`} style={{ color: "#DC2626" }}>
                  <IconTrash className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            {render(item, index, (next) => onChange(items.map((it, i) => (i === index ? next : it))))}
          </div>
        ))}
      </div>
      <div className="mt-2.5">
        <GhostButton disabled={items.length >= max} onClick={() => onChange([...items, create()])}>
          <IconPlus className="h-4 w-4" /> Thêm {itemName.toLowerCase()}
        </GhostButton>
      </div>
    </div>
  );
}

function FeaturedExtraFields({ prefix, data, onChange }: { prefix: string; data: HomeSectionData<"coaches"> | HomeSectionData<"documents">; onChange: (next: { eyebrow?: string; cta?: HomeCta; minToShow?: number }) => void }) {
  return (
    <>
      <TextField id={`${prefix}-eyebrow`} label="Eyebrow (dòng nhỏ trên tiêu đề, không bắt buộc)" value={data.eyebrow ?? ""} onChange={(e) => onChange({ eyebrow: optional(e.target.value) })} />
      <MinToShowField id={`${prefix}-min`} value={data.minToShow} limit={data.limit} onChange={(minToShow) => onChange({ minToShow })} />
      <OptionalCtaEditor id={`${prefix}-cta`} label="Nút xem tất cả" value={data.cta} onChange={(cta) => onChange({ cta })} />
    </>
  );
}

function SectionFields({
  section,
  pinOptions,
  liveStats,
  onChange,
}: {
  section: HomeSection;
  pinOptions: HomeEditorPinOptions;
  liveStats: HomeEditorLiveStats;
  onChange: (data: HomeSection["data"]) => void;
}) {
  switch (section.type) {
    case "hero": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="hero-badge" label="Badge (dòng nhỏ trên tiêu đề)" value={d.badge} onChange={(e) => onChange({ ...d, badge: e.target.value })} />
          <TextField id="hero-title" label="Tiêu đề (H1)" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextAreaField id="hero-subtitle" label="Đoạn mô tả" value={d.subtitle} onChange={(subtitle) => onChange({ ...d, subtitle })} />
          <CtaEditor id="hero-primary" label="CTA chính" value={d.primaryCta} onChange={(v) => onChange({ ...d, primaryCta: v })} />
          <CtaEditor id="hero-secondary" label="CTA phụ" value={d.secondaryCta} onChange={(v) => onChange({ ...d, secondaryCta: v })} />
          <TextField
            id="hero-brand-message"
            label="Thông điệp dưới nút (không bắt buộc)"
            hint="Để trống = không hiển thị dòng này."
            maxLength={80}
            value={d.brandMessage ?? ""}
            onChange={(e) => onChange({ ...d, brandMessage: optional(e.target.value) })}
          />
          <ImageUploadField
            label="Ảnh minh hoạ (trống = dùng minh hoạ mặc định)"
            hint="Khung ảnh cố định tỷ lệ 4:5 — dùng ảnh 1200×1500 px (ảnh tỷ lệ khác sẽ bị cắt giữa), WebP/JPEG < 300 KB, chừa khoảng 15% mỗi góc cho thẻ số liệu."
            value={d.imageUrl ?? ""}
            onChange={(url) => onChange({ ...d, imageUrl: url })}
          />
          <TextField
            id="hero-image-alt"
            label="Mô tả ảnh (alt, không bắt buộc)"
            hint="Ảnh có nội dung thì mô tả ngắn; để trống = ảnh trang trí."
            maxLength={160}
            value={d.imageAlt ?? ""}
            onChange={(e) => onChange({ ...d, imageAlt: optional(e.target.value) })}
          />
          <HeroStatBadgesEditor badges={d.statBadges} liveStats={liveStats} onChange={(statBadges) => onChange({ ...d, statBadges })} />
        </div>
      );
    }
    case "stats": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>
            Con số lấy tự động từ dữ liệu thật. Ô đang tắt hoặc có giá trị 0 sẽ tự ẩn; ẩn hết thì cả section không hiển thị. Thứ tự cố
            định như dưới đây.
          </LiveDataNote>
          <ol className="grid gap-3 sm:grid-cols-2">
            {HOME_STAT_KEYS.map((key, index) => {
              const metric = d.metrics[key];
              const labelError = metric.label.trim() ? undefined : "Nhập nhãn hiển thị (tối đa 60 ký tự).";
              return (
                <li key={key} className="rounded-lg border p-3.5" style={{ borderColor: LINE, background: metric.enabled ? "white" : "#F9FAFB" }}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold" style={{ color: INK }}>
                      <span className="mr-1.5 tabular-nums" style={{ color: "#6B7280" }}>
                        {index + 1}.
                      </span>
                      {STAT_EDITOR_NAMES[key]}
                    </p>
                    <Toggle
                      checked={metric.enabled}
                      aria-label={`Hiển thị ô ${STAT_EDITOR_NAMES[key]}`}
                      onChange={(e) => onChange({ ...d, metrics: { ...d.metrics, [key]: { ...metric, enabled: e.target.checked } } })}
                    />
                  </div>
                  <TextField
                    id={`stats-${key}-label`}
                    label="Nhãn hiển thị"
                    maxLength={60}
                    required
                    value={metric.label}
                    error={labelError}
                    hint={metric.enabled ? "Hiện dưới con số trên trang chủ." : "Đang tắt — ô này không hiển thị."}
                    onChange={(e) => onChange({ ...d, metrics: { ...d.metrics, [key]: { ...metric, label: e.target.value } } })}
                  />
                </li>
              );
            })}
          </ol>
        </div>
      );
    }
    case "search": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="search-eyebrow" label="Eyebrow (không bắt buộc)" value={d.eyebrow ?? ""} onChange={(e) => onChange({ ...d, eyebrow: optional(e.target.value) })} />
          <TextField id="search-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextField id="search-subtitle" label="Mô tả" value={d.subtitle} onChange={(e) => onChange({ ...d, subtitle: e.target.value })} />
          <TextField
            id="search-placeholder"
            label="Gợi ý trong ô tìm kiếm"
            hint="Chữ mờ hiện trong ô tìm khi chưa gõ."
            value={d.placeholder}
            onChange={(e) => onChange({ ...d, placeholder: e.target.value })}
          />
          <TextField id="search-submit" label="Nhãn nút tìm" maxLength={20} value={d.submitLabel} onChange={(e) => onChange({ ...d, submitLabel: e.target.value })} />
          <LiveDataNote>Chip danh mục lấy tự động từ danh mục đang hoạt động có ít nhất 1 tài liệu công khai (nhiều tài liệu xếp trước).</LiveDataNote>
        </div>
      );
    }
    case "benefits": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="benefits-eyebrow" label="Eyebrow (dòng nhỏ)" value={d.eyebrow} onChange={(e) => onChange({ ...d, eyebrow: e.target.value })} />
          <TextField id="benefits-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextAreaField id="benefits-description" label="Mô tả" value={d.description} onChange={(description) => onChange({ ...d, description })} />
          <ArrayObjectEditor
            label="Lợi ích (1–4) — đối chiếu với tính năng đang chạy trước khi xuất bản"
            items={d.items}
            fields={[
              { key: "title", label: "Tiêu đề" },
              { key: "description", label: "Mô tả" },
            ]}
            emptyItem={{ title: "", description: "" }}
            onChange={(items) => onChange({ ...d, items })}
          />
        </div>
      );
    }
    case "coaches": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>Thẻ lấy từ gian hàng đang hoạt động có tài liệu công khai: tên, logo, số tài liệu, điểm đánh giá, số đã bán.</LiveDataNote>
          <TextField id="coaches-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextAreaField id="coaches-subtitle" label="Mô tả" value={d.subtitle} onChange={(subtitle) => onChange({ ...d, subtitle })} />
          <LimitField id="coaches-limit" value={d.limit} onChange={(limit) => onChange({ ...d, limit, minToShow: Math.min(d.minToShow, limit) })} />
          <FeaturedExtraFields prefix="coaches" data={d} onChange={(next) => onChange({ ...d, ...next })} />
          <PinPicker
            id="coaches-pins"
            label="Giáo viên / Coach ghim trước"
            searchLabel="Tìm giáo viên / coach để ghim"
            searchPlaceholder="Tên gian hàng…"
            value={d.pinnedTenantIds}
            max={HOME_PINNED_MAX}
            limit={d.limit}
            initialOptions={pinOptions.tenants}
            search={searchTenantPins}
            onChange={(pinnedTenantIds) => onChange({ ...d, pinnedTenantIds })}
          />
        </div>
      );
    }
    case "documents": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <LiveDataNote>Thẻ lấy từ tài liệu công khai: ảnh bìa, tên, gian hàng, giá hiệu lực (khuyến mãi), điểm đánh giá, số đã bán.</LiveDataNote>
          <TextField id="documents-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextAreaField id="documents-subtitle" label="Mô tả" value={d.subtitle} onChange={(subtitle) => onChange({ ...d, subtitle })} />
          <LimitField id="documents-limit" value={d.limit} onChange={(limit) => onChange({ ...d, limit, minToShow: Math.min(d.minToShow, limit) })} />
          <FeaturedExtraFields prefix="documents" data={d} onChange={(next) => onChange({ ...d, ...next })} />
          <PinPicker
            id="documents-pins"
            label="Tài liệu ghim trước"
            searchLabel="Tìm tài liệu để ghim"
            searchPlaceholder="Tên tài liệu…"
            value={d.pinnedProductIds}
            max={HOME_PINNED_MAX}
            limit={d.limit}
            initialOptions={pinOptions.products}
            search={searchProductPins}
            onChange={(pinnedProductIds) => onChange({ ...d, pinnedProductIds })}
          />
        </div>
      );
    }
    case "becomeSeller": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="bs-eyebrow" label="Eyebrow" value={d.eyebrow} onChange={(e) => onChange({ ...d, eyebrow: e.target.value })} />
          <TextField id="bs-title" label="Tiêu đề (phần đầu)" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextField id="bs-highlight" label="Phần highlight sau tiêu đề (không bắt buộc)" value={d.highlight} onChange={(e) => onChange({ ...d, highlight: e.target.value })} />
          <div className="space-y-3">
            <p className="text-sm font-medium" style={{ color: INK }}>
              Đoạn văn ({d.body.length}/{HOME_BODY_PARAGRAPHS_MAX})
            </p>
            {d.body.map((paragraph, index) => (
              <div key={index} className="flex items-start gap-2">
                <div className="grow">
                  <TextAreaField id={`bs-body-${index}`} label={`Đoạn ${index + 1}`} value={paragraph} maxLength={600} onChange={(v) => onChange({ ...d, body: d.body.map((p, i) => (i === index ? v : p)) })} />
                </div>
                <button type="button" onClick={() => onChange({ ...d, body: d.body.filter((_, i) => i !== index) })} aria-label={`Xoá đoạn ${index + 1}`} className="mt-7 rounded p-2 hover:bg-red-50" style={{ color: "#DC2626" }}>
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            ))}
            <GhostButton disabled={d.body.length >= HOME_BODY_PARAGRAPHS_MAX} onClick={() => onChange({ ...d, body: [...d.body, ""] })}>
              <IconPlus className="h-4 w-4" /> Thêm đoạn
            </GhostButton>
          </div>
          <LinesField id="bs-bullets" label="Bullet points (không bắt buộc)" value={d.bullets} onChange={(bullets) => onChange({ ...d, bullets })} />
          <CtaEditor id="bs-cta" label="CTA chính" value={d.cta} onChange={(v) => onChange({ ...d, cta: v })} />
          <OptionalCtaEditor id="bs-secondary" label="CTA phụ" value={d.secondaryCta} onChange={(v) => onChange({ ...d, secondaryCta: v })} />
        </div>
      );
    }
    case "steps": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="steps-eyebrow" label="Eyebrow (không bắt buộc)" value={d.eyebrow ?? ""} onChange={(e) => onChange({ ...d, eyebrow: optional(e.target.value) })} />
          <TextField id="steps-title" label="Tiêu đề (H2)" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <ItemList
            label={`Các bước (${HOME_STEPS_MIN}–${HOME_STEPS_MAX})`}
            items={d.items}
            min={HOME_STEPS_MIN}
            max={HOME_STEPS_MAX}
            itemName="Bước"
            create={() => ({ id: newId("step"), title: "", description: "" })}
            onChange={(items) => onChange({ ...d, items })}
            render={(item, index, update) => (
              <div className="grid gap-2.5">
                <TextField id={`step-${item.id}-title`} label="Tiêu đề bước" value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} />
                <TextAreaField id={`step-${item.id}-desc`} label="Mô tả" rows={2} value={item.description} onChange={(description) => update({ ...item, description })} />
                <span className="sr-only">Bước {index + 1}</span>
              </div>
            )}
          />
          <OptionalCtaEditor id="steps-cta" label="Nút cuối section" value={d.cta} onChange={(cta) => onChange({ ...d, cta })} />
        </div>
      );
    }
    case "community": {
      const d = section.data;
      const unconsented = d.testimonials.filter((item) => !item.consentConfirmed).length;
      return (
        <div className="space-y-4">
          <SelectField id="community-mode" label="Chế độ hiển thị" value={d.mode} onChange={(e) => onChange({ ...d, mode: e.target.value as HomeCommunityMode })}>
            {HOME_COMMUNITY_MODES.map((mode) => (
              <option key={mode} value={mode}>
                {HOME_COMMUNITY_MODE_LABELS[mode]}
              </option>
            ))}
          </SelectField>
          <LiveDataNote>
            Chế độ chứng thực chỉ hiện mục đã tích “đã có đồng ý”; không còn mục nào (hoặc nhật ký trống) thì tự hiện lời mời bên dưới.
          </LiveDataNote>
          <TextField id="community-eyebrow" label="Eyebrow (không bắt buộc)" value={d.eyebrow ?? ""} onChange={(e) => onChange({ ...d, eyebrow: optional(e.target.value) })} />
          <TextField id="community-title" label="Tiêu đề (H2)" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextAreaField id="community-description" label="Mô tả (không bắt buộc)" value={d.description ?? ""} onChange={(v) => onChange({ ...d, description: optional(v) })} />

          {unconsented > 0 ? (
            <Notice tone="warning">
              {unconsented} lời chứng thực chưa được xác nhận đồng ý — không hiển thị ngoài trang chủ và sẽ chặn Xuất bản cho tới khi tích xác nhận hoặc xoá.
            </Notice>
          ) : null}
          <ItemList
            label="Lời chứng thực"
            items={d.testimonials}
            max={HOME_COMMUNITY_ITEMS_MAX}
            itemName="Lời chứng thực"
            create={() => ({ id: newId("testimonial"), quote: "", name: "", role: "", consentConfirmed: false })}
            onChange={(testimonials) => onChange({ ...d, testimonials })}
            render={(item, _index, update) => (
              <div className="grid gap-2.5">
                <TextAreaField id={`tm-${item.id}-quote`} label="Nội dung (trích nguyên văn)" rows={2} value={item.quote} onChange={(quote) => update({ ...item, quote })} />
                <div className="grid gap-2.5 sm:grid-cols-2">
                  <TextField id={`tm-${item.id}-name`} label="Tên" value={item.name} onChange={(e) => update({ ...item, name: e.target.value })} />
                  <TextField id={`tm-${item.id}-role`} label="Vai trò / khu vực" value={item.role} onChange={(e) => update({ ...item, role: e.target.value })} />
                </div>
                <label className="flex min-h-11 items-center gap-2 text-sm" style={{ color: item.consentConfirmed ? INK : "#B45309" }}>
                  <input type="checkbox" className="h-4 w-4" checked={item.consentConfirmed} onChange={(e) => update({ ...item, consentConfirmed: e.target.checked })} />
                  Người này đã đồng ý cho đăng tên và nội dung
                </label>
              </div>
            )}
          />
          <ItemList
            label="Nhật ký phát triển"
            items={d.devlog}
            max={HOME_COMMUNITY_ITEMS_MAX}
            itemName="Mục nhật ký"
            create={(): HomeSectionData<"community">["devlog"][number] => ({ id: newId("devlog"), date: "", title: "", summary: "" })}
            onChange={(devlog) => onChange({ ...d, devlog })}
            render={(item, _index, update) => (
              <div className="grid gap-2.5 sm:grid-cols-2">
                <TextField id={`dl-${item.id}-date`} type="date" label="Ngày" value={item.date} onChange={(e) => update({ ...item, date: e.target.value })} />
                <TextField id={`dl-${item.id}-title`} label="Tiêu đề" value={item.title} onChange={(e) => update({ ...item, title: e.target.value })} />
                <div className="sm:col-span-2">
                  <TextAreaField id={`dl-${item.id}-summary`} label="Tóm tắt" rows={2} value={item.summary} onChange={(summary) => update({ ...item, summary })} />
                </div>
                <TextField id={`dl-${item.id}-href`} label="Link “Đọc thêm” (không bắt buộc)" value={item.href ?? ""} onChange={(e) => update({ ...item, href: optional(e.target.value) })} />
              </div>
            )}
          />
          <TextAreaField id="community-invite" label="Lời mời tham gia thử nghiệm" value={d.invite.text} maxLength={600} onChange={(text) => onChange({ ...d, invite: { ...d.invite, text } })} />
          <OptionalCtaEditor id="community-invite-cta" label="Nút của lời mời" value={d.invite.cta} onChange={(cta) => onChange({ ...d, invite: { ...d.invite, cta } })} />
        </div>
      );
    }
    case "faq": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="faq-eyebrow" label="Eyebrow (không bắt buộc)" value={d.eyebrow ?? ""} onChange={(e) => onChange({ ...d, eyebrow: optional(e.target.value) })} />
          <TextField id="faq-title" label="Tiêu đề (H2)" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <ItemList
            label="Câu hỏi"
            items={d.items}
            min={1}
            max={HOME_FAQ_MAX}
            itemName="Câu hỏi"
            create={() => ({ id: newId("faq"), question: "", answer: "" })}
            onChange={(items) => onChange({ ...d, items })}
            render={(item, _index, update) => (
              <div className="grid gap-2.5">
                <TextField id={`faq-${item.id}-q`} label="Câu hỏi" maxLength={HOME_FAQ_QUESTION_MAX} value={item.question} onChange={(e) => update({ ...item, question: e.target.value })} />
                <TextAreaField id={`faq-${item.id}-a`} label="Trả lời (văn bản thuần)" maxLength={HOME_FAQ_ANSWER_MAX} value={item.answer} onChange={(answer) => update({ ...item, answer })} />
              </div>
            )}
          />
        </div>
      );
    }
    case "finalCta": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="fc-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextAreaField id="fc-subtitle" label="Mô tả" value={d.subtitle} onChange={(subtitle) => onChange({ ...d, subtitle })} />
          <CtaEditor id="fc-cta" label="CTA chính" value={d.cta} onChange={(v) => onChange({ ...d, cta: v })} />
          <OptionalCtaEditor id="fc-secondary" label="CTA phụ" value={d.secondaryCta} onChange={(v) => onChange({ ...d, secondaryCta: v })} />
          <label className="flex min-h-11 items-center gap-2 text-sm" style={{ color: INK }}>
            <input type="checkbox" className="h-4 w-4" checked={d.showSlogan} onChange={(e) => onChange({ ...d, showSlogan: e.target.checked })} />
            Hiện slogan thương hiệu dưới nút
          </label>
        </div>
      );
    }
  }
}

type Status = "NONE" | "DRAFT" | "PUBLISHED";

export function HomeSectionsEditor({
  live,
  initialSections,
  initialHasDraft,
  initialStatus,
  initialSeo,
  pinOptions,
  liveStats,
}: {
  live: HomeSection[];
  initialSections: HomeSection[];
  initialHasDraft: boolean;
  initialStatus: Status;
  initialSeo: HomeSeoValue;
  pinOptions: HomeEditorPinOptions;
  liveStats: HomeEditorLiveStats;
}) {
  const [sections, setSections] = useState<HomeSection[]>(initialSections);
  const [seo, setSeo] = useState<HomeSeoValue>(initialSeo);
  const [savedSeo, setSavedSeo] = useState<HomeSeoValue>(initialSeo);
  // ADR-058 mục 5 (task 1.2b): mốc "đã lưu" của các section = bản đã nạp (nháp nếu có, không thì live — server chọn sẵn
  // trong `initialSections`), cập nhật sau Lưu nháp/Xuất bản/Khôi phục. Chỉ là trạng thái client, không đổi action.
  const [savedSectionsSnapshot, setSavedSectionsSnapshot] = useState(() => JSON.stringify(initialSections));
  const [hasDraft, setHasDraft] = useState(initialHasDraft);
  const [status, setStatus] = useState<Status>(initialStatus);
  const [selectedId, setSelectedId] = useState<string>(sections[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string; issues?: HomeEditorActionState["issues"] } | null>(null);

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];

  // Cảnh báo mềm brief §8 (không chặn) theo từng section + ô SEO; luật cứng khi xuất bản (báo trước, server kiểm lại).
  const warningsBySection = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const section of sections) {
      const rules = findContentClaimWarnings(collectStrings(section.data));
      if (rules.length > 0) map.set(section.id, rules.map((rule) => rule.message));
    }
    return map;
  }, [sections]);
  const seoWarnings = useMemo(() => findContentClaimWarnings([seo.seoTitle, seo.seoDescription]).map((rule) => rule.message), [seo]);
  const blockingIssues = useMemo(() => homePublishIssues(sections), [sections]);
  const sectionsDirty = useMemo(() => JSON.stringify(sections) !== savedSectionsSnapshot, [sections, savedSectionsSnapshot]);
  const seoDirty = seo.seoTitle !== savedSeo.seoTitle || seo.seoDescription !== savedSeo.seoDescription;
  const isDirty = sectionsDirty || seoDirty;
  useUnsavedChanges(isDirty, "Trang chủ có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");

  function updateSelectedData(data: HomeSection["data"]) {
    setSections((prev) => prev.map((s) => (s.id === selectedId ? ({ ...s, data } as HomeSection) : s)));
  }

  function toggleVisible(id: string) {
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, visible: !s.visible } : s)));
  }

  function move(id: string, dir: -1 | 1) {
    setSections((prev) => {
      const index = prev.findIndex((s) => s.id === id);
      const target = index + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(target, 0, item!);
      return next;
    });
  }

  function showResult(result: HomeEditorActionState, okText: string) {
    setMessage(result.success ? { ok: true, text: okText } : { ok: false, text: result.error ?? "Thao tác thất bại.", issues: result.issues });
  }

  function saveDraft() {
    const submittedSeo = seo;
    const submittedSections = sections;
    startTransition(async () => {
      const result = await saveHomeDraftAction(submittedSections, submittedSeo);
      if (result.success) {
        setHasDraft(true);
        setSavedSeo(submittedSeo);
        setSavedSectionsSnapshot(JSON.stringify(submittedSections));
        if (status === "NONE") setStatus("DRAFT");
      }
      showResult(result, "Đã lưu bản nháp.");
    });
  }

  function publish() {
    const submittedSeo = seo;
    const submittedSections = sections;
    startTransition(async () => {
      const result = await publishHomeAction(submittedSections, submittedSeo);
      if (result.success) {
        setHasDraft(false);
        setSavedSeo(submittedSeo);
        setSavedSectionsSnapshot(JSON.stringify(submittedSections));
        setStatus("PUBLISHED");
      }
      showResult(result, "Đã xuất bản — trang chủ đã cập nhật.");
    });
  }

  function restoreLive() {
    startTransition(async () => {
      const result = await restoreLiveHomeAction();
      if (result.success) {
        setSections(live);
        setSavedSectionsSnapshot(JSON.stringify(live));
        setSeo(savedSeo);
        setHasDraft(false);
      }
      showResult(result, "Đã khôi phục về bản đang hiển thị.");
    });
  }

  const sectionLabelOf = (id: string) => {
    const section = sections.find((s) => s.id === id);
    return section ? HOME_SECTION_LABELS[section.type] : id;
  };

  const titleWarning = seoLengthWarning("title", seo.seoTitle);
  const descriptionWarning = seoLengthWarning("description", seo.seoDescription);

  return (
    <div className="mt-6 space-y-6">
      {status !== "PUBLISHED" ? (
        <Notice tone="info">
          {status === "NONE" ? "Chưa lưu lần nào" : "Chưa xuất bản"} — trang chủ đang hiển thị nội dung mặc định (soạn theo brief nội dung trang chủ).
        </Notice>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
        <aside className="rounded-2xl border bg-white p-4" style={{ borderColor: LINE }}>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-semibold tracking-wide text-gray-500">SECTIONS ({sections.length})</p>
            {hasDraft ? (
              <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#FFFBEB", color: "#B45309" }}>
                Có nháp chưa xuất bản
              </span>
            ) : null}
          </div>
          <div className="space-y-1.5">
            {sections.map((s, i) => {
              const label = HOME_SECTION_LABELS[s.type];
              const isSelected = s.id === selectedId;
              return (
                <div
                  key={s.id}
                  className="flex items-center gap-1 rounded-xl border p-1 transition-colors motion-reduce:transition-none"
                  style={{ borderColor: isSelected ? brandColors.accent : LINE, background: isSelected ? brandColors.accentSoft : "white" }}
                >
                  {/* Nút con mắt thay checkbox 16px (target ≥ 44px dưới lg) — cùng mẫu editor Cửa hàng/Trang bán hàng. */}
                  <button
                    type="button"
                    onClick={() => toggleVisible(s.id)}
                    aria-pressed={s.visible}
                    aria-label={`${s.visible ? "Ẩn" : "Hiện"} section ${label}`}
                    title={s.visible ? "Đang hiện — bấm để ẩn" : "Đang ẩn — bấm để hiện"}
                    className={ICON_BTN}
                    style={{ color: s.visible ? "#15803D" : "#6B7280" }}
                  >
                    {s.visible ? <IconEye className="h-[18px] w-[18px]" /> : <IconEyeOff className="h-[18px] w-[18px]" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedId(s.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`flex min-h-11 min-w-0 flex-1 cursor-pointer flex-col items-start justify-center rounded-lg px-1.5 text-left lg:min-h-9 ${FOCUS}`}
                  >
                    <span className="w-full truncate text-sm font-medium" style={{ color: s.visible ? INK : "#6B7280" }}>
                      {label}
                    </span>
                    {!s.visible || warningsBySection.has(s.id) ? (
                      <span className="flex flex-wrap gap-x-2 text-[11px] font-semibold">
                        {!s.visible ? <span style={{ color: "#6B7280" }}>Đang ẩn</span> : null}
                        {warningsBySection.has(s.id) ? <span style={{ color: "#B45309" }}>Cần xác minh</span> : null}
                      </span>
                    ) : null}
                  </button>
                  <button type="button" disabled={i === 0} onClick={() => move(s.id, -1)} aria-label={`Đưa ${label} lên`} className={ICON_BTN} style={{ color: INK }}>
                    <IconChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                  <button type="button" disabled={i === sections.length - 1} onClick={() => move(s.id, 1)} aria-label={`Đưa ${label} xuống`} className={ICON_BTN} style={{ color: INK }}>
                    <IconChevronDown className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
          </div>
        </aside>

        <section className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }}>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: LINE }}>
            <div>
              <h2 className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
                Chỉnh sửa: {selected ? HOME_SECTION_LABELS[selected.type] : ""}
              </h2>
              <p className="text-xs text-gray-400">id: {selected?.id}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Chữ + màu (không chỉ màu); vùng polite để trình đọc màn hình biết khi trạng thái đổi. */}
              <span aria-live="polite" className="inline-flex">
                {isDirty ? <Badge tone="warning">Có thay đổi chưa lưu</Badge> : null}
              </span>
              <Link href="/" target="_blank" rel="noreferrer">
                <GhostButton type="button">Xem trang chủ ↗</GhostButton>
              </Link>
              <GhostButton onClick={restoreLive} disabled={isPending || !hasDraft}>
                Khôi phục bản đang hiển thị
              </GhostButton>
              <GhostButton onClick={saveDraft} disabled={isPending}>
                {isPending ? "Đang lưu..." : "Lưu bản nháp"}
              </GhostButton>
              <PrimaryButton type="button" onClick={publish} disabled={isPending}>
                <IconCheckCircle className="h-4 w-4" /> Xuất bản
              </PrimaryButton>
            </div>
          </div>

          {message ? (
            <div
              role={message.ok ? "status" : "alert"}
              className="mb-4 rounded-lg border px-3.5 py-2.5 text-sm"
              style={message.ok ? { background: "#F0FDF4", borderColor: "#BBF7D0", color: "#166534" } : { background: "#FEF2F2", borderColor: "#FCA5A5", color: "#B91C1C" }}
            >
              <p>{message.text}</p>
              {message.issues && message.issues.length > 1 ? (
                <ul className="mt-1.5 list-disc pl-5">
                  {message.issues.map((issue, index) => (
                    <li key={index}>
                      {sectionLabelOf(issue.sectionId)}: {issue.message}
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

          {blockingIssues.length > 0 ? (
            <div className="mb-4">
              <Notice tone="warning">
                <span className="font-semibold">Chưa xuất bản được ({blockingIssues.length}):</span>
                <ul className="mt-1 list-disc pl-5">
                  {blockingIssues.slice(0, 10).map((issue, index) => (
                    <li key={index}>
                      <button type="button" className="underline" onClick={() => setSelectedId(issue.sectionId)}>
                        {sectionLabelOf(issue.sectionId)}
                      </button>
                      : {issue.message}
                    </li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}

          {selected && warningsBySection.has(selected.id) ? (
            <div className="mb-4">
              <Notice tone="warning">
                <span className="font-semibold">Cần xác minh trước khi xuất bản (không chặn):</span>
                <ul className="mt-1 list-disc pl-5">
                  {warningsBySection.get(selected.id)!.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </Notice>
            </div>
          ) : null}

          {selected ? <SectionFields key={selected.id} section={selected} pinOptions={pinOptions} liveStats={liveStats} onChange={updateSelectedData} /> : null}
        </section>
      </div>

      {/* ADR-058: khối SEO luôn thu gọn, kiểu section Rank Math (tiêu đề + badge trạng thái có chữ + chevron). */}
      <CollapsibleSection
        id="seo"
        title="SEO trang chủ"
        description="Không bắt buộc — để trống dùng tiêu đề/mô tả mặc định."
        icon={<IconGlobe className="h-5 w-5" />}
        status={sectionStatus({
          dirty: seoDirty,
          warningCount: (titleWarning ? 1 : 0) + (descriptionWarning ? 1 : 0) + seoWarnings.length,
          empty: seo.seoTitle.trim() === "" && seo.seoDescription.trim() === "",
          emptyLabel: "Dùng mặc định",
        })}
      >
        <p className="text-sm text-gray-500">
          SEO không có bản nháp: bấm <strong>Lưu bản nháp</strong> hoặc <strong>Xuất bản</strong> đều ghi SEO và áp dụng ngay cho trang
          chủ công khai (nếu trang chủ đã xuất bản). Dùng {"{brand}"} cho tên nền tảng.
        </p>
        <div className="space-y-4">
          <TextField
            id="home-seo-title"
            label={`Tiêu đề SEO (${seo.seoTitle.length}/${SEO_TITLE_MAX})`}
            value={seo.seoTitle}
            maxLength={SEO_TITLE_MAX}
            hint={titleWarning ?? "Khuyến nghị ≤ 60 ký tự."}
            onChange={(event) => setSeo((prev) => ({ ...prev, seoTitle: event.target.value }))}
          />
          <TextAreaField
            id="home-seo-description"
            label={`Mô tả SEO (${seo.seoDescription.length}/${SEO_DESCRIPTION_MAX})`}
            value={seo.seoDescription}
            maxLength={SEO_DESCRIPTION_MAX}
            hint={descriptionWarning ?? "Khuyến nghị ≤ 160 ký tự."}
            onChange={(seoDescription) => setSeo((prev) => ({ ...prev, seoDescription }))}
          />
          {seoWarnings.length > 0 ? (
            <Notice tone="warning">
              <ul className="list-disc pl-5">
                {seoWarnings.map((text) => (
                  <li key={text}>{text}</li>
                ))}
              </ul>
            </Notice>
          ) : null}
        </div>
      </CollapsibleSection>
    </div>
  );
}
