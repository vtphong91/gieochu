"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
// Import trực tiếp từ subpath (không qua barrel "@gieochu/core") — đây là
// "use client" component, còn barrel index.ts kéo theo cả code server-only
// (argon2) khiến Next cố bundle cho browser rồi lỗi "Module not found: fs".
import {
  HOME_FEATURED_LIMIT_MAX,
  HOME_FEATURED_LIMIT_MIN,
  HOME_PINNED_MAX,
  HOME_SECTION_LABELS,
  HOME_STAT_KEYS,
  type HomeSection,
  type HomeStatKey,
} from "@gieochu/core/home-sections";
import { GhostButton, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { IconChevronDown, IconCheckCircle } from "../../_ui/icons";
import { ArrayObjectEditor } from "./array-object-editor";
import { ImageUploadField } from "../../_ui/image-upload-field";
import {
  publishHomeAction,
  restoreLiveHomeAction,
  saveHomeDraftAction,
  searchHomeProductOptionsAction,
  searchHomeTenantOptionsAction,
} from "./actions";
import { PinPicker, type PinOption } from "./pin-picker";
import { toProductPinOption, toTenantPinOption } from "./pin-options";

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

/** Ghi chú cố định đầu form của section lấy dữ liệu thật (ADR-033). */
function LiveDataNote({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-lg border px-3.5 py-2.5 text-sm" style={{ background: "#E8F1FF", borderColor: "#BFDBFE", color: "#1E3A8A" }}>
      {children}
    </p>
  );
}

export interface HomeEditorPinOptions {
  tenants: PinOption[];
  products: PinOption[];
}

function CtaEditor({ label, value, onChange }: { label: string; value: { label: string; href: string }; onChange: (v: { label: string; href: string }) => void }) {
  return (
    <div className="rounded-lg border p-3.5" style={{ borderColor: "#E5E7EB" }}>
      <p className="mb-2.5 text-sm font-medium" style={{ color: "#12213A" }}>
        {label}
      </p>
      <div className="grid gap-2.5 sm:grid-cols-2">
        <TextField id={`${label}-label`} label="Label" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
        <TextField id={`${label}-href`} label="Href" value={value.href} onChange={(e) => onChange({ ...value, href: e.target.value })} />
      </div>
    </div>
  );
}

function LinesField({ id, label, value, onChange }: { id: string; label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: "#12213A" }}>
        {label}
      </label>
      <textarea
        id={id}
        rows={Math.max(3, value.length)}
        value={value.join("\n")}
        onChange={(e) => onChange(e.target.value.split("\n").map((v) => v.trim()).filter(Boolean))}
        className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
        style={{ borderColor: "#E5E7EB" }}
      />
      <p className="mt-1.5 text-xs text-gray-500">Mỗi dòng = 1 mục.</p>
    </div>
  );
}

