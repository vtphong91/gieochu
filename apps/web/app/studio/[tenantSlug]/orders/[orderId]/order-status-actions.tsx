"use client";

import { useActionState } from "react";
import { cancelOrderAction, markOrderRefundedAction, type OrderActionState } from "./actions";
import { GhostButton } from "../../../../admin/_ui/kit";

const initialState: OrderActionState = {};

export function CancelOrderButton({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  const action = cancelOrderAction.bind(null, tenantSlug, orderId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <GhostButton type="submit" disabled={isPending} style={{ color: "#DC2626", borderColor: "#FCA5A5" }}>
        {isPending ? "Đang huỷ..." : "Huỷ đơn"}
      </GhostButton>
      {state.error ? (
        <p className="mt-1 text-sm" style={{ color: "#DC2626" }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}

export function MarkRefundedButton({ tenantSlug, orderId }: { tenantSlug: string; orderId: string }) {
  const action = markOrderRefundedAction.bind(null, tenantSlug, orderId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <GhostButton type="submit" disabled={isPending}>
        {isPending ? "Đang xử lý..." : "Đánh dấu đã hoàn tiền"}
      </GhostButton>
      {state.error ? (
        <p className="mt-1 text-sm" style={{ color: "#DC2626" }}>
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
