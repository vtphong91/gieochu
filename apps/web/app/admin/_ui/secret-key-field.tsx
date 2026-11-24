"use client";

import { useEffect, useRef, useState, type ComponentProps } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconEye, IconEyeOff, IconRefresh } from "./icons";
import { CopyValue } from "./copy-value";

const RED = "#DC2626";
const GRAY_LINE = "#E5E7EB";
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";

const inputBase =
  "w-full rounded-lg border bg-white px-3.5 py-2.5 pr-12 text-[15px] outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const KEY_LENGTH = 48;

/**
 * Key ngẫu nhiên 48 ký tự chữ/số (~285 bit) bằng CSPRNG của trình duyệt. Loại byte ≥ 248 (= 62 × 4) để mọi ký tự có
 * xác suất bằng nhau. Chỉ chữ/số → dán vào header `Authorization: Apikey <key>` của SePay không cần escape.
 */
export function generateSecretKey(length = KEY_LENGTH): string {
  let out = "";
  const buf = new Uint8Array(length * 2);
  while (out.length < length) {
    crypto.getRandomValues(buf);
    for (const byte of buf) {
      if (byte >= 248) continue;
      out += ALPHABET[byte % ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

/** Ghi giá trị qua setter gốc + phát `input` bubbling → onChange của React (và `useFormDraft` ở `<form>`) nhận thay đổi. */
function setNativeValue(el: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  setter?.call(el, value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * Ô secret/API key webhook có nút "Tạo key ngẫu nhiên" (SePay platform + tenant). Ô vẫn KHÔNG kiểm soát và vẫn là ô bí
 * mật của `useFormDraft` (không ghi lại sau lưu lỗi); để trống = giữ secret đã lưu. Key sinh ở trình duyệt, gửi lên như
 * khi admin tự gõ — server mã hoá AES-256-GCM, không bao giờ trả lại. Sau khi tạo: hiện key + khung nhắc sao chép trước
 * khi lưu; form reset (sau khi lưu) hoặc sửa tay khác key đã tạo → ẩn khung.
 */
export function SecretKeyField({
  id,
  label,
  hint,
  error,
  onChange,
  ...rest
}: Omit<ComponentProps<"input">, "type" | "defaultValue" | "value"> & { id: string; label: string; hint?: string; error?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [visible, setVisible] = useState(false);
  const [generated, setGenerated] = useState<string | null>(null);
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  useEffect(() => {
    const form = inputRef.current?.form;
    if (!form) return;
    const handleReset = () => {
      setGenerated(null);
      setVisible(false);
    };
    form.addEventListener("reset", handleReset);
    return () => form.removeEventListener("reset", handleReset);
  }, []);

  function generate() {
    const el = inputRef.current;
    if (!el) return;
    const key = generateSecretKey();
    setNativeValue(el, key);
    setGenerated(key);
    setVisible(true);
    el.focus();
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <label htmlFor={id} className="block text-sm font-medium" style={{ color: INK }}>
          {label}
        </label>
        <button
          type="button"
          onClick={generate}
          aria-controls={id}
          className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md px-1.5 text-sm font-medium text-[color:var(--color-primary)] hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]"
        >
          <IconRefresh className="h-4 w-4" />
          Tạo key ngẫu nhiên
        </button>
      </div>
      <div className="relative mt-1.5">
        <input
          ref={inputRef}
          id={id}
          type={visible ? "text" : "password"}
          className={`${inputBase} ${visible ? "font-mono" : ""}`}
          style={{ borderColor: error ? RED : GRAY_LINE }}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          autoComplete="new-password"
          spellCheck={false}
          onChange={(event) => {
            if (generated && event.currentTarget.value !== generated) setGenerated(null);
            onChange?.(event);
          }}
          {...rest}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label="Hiện giá trị"
          aria-pressed={visible}
          aria-controls={id}
          className="absolute inset-y-0 right-0 flex w-11 cursor-pointer items-center justify-center rounded-r-lg text-gray-500 outline-offset-[-3px] hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-[#0F3B82]"
        >
          {visible ? <IconEyeOff className="h-[18px] w-[18px]" /> : <IconEye className="h-[18px] w-[18px]" />}
        </button>
      </div>
      {generated ? (
        <div role="status" className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
          Lưu lại key này (dán vào trang quản trị SePay) rồi mới nhấn lưu cấu hình. Sau khi lưu sẽ không hiển thị lại.
          <CopyValue value={generated} label={label} />
        </div>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** Gợi ý ô API Token SePay (User API) — chỉ dùng cho "Kiểm tra kết nối". */
export const SEPAY_API_TOKEN_HINT =
  "Lấy ở my.sepay.vn → Cấu hình Công ty → API Access. Chỉ dùng để kiểm tra kết nối (xác nhận tài khoản đã liên kết SePay), không ảnh hưởng nhận tiền.";

/** Gợi ý theo kiểu xác thực đang chọn — khớp cách `verifySepayWebhook` kiểm tra (packages/payments/src/providers/sepay.ts). */
export function sepaySecretHint(authType: string): string {
  return authType === "API_KEY"
    ? "SePay gửi header Authorization: Apikey <key>. Ở SePay chọn “API Key” và dán đúng key này."
    : "Dán key này vào ô secret HMAC-SHA256 bên SePay — hai bên phải dùng cùng một secret.";
}
