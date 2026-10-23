"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { MenuItemButton, MenuItemLink, RowMenu } from "../../../../admin/_ui/row-menu";
import { IconNote, IconReceipt } from "../../../../admin/_ui/icons";
import { CUSTOMER_NOTE_MAX_LENGTH } from "@gieochu/core/customer-list";
import type { CustomerNoteAction, CustomerNoteState } from "./customer-format";

/*
 * ADR-048 mục 3–4 — menu "Thao tác" của 1 khách: "Xem đơn của khách" (link trang Đơn hàng lọc theo khách) và "Ghi chú…"
 * (hộp sửa ghi chú `tenant_customers.note`). Hộp nằm NGOÀI menu (menu tự đóng khi bấm): `<dialog>` + `showModal()` — bẫy
 * focus, Esc đóng, focus vào ô nhập, đóng xong trả focus về nút mở menu (cùng pattern `OrderRowActions`, ADR-046).
 * Action do trang truyền xuống (đã bind `tenantSlug`), ở đây bind thêm `userId`; lưu xong không lỗi → đóng hộp.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-10 ${FOCUS}`;

const initialState: CustomerNoteState = {};
const noNoteAction = async (prev: CustomerNoteState): Promise<CustomerNoteState> => prev;

export function CustomerRowActions({
  userId,
  displayName,
  note,
  ordersHref,
  noteAction,
}: {
  userId: string;
  /** Họ tên hoặc email — cho nhãn nút và tiêu đề hộp. */
  displayName: string;
  note: string | null;
  ordersHref: string;
  /** Bỏ trống → ẩn mục "Ghi chú" (chưa có Server Action). */
  noteAction?: CustomerNoteAction;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(note ?? "");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const [state, formAction, isPending] = useActionState(noteAction ? noteAction.bind(null, userId) : noNoteAction, initialState);
  const lastState = useRef(state);
  // Lỗi của lần mở trước không hiện lại khi mở hộp lần sau.
  const [stateAtOpen, setStateAtOpen] = useState<CustomerNoteState | null>(null);
  const error = state !== stateAtOpen ? state.error : undefined;
  const ids = useId();
  const titleId = `${ids}-title`;
  const hintId = `${ids}-hint`;
  const countId = `${ids}-count`;
  const errorId = `${ids}-error`;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  // Action trả state mới mỗi lần chạy xong: không lỗi → đóng hộp (trang đã revalidate, ghi chú mới hiện dưới tên).
  useEffect(() => {
    if (state === lastState.current) return;
    lastState.current = state;
    if (!state.error) dialogRef.current?.close();
  }, [state]);

  function openDialog() {
    setDraft(note ?? "");
    setStateAtOpen(state);
    setOpen(true);
  }

  function onClose() {
    setOpen(false);
    wrapRef.current?.querySelector<HTMLButtonElement>("button[aria-haspopup]")?.focus();
  }

  const remaining = CUSTOMER_NOTE_MAX_LENGTH - draft.length;

  return (
    <div ref={wrapRef} className="inline-flex">
      <RowMenu label={`Thao tác khách ${displayName}`} size="touch">
        <MenuItemLink href={ordersHref} icon={<IconReceipt />}>
          Xem đơn của khách
        </MenuItemLink>
        {noteAction ? (
          <MenuItemButton type="button" icon={<IconNote />} onClick={openDialog}>
            {note ? "Sửa ghi chú…" : "Thêm ghi chú…"}
          </MenuItemButton>
        ) : null}
      </RowMenu>

      {open ? (
        <dialog
          ref={dialogRef}
          aria-labelledby={titleId}
          onClose={onClose}
          className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0 text-left shadow-xl backdrop:bg-[rgba(18,33,58,0.45)]"
        >
          <form action={formAction} className="p-5 sm:p-6">
            <h2 id={titleId} className="font-[family-name:var(--font-heading)] text-lg font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
              Ghi chú về {displayName}
            </h2>
            <label htmlFor={`${ids}-note`} className="mt-4 mb-1.5 block text-sm font-medium" style={{ color: INK }}>
              Ghi chú
            </label>
            <textarea
              id={`${ids}-note`}
              name="note"
              rows={5}
              autoFocus
              maxLength={CUSTOMER_NOTE_MAX_LENGTH}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              aria-describedby={`${hintId} ${countId}${error ? ` ${errorId}` : ""}`}
              aria-invalid={error ? true : undefined}
              className="block w-full resize-y rounded-lg border border-gray-300 bg-white px-3 py-2 text-[15px] leading-relaxed outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15 lg:text-sm"
              style={{ color: INK }}
            />
            <div className="mt-1.5 flex flex-wrap items-start justify-between gap-x-3 gap-y-1 text-xs" style={{ color: INK_SOFT }}>
              <p id={hintId}>Chỉ gian hàng thấy — khách không đọc được. Để trống rồi Lưu để xoá ghi chú.</p>
              <p id={countId} className="tabular-nums" style={remaining <= 20 ? { color: "#92400E" } : undefined}>
                {draft.length}/{CUSTOMER_NOTE_MAX_LENGTH} ký tự
              </p>
            </div>
            {error ? (
              <p id={errorId} role="alert" className="mt-3 text-sm" style={{ color: RED }}>
                {error}
              </p>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => dialogRef.current?.close()}
                className={`${BTN} border border-gray-300 bg-white hover:bg-gray-50`}
                style={{ color: INK }}
              >
                Huỷ
              </button>
              <button type="submit" disabled={isPending} className={`${BTN} text-white hover:brightness-110`} style={{ background: brandColors.primary }}>
                {isPending ? "Đang lưu..." : "Lưu ghi chú"}
              </button>
            </div>
          </form>
        </dialog>
      ) : null}
    </div>
  );
}
