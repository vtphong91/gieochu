"use client";

import { useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
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
          // Ô secret/API key: chặn trình duyệt tự điền mật khẩu đăng nhập đã lưu (form đăng nhập truyền `autoComplete` riêng).
          autoComplete="new-password"
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

/** "*****9123": 5 dấu sao + 4 ký tự cuối; giá trị ≤ 4 ký tự → che toàn bộ (không lộ độ dài). */
export function maskTail(value: string): { masked: string; tail: string } {
  const v = value.trim();
  if (v.length <= 4) return { masked: "*****", tail: "" };
  const tail = v.slice(-4);
  return { masked: `*****${tail}`, tail };
}

/**
 * Ô văn bản che bớt trên giao diện (số tài khoản, số điện thoại ví) — API như `TextField`.
 * - Có giá trị → mặc định hiện khung chỉ đọc "*****9123" + nút mắt (`aria-pressed`); bấm → hiện input thật và focus vào đó.
 *   Ô trống → hiện input luôn. Có `error` → tự chuyển sang hiện để sửa.
 * - `<input name>` thật LUÔN nằm trong form (chỉ `hidden` khi đang che) → form submit đúng và `useFormDraft` đọc/ghi
 *   được qua `form.elements`. `useFormDraft` ghi lại giá trị bằng `field.value = ...` (không phát sự kiện) trong
 *   `setTimeout(0)` sau `reset` → ở đây nghe `reset` của form và đọc lại giá trị ở tick SAU tick đó; gõ phím thì theo `onChange`.
 * - Chỉ che trên giao diện: giá trị đầy đủ vẫn có trong HTML gửi về trình duyệt người quản trị (để sửa được).
 */
export function MaskedTextField({
  label,
  hint,
  error,
  id,
  defaultValue,
  onChange,
  onInvalid,
  toggleLabel = "Hiện số đầy đủ",
  ...rest
}: ComponentProps<"input"> & { label: string; hint?: string; error?: string; toggleLabel?: string }) {
  const initialValue = defaultValue == null ? "" : String(defaultValue);
  const inputRef = useRef<HTMLInputElement>(null);
  const focusOnReveal = useRef(false);
  const [value, setValue] = useState(initialValue);
  const [revealed, setRevealed] = useState(initialValue.trim() === "" || Boolean(error));
  // Lỗi mới từ server → mở ô để sửa (điều chỉnh state theo prop ngay khi render, không cần effect).
  const [prevError, setPrevError] = useState(error);
  if (error !== prevError) {
    setPrevError(error);
    if (error) setRevealed(true);
  }

  const hasValue = value.trim() !== "";
  const open = revealed || !hasValue;
  const describedBy = id ? (error ? `${id}-error` : hint ? `${id}-hint` : undefined) : undefined;
  const maskedId = id ? `${id}-masked` : undefined;
  const { masked, tail } = maskTail(value);
  const maskedLabel = tail ? `${label}, đã ẩn, kết thúc bằng ${tail}` : `${label}, đã ẩn`;

  // Đồng bộ phần hiển thị khi form reset (React 19 reset sau action) hoặc useFormDraft ghi lại giá trị sau lưu lỗi.
  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const timers: number[] = [];
    const sync = () => {
      const el = inputRef.current;
      if (!el) return;
      setValue(el.value);
      // Bị ghi về rỗng → giữ trạng thái mở, tránh ô tự ẩn ngay khi người dùng bắt đầu gõ lại.
      if (el.value.trim() === "") setRevealed(true);
    };
    const handleReset = () => {
      // Tick 1 trùng tick useFormDraft đặt lịch (cùng lần dispatch `reset`) → lồng thêm 1 tick để chạy sau khi nó ghi xong.
      timers.push(window.setTimeout(() => timers.push(window.setTimeout(sync, 0)), 0));
    };
    form.addEventListener("reset", handleReset);
    return () => {
      form.removeEventListener("reset", handleReset);
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, []);

  useEffect(() => {
    if (revealed && focusOnReveal.current) {
      focusOnReveal.current = false;
      inputRef.current?.focus();
    }
  }, [revealed]);

  return (
    <FieldShell label={label} htmlFor={id!} hint={hint} error={error}>
      <div className="relative">
        {open ? null : (
          <div
            id={maskedId}
            role="img"
            aria-label={maskedLabel}
            className="w-full rounded-lg border bg-gray-50 px-3.5 py-2.5 pr-12 text-[15px] tracking-wider tabular-nums select-none"
            style={{ borderColor: GRAY_LINE, color: INK }}
          >
            {masked}
          </div>
        )}
        <input
          ref={inputRef}
          id={id}
          hidden={!open}
          className={hasValue ? `${inputBase} pr-12` : inputBase}
          style={{ borderColor: error ? RED : GRAY_LINE }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          defaultValue={defaultValue}
          // Ô cấu hình thanh toán: không để trình duyệt tự điền dữ liệu đã lưu (lỗi Chrome autofill).
          autoComplete="off"
          onChange={(event) => {
            setValue(event.currentTarget.value);
            // Đang gõ = ô đang mở → chốt trạng thái mở (ô trống ban đầu không tự che khi vừa có ký tự).
            setRevealed(true);
            onChange?.(event);
          }}
          onInvalid={(event) => {
            // Ô đang che mà không hợp lệ → trình duyệt không focus được để báo lỗi → mở ra.
            setRevealed(true);
            onInvalid?.(event);
          }}
          {...rest}
        />
        {hasValue ? (
          <button
            type="button"
            onClick={() => {
              if (!open) focusOnReveal.current = true;
              setRevealed(!open);
            }}
            aria-label={toggleLabel}
            aria-pressed={open}
            aria-controls={id}
            aria-describedby={open ? undefined : maskedId}
            className="absolute inset-y-0 right-0 flex w-11 min-h-11 cursor-pointer items-center justify-center rounded-r-lg text-gray-500 outline-offset-[-3px] hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-[#0F3B82]"
          >
            {open ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
          </button>
        ) : null}
      </div>
    </FieldShell>
  );
}
