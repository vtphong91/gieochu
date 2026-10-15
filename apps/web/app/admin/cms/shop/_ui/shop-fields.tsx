"use client";

import { useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { formatShopAvgTenths, parseShopAvgTenthsInput } from "@gieochu/core/shop-sections";
import { SelectField, TextField } from "../../../_ui/kit";

/**
 * Field riêng của editor CMS Cửa hàng (ADR-035). Ô chữ/chọn dùng lại `TextField`/`SelectField` của kit; file này
 * chỉ thêm những ô kit chưa có: textarea có đếm ký tự, ô số nguyên, ô điểm "4,0", nhóm radio có mô tả.
 * Lỗi luôn hiện dưới ô + gắn `aria-describedby`/`aria-invalid` (giống `FieldShell` của kit).
 */

const RED = "#DC2626";
const LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";

const inputBase =
  "min-h-11 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15";

function counter(value: string, max: number): string {
  return `${value.length}/${max} ký tự`;
}

function HelpLine({ id, error, hint }: { id: string; error?: string; hint?: string }) {
  if (error) {
    return (
      <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
        {error}
      </p>
    );
  }
  return hint ? (
    <p id={`${id}-hint`} className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
      {hint}
    </p>
  ) : null;
}

/** Ô chữ 1 dòng bắt buộc, có `maxLength` + đếm ký tự trong gợi ý. */
export function ShopTextField({
  id,
  label,
  value,
  max,
  error,
  hint,
  placeholder,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  error?: string;
  hint?: string;
  placeholder?: string;
  onChange: (value: string) => void;
}) {
  return (
    <TextField
      id={id}
      label={label}
      required
      maxLength={max}
      value={value}
      placeholder={placeholder}
      error={error}
      hint={hint ? `${hint} · ${counter(value, max)}` : counter(value, max)}
      className={inputBase}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

/** Ô chữ nhiều dòng bắt buộc (mô tả). */
export function ShopTextAreaField({
  id,
  label,
  value,
  max,
  rows = 3,
  error,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  max: number;
  rows?: number;
  error?: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  const help = hint ? `${hint} · ${counter(value, max)}` : counter(value, max);
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <textarea
        id={id}
        rows={rows}
        required
        maxLength={max}
        value={value}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : `${id}-hint`}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15"
        style={{ borderColor: error ? RED : LINE }}
      />
      <HelpLine id={id} error={error} hint={help} />
    </div>
  );
}

/** Chọn số trong khoảng nhỏ cố định — không có trạng thái gõ sai (giống `LimitField` của CMS trang chủ). */
export function RangeSelectField({
  id,
  label,
  min,
  max,
  unit,
  value,
  error,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  min: number;
  max: number;
  /** Đơn vị sau số, vd "thẻ". */
  unit: string;
  value: number;
  error?: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const choices = Array.from({ length: max - min + 1 }, (_, i) => min + i);
  const inRange = Number.isInteger(value) && value >= min && value <= max;
  return (
    <SelectField
      id={id}
      label={label}
      hint={hint ?? `Từ ${min} đến ${max} ${unit}.`}
      error={error}
      value={inRange ? value : ""}
      className={inputBase}
      onChange={(e) => onChange(Number(e.target.value))}
    >
      {inRange ? null : (
        <option value="" disabled>
          Chọn…
        </option>
      )}
      {choices.map((n) => (
        <option key={n} value={n}>
          {n} {unit}
        </option>
      ))}
    </SelectField>
  );
}

/**
 * Ô số nguyên gõ tay (khoảng rộng, vd 1–50). Giữ chuỗi đang gõ ở state riêng; gõ trống/không phải số → đẩy `NaN`
 * lên để bước kiểm tra trước khi lưu chặn lại (thay vì âm thầm giữ giá trị cũ).
 */
export function IntegerField({
  id,
  label,
  value,
  min,
  max,
  error,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  error?: string;
  hint?: string;
  onChange: (value: number) => void;
}) {
  const [text, setText] = useState(() => (Number.isFinite(value) ? String(value) : ""));
  const [touched, setTouched] = useState(false);
  const parsed = /^\s*\d{1,3}\s*$/.test(text) ? Number(text) : Number.NaN;
  const localError = touched && !(parsed >= min && parsed <= max) ? `Nhập số nguyên từ ${min} đến ${max}.` : undefined;
  const shownError = error ?? localError;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        required
        value={text}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? `${id}-error` : `${id}-hint`}
        onBlur={() => setTouched(true)}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onChange(/^\s*\d{1,3}\s*$/.test(next) ? Number(next) : Number.NaN);
        }}
        className={`mt-1.5 max-w-40 ${inputBase}`}
        style={{ borderColor: shownError ? RED : LINE }}
      />
      <HelpLine id={id} error={shownError} hint={hint ?? `Từ ${min} đến ${max}.`} />
    </div>
  );
}

