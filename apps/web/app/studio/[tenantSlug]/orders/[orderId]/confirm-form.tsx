"use client";

import { useActionState } from "react";
import { confirmOrderManuallyAction, type OrderActionState } from "./actions";

const initialState: OrderActionState = {};

/** §"M8": "bắt buộc nhập ghi chú" — the note is required server-side too (defense in depth). */
export function ConfirmForm({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  const action = confirmOrderManuallyAction.bind(null, tenantSlug, orderId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="space-y-2">
      <textarea
        name="note"
        required
        placeholder="Ghi chú xác nhận (ví dụ: đã đối chiếu sao kê ngân hàng lúc 10:30)"
        className="w-full rounded border px-3 py-2 text-sm"
        rows={2}
      />
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Đang xác nhận..." : "Xác nhận đã thanh toán"}
      </button>
    </form>
  );
}
