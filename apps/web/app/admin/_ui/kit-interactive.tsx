"use client";

import { useState, type ComponentProps, type ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconEye, IconEyeOff } from "./icons";

const RED = "#DC2626";
const GRAY_LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";

const inputBase =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15";

function FieldShell({ label, htmlFor, hint, error, children }: { label: string; htmlFor: string; hint?: string; error?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="block text-sm font-medium" style={{ color: INK }}>
        {label}
      </label>
      <div className="mt-1.5">{children}</div>
      {error ? (
        <p id={`${htmlFor}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${htmlFor}-hint`} className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Toggle dạng switch — vẫn là <input type="checkbox"> gốc bên trong (tương thích
 * 100% với useActionState/name=/defaultChecked của form), nhưng màu nền được tính
 * trực tiếp bằng inline style theo state JS thay vì class Tailwind `peer-checked:bg-[...]`
 * — cách cũ dùng CSS custom property lồng trong arbitrary value dễ vỡ (từng bị bug
 * mất màu vì thiếu `var()`), nên đổi sang cách chắc chắn không phụ thuộc cách Tailwind
 * parse arbitrary value. Màu "bật" dùng xanh lá (brandColors.secondary) khớp với tông
 * Badge tone="success" ("Đang bật") đã dùng ở mọi trang cấu hình.
 */
export function Toggle({
  label,
  defaultChecked,
  checked,
  onChange,
  ...rest
}: ComponentProps<"input"> & { label?: string }) {
  const [uncontrolledOn, setIsOn] = useState(Boolean(checked ?? defaultChecked));
  // Có `checked` (controlled) → luôn theo prop, tránh lệch màu khi cha đổi giá trị từ bên ngoài.
  const isOn = checked !== undefined ? Boolean(checked) : uncontrolledOn;

  return (
    <label className="inline-flex cursor-pointer items-center gap-2.5">
      <span className="relative inline-block h-6 w-11 shrink-0">
        <input
          type="checkbox"
          className="peer sr-only"
          defaultChecked={defaultChecked}
          checked={checked}
          onChange={(event) => {
            setIsOn(event.target.checked);
            onChange?.(event);
          }}
          {...rest}
        />
        {/* Input thật bị sr-only → vòng focus vẽ trên rãnh switch (WCAG 2.4.7). */}
        <span
          className="absolute inset-0 rounded-full transition-colors peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#0F3B82]"
          style={{ background: isOn ? brandColors.secondary : "#D1D5DB" }}
        />
        <span
          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform"
          style={{ transform: isOn ? "translateX(1.25rem)" : "translateX(0)" }}
        />
      </span>
      {label ? (
        <span className="text-sm font-medium" style={{ color: INK }}>
          {label}
        </span>
      ) : null}
    </label>
  );
}

/**
 * Ô nhập mật khẩu/secret có nút con mắt ẩn/hiện — tái dùng khung FieldShell, chỉ thêm nút toggle type.
 * A11y (ADR-041 GĐ2): có `id` thì tự gắn `aria-invalid` + `aria-describedby` (`${id}-error` ưu tiên, rồi `${id}-hint`)
 * như `TextField`; nút ẩn/hiện có nhãn cố định (`toggleLabel`, mặc định "Hiện giá trị") + `aria-pressed`, vùng bấm
 * 44px chiều ngang, vòng focus nhìn thấy. Không chặn dán/trình quản lý mật khẩu.
 */
export function PasswordField({
  label,
  hint,
  error,
  id,
  toggleLabel = "Hiện giá trị",
  ...rest
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string; toggleLabel?: string }) {
  const [visible, setVisible] = useState(false);
  const describedBy = id ? (error ? `${id}-error` : hint ? `${id}-hint` : undefined) : undefined;

  return (
    <FieldShell label={label} htmlFor={id!} hint={hint} error={error}>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          className={`${inputBase} pr-12`}
          style={{ borderColor: error ? RED : GRAY_LINE }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={toggleLabel}
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-gray-500 outline-offset-[-3px] hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-[#0F3B82]"
        >
          {visible ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </FieldShell>
  );
}
