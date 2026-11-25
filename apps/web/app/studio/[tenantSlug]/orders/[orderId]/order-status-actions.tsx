"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { markOrderRefundedAction, type OrderActionState } from "./actions";

/*
 * Thao tác "Đánh dấu đã hoàn tiền" — ADR-046: hai bước (huỷ / xác nhận / mở lại đã chuyển sang hộp "Đổi trạng thái…" — ADR-068,
 * `../_ui/order-status-dialog.tsx`). Bấm nút → mở khung xác nhận ngay dưới
 * (progressive disclosure, không `window.confirm`), focus vào nút "Thôi"; "Thôi"/Esc đóng và trả focus về nút ban đầu.
 * Action giữ nguyên (`./actions.ts` tự kiểm quyền + revalidate).
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BTN = `inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg px-4 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-10 ${FOCUS}`;

const initialState: OrderActionState = {};

function TwoStepAction({
  action,
  label,
  pendingLabel,
  confirmText,
  confirmLabel,
  danger,
}: {
  action: () => Promise<OrderActionState>;
  label: string;
  pendingLabel: string;
  confirmText: string;
  confirmLabel: string;
  danger?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
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

  const accent = danger ? RED : brandColors.primary;

  return (
    <div>
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        disabled={isPending}
        className={`${BTN} border bg-white hover:bg-gray-50`}
        style={{ color: danger ? RED : INK, borderColor: danger ? "#FCA5A5" : "#D1D5DB" }}
      >
        {label}
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
          className="mt-2 rounded-xl border p-3.5"
          style={{ borderColor: danger ? "#FCA5A5" : "#BFDBFE", background: danger ? "#FEF2F2" : brandColors.surface }}
        >
          <p id={textId} className="text-sm leading-relaxed" style={{ color: INK }}>
            {confirmText}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button ref={cancelRef} type="button" onClick={close} className={`${BTN} border border-gray-300 bg-white hover:bg-gray-50`} style={{ color: INK }}>
              Thôi
            </button>
            <button type="submit" disabled={isPending} className={`${BTN} text-white hover:brightness-110`} style={{ background: accent }}>
              {isPending ? pendingLabel : confirmLabel}
            </button>
          </div>
        </form>
      ) : null}
      {state.error ? (
        <p role="alert" className="mt-2 text-sm" style={{ color: RED }}>
          {state.error}
        </p>
      ) : null}
    </div>
  );
}

export function MarkRefundedButton({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  return (
    <div>
      <TwoStepAction
        action={markOrderRefundedAction.bind(null, tenantSlug, orderId)}
        label="Đánh dấu đã hoàn tiền"
        pendingLabel="Đang xử lý..."
        confirmText="Chỉ bấm khi bạn đã chuyển trả tiền cho khách qua kênh đã nhận thanh toán. Quyền tải của khách sẽ bị thu hồi."
        confirmLabel="Đã hoàn tiền"
      />
      <p className="mt-1.5 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
        Hệ thống không tự chuyển tiền — bạn hoàn tiền trực tiếp cho khách rồi ghi nhận tại đây.
      </p>
    </div>
  );
}
