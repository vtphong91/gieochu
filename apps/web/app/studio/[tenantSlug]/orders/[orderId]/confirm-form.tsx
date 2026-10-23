"use client";

import { useActionState } from "react";
import { confirmOrderManuallyAction, type OrderActionState } from "./actions";
import { brandColors } from "@gieochu/config/theme";
import { FormBanner, PrimaryButton } from "../../../../admin/_ui/kit";

const initialState: OrderActionState = {};

/** §"M8": "bắt buộc nhập ghi chú" — the note is required server-side too (defense in depth). */
export function ConfirmForm({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  const action = confirmOrderManuallyAction.bind(null, tenantSlug, orderId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label htmlFor={`confirm-note-${orderId}`} className="block text-sm font-medium" style={{ color: brandColors.ink }}>
          Ghi chú xác nhận <span aria-hidden="true">*</span>
          <span className="sr-only"> (bắt buộc)</span>
        </label>
        <textarea
          id={`confirm-note-${orderId}`}
          name="note"
          required
          placeholder="Ví dụ: đã đối chiếu sao kê ngân hàng lúc 10:30"
          rows={3}
          className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[var(--brand-primary,#0F3B82)] focus:ring-2 focus:ring-[var(--brand-primary,#0F3B82)]/15 lg:text-sm"
          style={{ borderColor: "#D1D5DB" }}
        />
      </div>
      <FormBanner ok={false} message={state.error} />
      <div className="[&>button]:w-full">
        <PrimaryButton loading={isPending}>{isPending ? "Đang xác nhận..." : "Xác nhận đã thanh toán"}</PrimaryButton>
      </div>
    </form>
  );
}
