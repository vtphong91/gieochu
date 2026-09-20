"use client";

import { useActionState } from "react";
import { confirmOrderManuallyAction, type OrderActionState } from "./actions";
import { FormBanner, PrimaryButton } from "../../../../admin/_ui/kit";

const initialState: OrderActionState = {};

/** §"M8": "bắt buộc nhập ghi chú" — the note is required server-side too (defense in depth). */
export function ConfirmForm({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  const action = confirmOrderManuallyAction.bind(null, tenantSlug, orderId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-3">
      <textarea
        name="note"
        required
        placeholder="Ghi chú xác nhận (ví dụ: đã đối chiếu sao kê ngân hàng lúc 10:30)"
        rows={2}
        className="w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
        style={{ borderColor: "#E5E7EB" }}
      />
      <FormBanner ok={false} message={state.error} />
      <PrimaryButton loading={isPending}>{isPending ? "Đang xác nhận..." : "Xác nhận đã thanh toán"}</PrimaryButton>
    </form>
  );
}
