"use client";

import { forwardRef, useId, useState, type ComponentProps, type ReactNode } from "react";
import { GREEN, INK, INK_SOFT, LINE } from "./colors";

const RED = "#DC2626";

const inputBase =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15";

function FieldShell({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
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
        <p className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

type TextFieldProps = ComponentProps<"input"> & { label: string; error?: string; hint?: string };

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, id, style, ...rest },
  ref,
) {
  return (
    <FieldShell label={label} htmlFor={id!} error={error} hint={hint}>
      <input
        ref={ref}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : undefined}
        className={inputBase}
        style={{ borderColor: error ? RED : LINE, ...style }}
        {...rest}
      />
    </FieldShell>
  );
});

function IconEye({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function IconEyeOff({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 3l18 18" />
      <path d="M10.6 5.6A10.8 10.8 0 0 1 12 5.5c6 0 9.5 6.5 9.5 6.5a15 15 0 0 1-3.2 4M6.5 6.8C4 8.4 2.5 12 2.5 12S6 18.5 12 18.5c1.4 0 2.7-.3 3.8-.8" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </svg>
  );
}

type PasswordFieldProps = ComponentProps<"input"> & { label: string; error?: string; hint?: string };

export const PasswordField = forwardRef<HTMLInputElement, PasswordFieldProps>(function PasswordField(
  { label, error, hint, id, style, ...rest },
  ref,
) {
  const [visible, setVisible] = useState(false);
  const toggleId = useId();
  return (
    <FieldShell label={label} htmlFor={id!} error={error} hint={hint}>
      <div className="relative">
        <input
          ref={ref}
          id={id}
          type={visible ? "text" : "password"}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={`${inputBase} pr-11`}
          style={{ borderColor: error ? RED : LINE, ...style }}
          {...rest}
        />
        <button
          type="button"
          id={toggleId}
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
          aria-pressed={visible}
          className="absolute top-1/2 right-1 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-md text-gray-400 hover:text-gray-600"
        >
          {visible ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
        </button>
      </div>
    </FieldShell>
  );
});

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function SubmitButton({ children, loading }: { children: ReactNode; loading?: boolean }) {
  return (
    <button
      type="submit"
      disabled={loading}
      className="flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-[15px] font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
      style={{ background: "#0F3B82" }}
    >
      {loading ? <Spinner /> : null}
      {children}
    </button>
  );
}

export function ErrorBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-lg border px-3.5 py-2.5 text-sm" style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#B91C1C" }}>
      {message}
    </p>
  );
}

/**
 * Thông báo thành công (vd. "đã kích hoạt tài khoản"). Nền xanh nhạt pha từ token `secondary`, viền trái `secondary`, chữ `ink`
 * (secondary không đạt 4.5:1 làm chữ) + icon check — không chỉ dựa vào màu. `role="status"` (không cướp focus).
 */
export function SuccessBanner({ title, message }: { title: string; message?: string | null }) {
  return (
    <div
      role="status"
      className="flex gap-2.5 rounded-lg border border-l-4 px-3.5 py-3 text-sm leading-relaxed"
      style={{ borderColor: GREEN, background: `color-mix(in srgb, ${GREEN} 10%, white)`, color: INK }}
    >
      <svg viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0" fill="none" stroke={GREEN} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="9" />
        <path d="m8.5 12.5 2.5 2.5 4.5-5" />
      </svg>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {message ? <p className="mt-0.5">{message}</p> : null}
      </div>
    </div>
  );
}

export function InfoBanner({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="status" className="rounded-lg border px-3.5 py-2.5 text-sm" style={{ borderColor: LINE, background: "#F7F9FC", color: INK_SOFT }}>
      {message}
    </p>
  );
}
