"use client";

import { useActionState } from "react";
import { grantExtraDownloadsAction, revokeEntitlementAction, type OrderActionState } from "./actions";

const initialState: OrderActionState = {};

export function GrantExtraDownloadsForm({ tenantSlug, orderId, entitlementId }: { tenantSlug: string; orderId: string; entitlementId: string }) {
  const action = grantExtraDownloadsAction.bind(null, tenantSlug, orderId, entitlementId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="number" name="extra" min={1} placeholder="Số lượt" className="w-20 rounded border px-2 py-1 text-xs" />
      <button type="submit" disabled={isPending} className="text-xs text-[var(--color-primary)] underline disabled:opacity-50">
        {isPending ? "Đang cấp..." : "Cấp thêm lượt"}
      </button>
      {state.error ? <span className="text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}

export function RevokeEntitlementButton({ tenantSlug, orderId, entitlementId }: { tenantSlug: string; orderId: string; entitlementId: string }) {
  const action = revokeEntitlementAction.bind(null, tenantSlug, orderId, entitlementId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={isPending} className="text-xs text-red-600 underline disabled:opacity-50">
        {isPending ? "Đang thu hồi..." : "Thu hồi quyền tải"}
      </button>
      {state.error ? <span className="ml-2 text-xs text-red-600">{state.error}</span> : null}
    </form>
  );
}