function SectionFields({
  section,
  pinOptions,
  onChange,
}: {
  section: HomeSection;
  pinOptions: HomeEditorPinOptions;
  onChange: (data: HomeSection["data"]) => void;
}) {
  switch (section.type) {
    case "hero": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="hero-badge" label="Badge (dòng nhỏ trên tiêu đề)" value={d.badge} onChange={(e) => onChange({ ...d, badge: e.target.value })} />
          <TextField id="hero-title" label="Tiêu đề (H1)" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <div>
            <label htmlFor="hero-subtitle" className="block text-sm font-medium" style={{ color: "#12213A" }}>
              Đoạn mô tả
            </label>
            <textarea
              id="hero-subtitle"
              rows={3}
              value={d.subtitle}
              onChange={(e) => onChange({ ...d, subtitle: e.target.value })}
              className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
              style={{ borderColor: "#E5E7EB" }}
            />
          </div>
          <CtaEditor label="CTA chính" value={d.primaryCta} onChange={(v) => onChange({ ...d, primaryCta: v })} />
          <CtaEditor label="CTA phụ" value={d.secondaryCta} onChange={(v) => onChange({ ...d, secondaryCta: v })} />
          <ImageUploadField label="Ảnh minh hoạ (trống = dùng mock mặc định)" value={d.imageUrl ?? ""} onChange={(url) => onChange({ ...d, imageUrl: url })} />
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
                <li key={key} className="rounded-lg border p-3.5" style={{ borderColor: "#E5E7EB", background: metric.enabled ? "white" : "#F9FAFB" }}>
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <p className="text-sm font-semibold" style={{ color: "#12213A" }}>
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
          <TextField id="search-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextField id="search-subtitle" label="Mô tả" value={d.subtitle} onChange={(e) => onChange({ ...d, subtitle: e.target.value })} />
          <TextField
            id="search-placeholder"
            label="Gợi ý trong ô tìm kiếm"
            hint="Chữ mờ hiện trong ô tìm khi chưa gõ."
            value={d.placeholder}
            onChange={(e) => onChange({ ...d, placeholder: e.target.value })}
          />
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
          <TextField id="benefits-description" label="Mô tả" value={d.description} onChange={(e) => onChange({ ...d, description: e.target.value })} />
          <ArrayObjectEditor
            label="4 lợi ích"
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
          <TextField id="coaches-subtitle" label="Mô tả" value={d.subtitle} onChange={(e) => onChange({ ...d, subtitle: e.target.value })} />
          <LimitField id="coaches-limit" value={d.limit} onChange={(limit) => onChange({ ...d, limit })} />
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
          <TextField id="documents-subtitle" label="Mô tả" value={d.subtitle} onChange={(e) => onChange({ ...d, subtitle: e.target.value })} />
          <LimitField id="documents-limit" value={d.limit} onChange={(limit) => onChange({ ...d, limit })} />
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
          <TextField id="bs-highlight" label="Từ được highlight (phần sau, màu vàng)" value={d.highlight} onChange={(e) => onChange({ ...d, highlight: e.target.value })} />
          <LinesField id="bs-bullets" label="Bullet points" value={d.bullets} onChange={(bullets) => onChange({ ...d, bullets })} />
          <CtaEditor label="CTA" value={d.cta} onChange={(v) => onChange({ ...d, cta: v })} />
        </div>
      );
    }
    case "testimonials": {
      const d = section.data;
      return (
        <ArrayObjectEditor
          label="Cảm nhận người dùng (nhập tay, về nền tảng)"
          items={d.items}
          fields={[
            { key: "quote", label: "Nội dung cảm nhận" },
            { key: "name", label: "Tên" },
            { key: "role", label: "Vai trò / khu vực" },
          ]}
          emptyItem={{ quote: "", name: "", role: "" }}
          onChange={(items) => onChange({ ...d, items })}
        />
      );
    }
    case "finalCta": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="fc-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextField id="fc-subtitle" label="Mô tả" value={d.subtitle} onChange={(e) => onChange({ ...d, subtitle: e.target.value })} />
          <CtaEditor label="CTA" value={d.cta} onChange={(v) => onChange({ ...d, cta: v })} />
        </div>
      );
    }
  }
}

