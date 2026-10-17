"use client";

import { useEffect, useRef, type RefObject } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle, IconCheckCircle } from "../../admin/_ui/icons";

/** State chung của action `/account/*` (cùng hình dạng `AccountActionState` — `lib/account-state.ts`). */
export type AccountFormState =
  | ({ ok: true; message: string } & object)
  | { ok: false; code: string; formError?: string; fieldErrors?: Record<string, string>; values?: Record<string, string> }
  | null;

const GREEN_FG = "#15803D";
const RED = "#B91C1C";

/**
 * Banner kết quả thao tác — thành công `role="status"`, lỗi chung `role="alert"`; chữ + icon (không chỉ màu).
 * `tabIndex=-1` để `useResultFocus` chuyển focus tới sau khi gửi form.
 */
export function ResultBanner({ state, bannerRef, fallbackError }: { state: AccountFormState; bannerRef?: RefObject<HTMLDivElement | null>; fallbackError?: string }) {
  if (!state) return null;
  const message = state.ok ? state.message : (state.formError ?? (state.fieldErrors ? null : fallbackError ?? null));
  if (!message) return null;
  const ok = state.ok;
  return (
    <div
      ref={bannerRef}
      tabIndex={-1}
      role={ok ? "status" : "alert"}
      className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm outline-offset-2 focus-visible:outline-2"
      style={
        ok
          ? { background: "#F0FDF4", borderColor: "#BBF7D0", color: GREEN_FG, outlineColor: brandColors.primary }
          : { background: "#FEF2F2", borderColor: "#FCA5A5", color: RED, outlineColor: brandColors.primary }
      }
    >
      {ok ? <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" /> : <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
      <span className="min-w-0 [overflow-wrap:anywhere]">{message}</span>
    </div>
  );
}

/**
 * Sau mỗi lần action trả state mới: có banner → focus banner; lỗi chỉ theo ô → focus ô lỗi đầu tiên
 * (`[aria-invalid="true"]` trong form) — skill `focus-management`. Không chạy ở lần render đầu.
 */
export function useResultFocus(state: AccountFormState, formRef: RefObject<HTMLElement | null>, bannerRef: RefObject<HTMLElement | null>) {
  const previous = useRef(state);
  useEffect(() => {
    if (state === previous.current) return;
    previous.current = state;
    if (!state) return;
    if (bannerRef.current) {
      bannerRef.current.focus();
      return;
    }
    if (!state.ok) formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [state, formRef, bannerRef]);
}
