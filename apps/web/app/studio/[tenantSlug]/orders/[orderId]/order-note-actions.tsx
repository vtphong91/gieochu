"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { addOrderNoteAction, deleteOrderNoteAction, type OrderActionState } from "./actions";
import { ORDER_NOTE_MAX_LENGTH_UI } from "../_ui/order-format";

/*
 * ADR-047 — ghi chú nội bộ trên đơn (chỉ gian hàng thấy). Form thêm: nhãn thật, đếm ký tự, Ctrl/⌘+Enter để gửi,
 * thành công → xoá ô + focus lại ô + báo "Đã thêm" (role=status). Xoá: chỉ tác giả (`canDelete` do server tính), hai
 * bước như các thao tác đơn khác (mở khung xác nhận, focus "Thôi", Esc đóng). Action tự kiểm quyền + revalidate.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-10 ${FOCUS}`;

type NoteFormState = OrderActionState & { ok?: boolean };
const initialState: NoteFormState = {};

export function AddOrderNoteForm({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputId = useId();
  const hintId = useId();
  const countId = useId();
  const errorId = useId();

  const [state, formAction, isPending] = useActionState(async (_prev: NoteFormState, formData: FormData): Promise<NoteFormState> => {
    const result = await addOrderNoteAction(tenantSlug, orderId, {}, formData);
    if (result.error) return { error: result.error };
    setValue("");
    return { ok: true };
  }, initialState);

  // Sau khi gửi xong (thành công hoặc lỗi) đưa focus về ô để viết tiếp / sửa.
  useEffect(() => {
    if (state !== initialState) textareaRef.current?.focus();
  }, [state]);

  const length = value.length;
  const nearLimit = length >= ORDER_NOTE_MAX_LENGTH_UI * 0.9;
  const describedBy = [hintId, countId, state.error ? errorId : null].filter(Boolean).join(" ");

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor={inputId} className="block text-sm font-medium" style={{ color: INK }}>
          Nội dung ghi chú
        </label>
        <p id={hintId} className="mt-0.5 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
          Chỉ gian hàng thấy — khách không bao giờ thấy.
        </p>
        <textarea
          ref={textareaRef}
          id={inputId}
          name="body"
          required
          rows={3}
          maxLength={ORDER_NOTE_MAX_LENGTH_UI}
          value={value}
          readOnly={isPending}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && !isPending) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          placeholder="Ví dụ: khách gọi hỏi hoá đơn, đã hẹn gửi lại trong ngày"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={describedBy}
          className="mt-1.5 w-full resize-y rounded-lg border bg-white px-3.5 py-2.5 text-[15px] leading-relaxed outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15 lg:text-sm"
          style={{ borderColor: state.error ? "#FCA5A5" : "#D1D5DB", color: INK }}
        />
        <p id={countId} className="mt-1 text-right text-xs tabular-nums" style={{ color: nearLimit ? "#92400E" : INK_SOFT }}>
          <span className="sr-only">Đã nhập </span>
          {length.toLocaleString("vi-VN")}/{ORDER_NOTE_MAX_LENGTH_UI.toLocaleString("vi-VN")}
          <span className="sr-only"> ký tự</span>
        </p>
      </div>
      {state.error ? (
        <p id={errorId} role="alert" className="text-sm" style={{ color: RED }}>
          {state.error}
        </p>
      ) : null}
      <p role="status" className="sr-only">
        {state.ok && !isPending ? "Đã thêm ghi chú." : ""}
      </p>
      <button type="submit" disabled={isPending} className={`${BTN} w-full text-white hover:brightness-110`} style={{ background: brandColors.primary }}>
        {isPending ? "Đang thêm..." : "Thêm ghi chú"}
      </button>
    </form>
  );
}

export function DeleteOrderNoteButton({
  tenantSlug,
  orderId,
  noteId,
  timeText,
}: {
  tenantSlug: string;
  orderId: string;
  noteId: string;
  /** Giờ VN của ghi chú — ghép vào tên đọc được của nút ("Xoá ghi chú lúc …"). */
  timeText: string;
}) {
  const action = deleteOrderNoteAction.bind(null, tenantSlug, orderId, noteId);
  const [state, formAction, isPending] = useActionState(action, {} as OrderActionState);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const textId = useId();

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className="mt-1.5">
      <button
        ref={triggerRef}
        type="button"
        aria-label={`Xoá ghi chú lúc ${timeText}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        disabled={isPending}
        className={`-ml-2 inline-flex min-h-11 cursor-pointer items-center rounded-lg px-2 text-xs font-semibold underline-offset-2 transition hover:bg-red-50 hover:underline disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-8 ${FOCUS}`}
        style={{ color: RED }}
      >
        Xoá
      </button>
      {open ? (
        <form
          id={panelId}
          action={formAction}
          aria-describedby={textId}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
          className="mt-1 rounded-xl border p-3"
          style={{ borderColor: "#FCA5A5", background: "#FEF2F2" }}
        >
          <p id={textId} className="text-sm leading-relaxed" style={{ color: INK }}>
            Xoá ghi chú lúc {timeText}? Thao tác không hoàn tác được.
          </p>
          <div className="mt-2.5 grid grid-cols-2 gap-2">
            <button ref={cancelRef} type="button" onClick={close} className={`${BTN} border border-gray-300 bg-white hover:bg-gray-50`} style={{ color: INK }}>
              Thôi
            </button>
            <button type="submit" disabled={isPending} className={`${BTN} text-white hover:brightness-110`} style={{ background: RED }}>
              {isPending ? "Đang xoá..." : "Xoá ghi chú"}
            </button>
          </div>
        </form>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