export function HomeSectionsEditor({
  pageId,
  live,
  draft,
  pinOptions,
}: {
  pageId: string;
  live: HomeSection[];
  draft: HomeSection[] | null;
  pinOptions: HomeEditorPinOptions;
}) {
  const [sections, setSections] = useState<HomeSection[]>(draft ?? live);
  const [hasDraft, setHasDraft] = useState(draft !== null);
  const [selectedId, setSelectedId] = useState<string>(sections[0]?.id ?? "");
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const selected = sections.find((s) => s.id === selectedId) ?? sections[0];

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

  function saveDraft() {
    startTransition(async () => {
      const result = await saveHomeDraftAction(pageId, sections);
      setHasDraft(true);
      setMessage(result.success ? { ok: true, text: "Đã lưu bản nháp." } : { ok: false, text: result.error ?? "Lưu thất bại." });
    });
  }

  function publish() {
    startTransition(async () => {
      const result = await publishHomeAction(pageId, sections);
      if (result.success) setHasDraft(false);
      setMessage(result.success ? { ok: true, text: "Đã publish — trang chủ đã cập nhật." } : { ok: false, text: result.error ?? "Publish thất bại." });
    });
  }

  function restoreLive() {
    startTransition(async () => {
      await restoreLiveHomeAction(pageId);
      setSections(live);
      setHasDraft(false);
      setMessage({ ok: true, text: "Đã khôi phục về bản đang chạy (live)." });
    });
  }

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[300px_1fr]">
      <aside className="rounded-2xl border bg-white p-4" style={{ borderColor: "#E5E7EB" }}>
        <div className="mb-3 flex items-center justify-between">
          <p className="text-xs font-semibold tracking-wide text-gray-500">SECTIONS ({sections.length})</p>
          {hasDraft ? (
            <span className="rounded-full px-2 py-0.5 text-[11px] font-semibold" style={{ background: "#FFFBEB", color: "#B45309" }}>
              Có nháp chưa publish
            </span>
          ) : null}
        </div>
        <div className="space-y-1.5">
          {sections.map((s, i) => (
            <div
              key={s.id}
              className="flex items-center gap-2 rounded-lg border px-2.5 py-2 transition"
              style={{
                borderColor: s.id === selectedId ? "#D97706" : "#E5E7EB",
                background: s.id === selectedId ? "rgba(217,119,6,0.08)" : "white",
              }}
            >
              <input
                type="checkbox"
                checked={s.visible}
                onChange={() => toggleVisible(s.id)}
                className="h-4 w-4 shrink-0 rounded"
                title="Hiện/ẩn section"
                aria-label={`Hiển thị section ${HOME_SECTION_LABELS[s.type]}`}
              />
              <button type="button" onClick={() => setSelectedId(s.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium" style={{ color: "#12213A" }}>
                {HOME_SECTION_LABELS[s.type]}
              </button>
              <div className="flex shrink-0 flex-col">
                <button type="button" disabled={i === 0} onClick={() => move(s.id, -1)} aria-label={`Đưa ${HOME_SECTION_LABELS[s.type]} lên`} className="text-gray-500 hover:text-gray-700 disabled:opacity-30">
                  <IconChevronDown className="h-3 w-3 rotate-180" />
                </button>
                <button type="button" disabled={i === sections.length - 1} onClick={() => move(s.id, 1)} aria-label={`Đưa ${HOME_SECTION_LABELS[s.type]} xuống`} className="text-gray-500 hover:text-gray-700 disabled:opacity-30">
                  <IconChevronDown className="h-3 w-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </aside>

      <section className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4" style={{ borderColor: "#E5E7EB" }}>
          <div>
            <h2 className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
              Chỉnh sửa: {selected ? HOME_SECTION_LABELS[selected.type] : ""}
            </h2>
            <p className="text-xs text-gray-400">id: {selected?.id}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" target="_blank" rel="noreferrer">
              <GhostButton type="button">Xem trang chủ ↗</GhostButton>
            </Link>
            <GhostButton onClick={restoreLive} disabled={isPending || !hasDraft}>
              Khôi phục live
            </GhostButton>
            <GhostButton onClick={saveDraft} disabled={isPending}>
              {isPending ? "Đang lưu..." : "Lưu bản nháp"}
            </GhostButton>
            <PrimaryButton type="button" onClick={publish} disabled={isPending}>
              <IconCheckCircle className="h-4 w-4" /> Publish
            </PrimaryButton>
          </div>
        </div>

        {message ? (
          <p
            role={message.ok ? "status" : "alert"}
            className="mb-4 rounded-lg border px-3.5 py-2.5 text-sm"
            style={message.ok ? { background: "#F0FDF4", borderColor: "#BBF7D0", color: "#16A34A" } : { background: "#FEF2F2", borderColor: "#FCA5A5", color: "#DC2626" }}
          >
            {message.text}
          </p>
        ) : null}

        {selected ? <SectionFields key={selected.id} section={selected} pinOptions={pinOptions} onChange={updateSelectedData} /> : null}
      </section>
    </div>
  );
}
