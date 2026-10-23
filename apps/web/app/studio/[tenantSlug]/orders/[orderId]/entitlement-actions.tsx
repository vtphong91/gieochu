"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { grantExtraDownloadsAction, revokeEntitlementAction, type OrderActionState } from "./actions";

/*
 * Quyền tải của 1 dòng đơn (M9). ADR-046: ô "Số lượt" có nhãn thật, vùng bấm ≥ 44px dưới lg; "Thu hồi quyền tải" hai
 * bước (mở khung xác nhận, focus "Thôi"). Action giữ nguyên.
 */

const INK = brandColors.ink;
const RED = "#B91C1C";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const BTN = `inline-flex min-h-11 cursor-pointer items-center justify-center rounded-lg px-3.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-9 ${FOCUS}`;

const initialState: OrderActionState = {};

export function GrantExtraDownloadsForm({ tenantSlug, orderId, entitlementId }: { tenantSlug: string; orderId: string; entitlementId: string }) {
  const action = grantExtraDownloadsAction.bind(null, tenantSlug, orderId, entitlementId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const inputId = useId();
  const errorId = useId();

  return (
    <form action={formAction} className="flex flex-wrap items-end gap-2">
      <div>
        <label htmlFor={inputId} className="mb-1 block text-xs font-medium" style={{ color: INK }}>
          Cấp thêm lượt tải
        </label>
        <input
          id={inputId}
          type="number"
          name="extra"
          min={1}
          step={1}
          inputMode="numeric"
          required
          placeholder="Số lượt"
          aria-invalid={state.error ? true : undefined}
          aria-describedby={state.error ? errorId : undefined}
          className="min-h-11 w-24 rounded-lg border border-gray-300 bg-white px-3 text-[15px] tabular-nums outline-none focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15 lg:min-h-9 lg:text-sm"
          style={{ color: INK }}
        />
      </div>
      <button type="submit" disabled={isPending} className={`${BTN} border bg-white hover:bg-gray-50`} style={{ color: brandColors.primary, borderColor: "#BFDBFE" }}>
        {isPending ? "Đang cấp..." : "Cấp thêm"}
      </button>
      {state.error ? (
        <p id={errorId} role="alert" className="basis-full text-xs" style={{ color: RED }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function RevokeEntitlementButton({ tenantSlug, orderId, entitlementId }: { tenantSlug: string; orderId: string; entitlementId: string }) {
  const action = revokeEntitlementAction.bind(null, tenantSlug, orderId, entitlementId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  useEffect(() => {
    if (open) cancelRef.current?.focus();
  }, [open]);

  function close() {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => (open ? close() : setOpen(true))}
        disabled={isPending}
        className={`${BTN} border bg-white hover:bg-red-50`}
        style={{ color: RED, borderColor: "#FCA5A5" }}
      >
        Thu hồi quyền tải
      </button>
      {open ? (
        <form
          id={panelId}
          action={formAction}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              close();
            }
          }}
          className="w-full rounded-xl border p-3"
          style={{ borderColor: "#FCA5A5", background: "#FEF2F2" }}
        >
          <p className="text-sm" style={{ color: INK }}>
            Thu hồi quyền tải tài liệu này của khách? Khách không tải được nữa.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <button ref={cancelRef} type="button" onClick={close} className={`${BTN} border border-gray-300 bg-white hover:bg-gray-50`} style={{ color: INK }}>
              Thôi
            </button>
            <button type="submit" disabled={isPending} className={`${BTN} text-white hover:brightness-110`} style={{ background: RED }}>
              {isPending ? "Đang thu hồi..." : "Thu hồi"}
            </button>
          </div>
        </form>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-xs" style={{ color: RED }}>
          {state.error}
        </p>
      ) : null}
    </div>
  );
}
