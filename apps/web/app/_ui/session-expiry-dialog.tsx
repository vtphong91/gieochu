"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent, type SyntheticEvent } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconClock } from "../admin/_ui/icons";

/*
 * ADR-053 — hộp thoại "sắp hết phiên" (mount bởi `SessionRefresh` khi còn `warningSeconds` trước lúc hết idle). Cùng
 * khung `<dialog>` + `showModal()` với `ConfirmDialog` (account/library/_ui): top layer, nền phía sau `inert`, nền mờ navy.
 *
 *  - `role="alertdialog"` + `aria-modal` + `aria-labelledby/-describedby`. Focus vào "Tiếp tục phiên" khi mở, bẫy Tab
 *    vòng, đóng (unmount) thì trả focus về phần tử đang focus trước đó.
 *  - Esc = "Tiếp tục phiên" (nút chính). Bấm nền mờ không làm gì — người dùng phải chọn một trong hai.
 *  - Đồng hồ mm:ss và thanh tiến trình là `aria-hidden` (đổi mỗi giây). Trình đọc màn hình chỉ nghe mô tả lúc mở và
 *    một vùng `role="status"` cập nhật ở mốc 1 phút / 30 giây (chỉ những mốc nhỏ hơn thời gian còn lại lúc mở).
 *  - `data-idle-warning` ở gốc: `SessionRefresh` bỏ qua thao tác bên trong hộp thoại (nút tự xử lý).
 *  - Hiệu ứng mở (fade + scale qua `@starting-style`) tắt khi `prefers-reduced-motion`.
 */

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
const BTN = `inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors aria-disabled:cursor-not-allowed aria-disabled:opacity-60 motion-reduce:transition-none sm:w-auto ${FOCUS}`;
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex="0"]';
/** Mốc báo cho trình đọc màn hình (giây). */
const ANNOUNCE_AT = [60, 30] as const;
/** "Tiếp tục" chưa đóng được hộp thoại (mạng chập chờn) → cho bấm lại sau chừng này. */
const CONTINUE_RETRY_MS = 5_000;

function secondsUntil(deadline: number, now: number): number {
  return Math.max(0, Math.ceil((deadline - now) / 1000));
}

