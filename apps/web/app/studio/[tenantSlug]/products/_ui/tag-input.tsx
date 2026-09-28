"use client";

import { useState, type KeyboardEvent } from "react";
import { brandColors } from "@gieochu/config/theme";

const RED = "#DC2626";
const GRAY_LINE = "#E5E7EB";

/**
 * Ô nhập thẻ dạng chip. Vẫn gửi đúng contract cũ: 1 field ẩn `name` = chuỗi phân tách dấu phẩy (gồm cả
 * chữ đang gõ dở chưa thành chip — không mất dữ liệu khi bấm Lưu). Enter/dấu phẩy tạo chip và KHÔNG submit
 * form cha; Backspace ở ô rỗng bỏ chip cuối.
 */
export function TagInput({
  id,
  name,
  label,
  hint,
  error,
  initial,
  onChange,
}: {
  id: string;
  name: string;
  label: string;
  hint?: string;
  error?: string;
  initial: string[];
  onChange?: () => void;
}) {
  const [tags, setTags] = useState<string[]>(initial);
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const parts = raw
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);
    if (parts.length === 0) return;
    setTags((current) => {
      const next = [...current];
      for (const part of parts) if (!next.some((t) => t.toLowerCase() === part.toLowerCase())) next.push(part);
      return next;
    });
    setDraft("");
    onChange?.();
  }

  function remove(tag: string) {
    setTags((current) => current.filter((t) => t !== tag));
    onChange?.();
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
    } else if (event.key === "Backspace" && draft === "" && tags.length > 0) {
      remove(tags[tags.length - 1]!);
    }
  }

  const hiddenValue = [...tags, draft.trim()].filter(Boolean).join(", ");
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: brandColors.ink }}>
        {label}
      </label>
      <input type="hidden" name={name} value={hiddenValue} />
      <div
        className="mt-1.5 flex flex-wrap items-center gap-2 rounded-lg border bg-white px-2.5 py-2 focus-within:ring-2 focus-within:ring-[#0F3B82]/15"
        style={{ borderColor: error ? RED : GRAY_LINE }}
      >
        {tags.length > 0 ? (
          <ul className="contents" aria-label="Thẻ đã thêm">
            {tags.map((tag) => (
              <li
                key={tag}
                className="inline-flex max-w-full items-center gap-1 rounded-full py-0.5 pr-0.5 pl-3 text-sm font-medium"
                style={{ background: brandColors.surface, color: brandColors.primary }}
              >
                <span className="min-w-0 [overflow-wrap:anywhere]">{tag}</span>
                <button
                  type="button"
                  onClick={() => remove(tag)}
                  aria-label={`Bỏ thẻ ${tag}`}
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-white/70 sm:h-7 sm:w-7"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
                    <path d="M6 6l12 12M18 6 6 18" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <input
          id={id}
          value={draft}
          onChange={(e) => {
            const value = e.target.value;
            if (value.includes(",")) commit(value);
            else setDraft(value);
          }}
          onKeyDown={onKeyDown}
          onBlur={() => commit(draft)}
          aria-describedby={describedBy}
          aria-invalid={error ? true : undefined}
          placeholder={tags.length === 0 ? "vd: Lớp 5, Toán" : "Thêm thẻ..."}
          className="min-h-11 min-w-[8rem] flex-1 bg-transparent px-1 text-[15px] outline-none sm:min-h-8"
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs" style={{ color: "#6B7280" }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
