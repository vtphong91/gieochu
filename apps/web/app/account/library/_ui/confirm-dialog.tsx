"use client";

import { useEffect, useId, useRef, type KeyboardEvent, type MouseEvent, type ReactNode, type RefObject, type SyntheticEvent } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle, IconClose } from "../../../admin/_ui/icons";

/*
 * ADR-039 — hộp thoại xác nhận của Thư viện (chọn tải lần cuối / yêu cầu hoàn tiền / tải lần cuối). Cùng pattern
 * `<dialog>` của `[tenantSlug]/_ui/report-abuse.tsx`: mở bằng `showModal()` (top layer, nền phía sau `inert`),
 * `aria-modal` + `aria-labelledby/-describedby`, focus vào tiêu đề khi mở, bẫy Tab vòng, Esc / nút Đóng / bấm nền mờ
 * để đóng (đang xử lý thì không đóng), trả focus về nút đã mở. Điều khiển bằng prop `open` (component cha giữ state).
 */

export const LIBRARY_FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
/** Nút bo tròn ≥44px (mobile), gọn lại từ lg. */
export const LIBRARY_BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${LIBRARY_FOCUS}`;
/** Màu đỏ lỗi đạt 6.5:1 trên nền trắng (cùng giá trị `report-abuse.tsx`). */
export const LIBRARY_ERROR_RED = "#B91C1C";

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([tabindex="-1"]), textarea:not([disabled]), select:not([disabled]), [tabindex="0"]';

export interface ConfirmDialogProps {
  open: boolean;
  /** Gọi khi người dùng đóng (Esc, nút Đóng/Huỷ, bấm nền) — cha đặt `open = false`. */
  onClose: () => void;
  /** Đang xử lý: khoá đóng hộp thoại và nút Huỷ. */
  busy?: boolean;
  title: string;
  /** Nội dung chính (cảnh báo, hệ quả của lựa chọn). Đoạn đầu được dùng làm mô tả hộp thoại. */
  description: ReactNode;
  children?: ReactNode;
  /** Lỗi từ server — hiện trong hộp thoại (role="alert"). */
  error?: ReactNode;
  /** Nút xác nhận (có thể là `<form action>` + nút submit). */
  confirm: ReactNode;
  cancelLabel?: string;
  /** Nút đã mở hộp thoại — nhận lại focus khi đóng. */
  returnFocusRef: RefObject<HTMLElement | null>;
}

export function ConfirmDialog({ open, onClose, busy = false, title, description, children, error, confirm, cancelLabel = "Huỷ", returnFocusRef }: ConfirmDialogProps) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      dialog.showModal();
      // Focus tiêu đề: trình đọc màn hình đọc tên + mô tả hộp thoại trước khi tới các nút.
      titleRef.current?.focus();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function requestClose() {
    if (busy) return;
    onClose();
  }

  /** Sự kiện `close` gốc (Esc đã qua `cancel`, hoặc `dialog.close()` khi `open` về false) — trả focus về nút mở. */
  function handleClosed() {
    if (open) onClose();
    returnFocusRef.current?.focus();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc: luôn để React điều khiển việc đóng qua prop `open`.
    event.preventDefault();
    requestClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) requestClose();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key !== "Tab") return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const items = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE)).filter((el) => el.getClientRects().length > 0);
    if (items.length === 0) return;
    const first = items[0]!;
    const last = items[items.length - 1]!;
    const active = document.activeElement;
    if (event.shiftKey && (active === first || !items.includes(active as HTMLElement))) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={handleClosed}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      onKeyDown={handleKeyDown}
      // Không đặt `flex` trên <dialog> (đè display:none khi đóng) — bố cục nằm ở khung con.
      className="m-auto w-[calc(100%-1.5rem)] max-w-lg overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] backdrop:bg-[rgba(18,33,58,0.55)]"
      style={{ color: brandColors.ink }}
    >
      {open ? (
        <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
          <header className="flex items-start gap-3 border-b px-5 pt-4 pb-3 sm:px-6" style={{ borderColor: brandColors.line }}>
            <span aria-hidden="true" className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full" style={{ background: brandColors.accentSoft, color: "#92400E" }}>
              <IconAlertTriangle className="h-[18px] w-[18px]" />
            </span>
            <h2 ref={titleRef} id={titleId} tabIndex={-1} className="min-w-0 flex-1 pt-1 font-[family-name:var(--font-heading)] text-lg leading-snug font-bold outline-none">
              {title}
            </h2>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              aria-label="Đóng hộp thoại"
              className={`-mt-1 -mr-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none ${LIBRARY_FOCUS}`}
              style={{ color: brandColors.inkSoft }}
            >
              <IconClose className="h-5 w-5" />
            </button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4 text-sm leading-relaxed sm:px-6">
            <div id={descId}>{description}</div>
            {children}
            {error ? (
              <div role="alert" className="rounded-xl border px-3.5 py-2.5" style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: LIBRARY_ERROR_RED }}>
                {error}
              </div>
            ) : null}
          </div>

          <footer className="flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end sm:px-6" style={{ borderColor: brandColors.line }}>
            <button
              type="button"
              onClick={requestClose}
              disabled={busy}
              className={`${LIBRARY_BTN} border bg-white hover:bg-gray-50`}
              style={{ borderColor: brandColors.line, color: brandColors.ink }}
            >
              {cancelLabel}
            </button>
            {confirm}
          </footer>
        </div>
      ) : null}
    </dialog>
  );
}