/**
 * Ô ngưỡng điểm trung bình — nhập dạng "4,0" (chấp nhận "4.0", "4"), lưu số nguyên ×10 qua
 * `parseShopAvgTenthsInput` (ADR-035 bổ sung, không float). Sai/ngoài 1,0–5,0 → đẩy `NaN` để chặn lưu.
 */
export function AvgTenthsField({
  id,
  label,
  value,
  error,
  hint,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  error?: string;
  hint?: string;
  onChange: (tenths: number) => void;
}) {
  const [text, setText] = useState(() => (Number.isInteger(value) ? formatShopAvgTenths(value) : ""));
  const [touched, setTouched] = useState(false);
  const localError = touched && parseShopAvgTenthsInput(text) === null ? "Nhập điểm từ 1,0 đến 5,0, tối đa một chữ số thập phân (ví dụ 4,0)." : undefined;
  const shownError = error ?? localError;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        required
        placeholder="4,0"
        value={text}
        aria-invalid={shownError ? true : undefined}
        aria-describedby={shownError ? `${id}-error` : `${id}-hint`}
        onBlur={() => {
          setTouched(true);
          // Chuẩn hoá cách viết khi rời ô ("4.5" / "4" → "4,5" / "4,0").
          const tenths = parseShopAvgTenthsInput(text);
          if (tenths !== null) setText(formatShopAvgTenths(tenths));
        }}
        onChange={(e) => {
          const next = e.target.value;
          setText(next);
          onChange(parseShopAvgTenthsInput(next) ?? Number.NaN);
        }}
        className={`mt-1.5 max-w-40 ${inputBase}`}
        style={{ borderColor: shownError ? RED : LINE }}
      />
      <HelpLine id={id} error={shownError} hint={hint ?? "Từ 1,0 đến 5,0 — một chữ số thập phân, dùng dấu phẩy."} />
    </div>
  );
}

export interface RadioChoice<T extends string> {
  value: T;
  label: string;
  description: string;
}

/** Nhóm radio dạng thẻ có mô tả — `fieldset`/`legend`, cả thẻ là vùng bấm (≥44px). */
export function RadioCardGroup<T extends string>({
  name,
  legend,
  value,
  choices,
  onChange,
}: {
  name: string;
  legend: string;
  value: T;
  choices: RadioChoice<T>[];
  onChange: (value: T) => void;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium" style={{ color: INK }}>
        {legend}
      </legend>
      <div className="mt-1.5 grid gap-2 sm:grid-cols-2">
        {choices.map((choice) => {
          const id = `${name}-${choice.value}`;
          const checked = choice.value === value;
          return (
            <label
              key={choice.value}
              htmlFor={id}
              className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-[var(--brand-primary,#0F3B82)]"
              style={{ borderColor: checked ? brandColors.primary : LINE, background: checked ? brandColors.surface : "white" }}
            >
              <input
                id={id}
                type="radio"
                name={name}
                value={choice.value}
                checked={checked}
                onChange={() => onChange(choice.value)}
                aria-describedby={`${id}-desc`}
                className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--brand-primary,#0F3B82)]"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold" style={{ color: INK }}>
                  {choice.label}
                </span>
                <span id={`${id}-desc`} className="mt-0.5 block text-xs leading-relaxed" style={{ color: INK_SOFT }}>
                  {choice.description}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