function clock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function spoken(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds} giây`;
  return seconds === 0 ? `${minutes} phút` : `${minutes} phút ${seconds} giây`;
}

export function SessionExpiryDialog({ deadline, onContinue, onLogout }: { deadline: number; onContinue: () => void; onLogout: () => void }) {
  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const continueButtonRef = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());
  // Thời gian còn lại lúc mở — dùng cho câu mô tả (đọc 1 lần) và tỉ lệ thanh tiến trình.
  const [initialSeconds] = useState(() => Math.max(1, secondsUntil(deadline, Date.now())));
  const [continuing, setContinuing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    if (dialog && !dialog.open) dialog.showModal();
    continueButtonRef.current?.focus();
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      clearInterval(id);
      if (dialog?.open) dialog.close();
      if (previous?.isConnected) previous.focus();
    };
  }, []);

  useEffect(() => {
    if (!continuing) return;
    const id = setTimeout(() => setContinuing(false), CONTINUE_RETRY_MS);
    return () => clearTimeout(id);
  }, [continuing]);

  const secondsLeft = secondsUntil(deadline, now);
  const milestone = ANNOUNCE_AT.filter((mark) => mark < initialSeconds && secondsLeft <= mark).at(-1);
  const announcement = milestone === undefined ? "" : `Còn ${spoken(milestone)} trước khi phiên đăng nhập tự kết thúc.`;
  const progress = Math.min(1, secondsLeft / initialSeconds);

  function handleContinue() {
    if (loggingOut) return;
    setContinuing(true);
    onContinue();
  }

  function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    onLogout();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc gốc của <dialog> — không cho trình duyệt tự đóng; xử lý như "Tiếp tục phiên".
    event.preventDefault();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLDialogElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      handleContinue();
      return;
    }
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
    } else if (!event.shiftKey && (active === last || !items.includes(active as HTMLElement))) {
      event.preventDefault();
      first.focus();
    }
  }

  /** Trình duyệt vẫn đóng <dialog> (vd Esc lặp lại trên Chrome) trong khi cảnh báo còn hiệu lực → mở lại. */
  function handleClose() {
    const dialog = dialogRef.current;
    if (dialog && dialog.isConnected && !dialog.open) {
      dialog.showModal();
      continueButtonRef.current?.focus();
    }
  }

  return (
    <dialog
      ref={dialogRef}
      data-idle-warning=""
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onCancel={handleCancel}
      onClose={handleClose}
      onKeyDown={handleKeyDown}
      // Không đặt `flex` trên <dialog> (đè display:none khi đóng) — bố cục nằm ở khung con.
      className="m-auto w-[calc(100%-1.5rem)] max-w-md overflow-hidden rounded-2xl border-0 bg-white p-0 shadow-[0_24px_64px_-16px_rgba(15,23,42,0.45)] transition-[opacity,scale] duration-200 ease-out backdrop:bg-[rgba(18,33,58,0.55)] starting:scale-95 starting:opacity-0 motion-reduce:transition-none"
      style={{ color: brandColors.ink }}
    >
      <div className="flex max-h-[calc(100dvh-1.5rem)] flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pt-6 pb-5 text-center sm:px-6">
          <span aria-hidden="true" className="mx-auto flex h-12 w-12 items-center justify-center rounded-full" style={{ background: brandColors.surface, color: brandColors.primary }}>
            <IconClock className="h-6 w-6" />
          </span>
          <h2 id={titleId} className="mt-3 font-[family-name:var(--font-heading)] text-lg leading-snug font-bold">
            Bạn vẫn đang dùng chứ?
          </h2>
          <p id={descId} className="mt-2 text-sm leading-relaxed" style={{ color: brandColors.inkSoft }}>
            Bạn đã không thao tác một lúc. Để bảo vệ tài khoản, phiên đăng nhập sẽ tự kết thúc sau khoảng {spoken(initialSeconds)}. Chọn
            &ldquo;Tiếp tục phiên&rdquo; để tiếp tục làm việc.
          </p>

          <div aria-hidden="true" className="mt-5">
            <p className="font-[family-name:var(--font-heading)] text-4xl font-bold tabular-nums" style={{ color: brandColors.primary }}>
              {clock(secondsLeft)}
            </p>
            <p className="mt-1 text-xs" style={{ color: brandColors.inkSoft }}>
              {secondsLeft > 0 ? "thời gian còn lại" : "Đang kết thúc phiên…"}
            </p>
            <div className="mx-auto mt-3 h-1.5 w-full max-w-60 overflow-hidden rounded-full" style={{ background: brandColors.surface }}>
              <div
                className="h-full w-full origin-left rounded-full transition-transform duration-1000 ease-linear motion-reduce:transition-none"
                style={{ background: brandColors.primary, transform: `scaleX(${progress})` }}
              />
            </div>
          </div>

          {/* Chỉ cập nhật ở mốc 1 phút / 30 giây — không đọc mỗi giây. */}
          <p role="status" aria-atomic="true" className="sr-only">
            {announcement}
          </p>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t px-5 py-3 sm:flex-row sm:justify-end sm:px-6" style={{ borderColor: brandColors.line }}>
          <button
            type="button"
            onClick={handleLogout}
            aria-disabled={loggingOut || undefined}
            className={`${BTN} border bg-white hover:bg-gray-50`}
            style={{ borderColor: brandColors.line, color: brandColors.ink }}
          >
            {loggingOut ? "Đang đăng xuất…" : "Đăng xuất"}
          </button>
          <button
            ref={continueButtonRef}
            type="button"
            onClick={handleContinue}
            aria-disabled={loggingOut || undefined}
            className={`${BTN} text-white hover:brightness-110`}
            style={{ background: brandColors.primary }}
          >
            {continuing ? "Đang gia hạn phiên…" : "Tiếp tục phiên"}
          </button>
        </div>
      </div>
    </dialog>
  );
}
