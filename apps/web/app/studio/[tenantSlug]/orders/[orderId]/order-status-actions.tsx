"use client";

import { useActionState } from "react";
import { cancelOrderAction, markOrderRefundedAction, type OrderActionState } from "./actions";

const initialState: OrderActionState = {};

export function CancelOrderButton({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  const action = cancelOrderAction.bind(null, tenantSlug, orderId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending} className="rounded border px-4 py-2 text-sm text-red-600 disabled:opacity-50">
        {isPending ? "Đang huỷ..." : "Huỷ đơn"}
      </button>
      {state.error ? <p className="mt-1 text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function MarkRefundedButton({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  const action = markOrderRefundedAction.bind(null, tenantSlug, orderId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <button type="submit" disabled={isPending} className="rounded border px-4 py-2 text-sm disabled:opacity-50">
        {isPending ? "Đang xử lý..." : "Đánh dấu đã hoàn tiền"}
      </button>
      {state.error ? <p className="mt-1 text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}
