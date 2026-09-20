"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
// Import trực tiếp từ subpath (không qua barrel "@gieochu/core") — đây là
// "use client" component, còn barrel index.ts kéo theo cả code server-only
// (argon2) khiến Next cố bundle cho browser rồi lỗi "Module not found: fs".
import { HOME_SECTION_LABELS, type HomeSection } from "@gieochu/core/home-sections";
import { GhostButton, PrimaryButton, TextField } from "../../_ui/kit";
import { IconChevronDown, IconCheckCircle } from "../../_ui/icons";
import { ArrayObjectEditor } from "./array-object-editor";
import { ImageUploadField } from "../../_ui/image-upload-field";
import { publishHomeAction, restoreLiveHomeAction, saveHomeDraftAction } from "./actions";

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

function SectionFields({ section, onChange }: { section: HomeSection; onChange: (data: HomeSection["data"]) => void }) {
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
        <ArrayObjectEditor
          label="Số liệu"
          items={d.items}
          fields={[
            { key: "value", label: "Giá trị" },
            { key: "label", label: "Nhãn" },
          ]}
          emptyItem={{ value: "", label: "" }}
          onChange={(items) => onChange({ ...d, items })}
        />
      );
    }
    case "search": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="search-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextField id="search-subtitle" label="Mô tả" value={d.subtitle} onChange={(e) => onChange({ ...d, subtitle: e.target.value })} />
          <TextField id="search-placeholder" label="Placeholder ô tìm kiếm" value={d.placeholder} onChange={(e) => onChange({ ...d, placeholder: e.target.value })} />
          <LinesField id="search-chips" label="Nhãn gợi ý (chip)" value={d.chips} onChange={(chips) => onChange({ ...d, chips })} />
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
          <TextField id="coaches-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextField id="coaches-subtitle" label="Mô tả" value={d.subtitle} onChange={(e) => onChange({ ...d, subtitle: e.target.value })} />
          <ArrayObjectEditor
            label="Giáo viên / Coach nổi bật"
            items={d.items}
            fields={[
              { key: "name", label: "Tên" },
              { key: "subject", label: "Môn / chuyên môn" },
              { key: "rating", label: "Điểm đánh giá" },
              { key: "reviews", label: "Số lượt đánh giá" },
              { key: "sold", label: "Số liệu bán (text)" },
            ]}
            emptyItem={{ name: "", subject: "", rating: "", reviews: "", sold: "" }}
            onChange={(items) => onChange({ ...d, items })}
          />
        </div>
      );
    }
    case "documents": {
      const d = section.data;
      return (
        <div className="space-y-4">
          <TextField id="documents-title" label="Tiêu đề" value={d.title} onChange={(e) => onChange({ ...d, title: e.target.value })} />
          <TextField id="documents-subtitle" label="Mô tả" value={d.subtitle} onChange={(e) => onChange({ ...d, subtitle: e.target.value })} />
          <ArrayObjectEditor
            label="Tài liệu nổi bật"
            items={d.items}
            fields={[
              { key: "tag", label: "Nhãn (VD: Đề thi)" },
              { key: "title", label: "Tên tài liệu" },
              { key: "seller", label: "Người bán" },
              { key: "rating", label: "Điểm đánh giá" },
              { key: "sold", label: "Số lượt mua (text)" },
              { key: "price", label: "Giá" },
            ]}
            emptyItem={{ tag: "", title: "", seller: "", rating: "", sold: "", price: "" }}
            onChange={(items) => onChange({ ...d, items })}
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
          label="Đánh giá"
          items={d.items}
          fields={[
            { key: "quote", label: "Nội dung đánh giá" },
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

export function HomeSectionsEditor({ pageId, live, draft }: { pageId: string; live: HomeSection[]; draft: HomeSection[] | null }) {
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
              <input type="checkbox" checked={s.visible} onChange={() => toggleVisible(s.id)} className="h-4 w-4 shrink-0 rounded" title="Hiện/ẩn section" />
              <button type="button" onClick={() => setSelectedId(s.id)} className="min-w-0 flex-1 truncate text-left text-sm font-medium" style={{ color: "#12213A" }}>
                {HOME_SECTION_LABELS[s.type]}
              </button>
              <div className="flex shrink-0 flex-col">
                <button type="button" disabled={i === 0} onClick={() => move(s.id, -1)} aria-label="Đưa lên" className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
                  <IconChevronDown className="h-3 w-3 rotate-180" />
                </button>
                <button type="button" disabled={i === sections.length - 1} onClick={() => move(s.id, 1)} aria-label="Đưa xuống" className="text-gray-400 hover:text-gray-700 disabled:opacity-30">
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

        {selected ? <SectionFields section={selected} onChange={updateSelectedData} /> : null}
      </section>
    </div>
  );
}
