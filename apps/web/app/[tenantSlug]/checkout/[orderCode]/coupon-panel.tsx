"use client";

import { useActionState } from "react";
import { applyCouponAction, removeCouponAction, type CheckoutActionState } from "./actions";

const initialState: CheckoutActionState = {};

export function CouponPanel({ tenantSlug, orderCode, appliedCode }: { tenantSlug: string; orderCode: string; appliedCode: string | null }) {
  const applyAction = applyCouponAction.bind(null, tenantSlug, orderCode);
  const [state, formAction, isPending] = useActionState(applyAction, initialState);
  const removeAction = removeCouponAction.bind(null, tenantSlug, orderCode);

  if (appliedCode) {
    return (
      <form action={removeAction} className="flex items-center justify-between text-sm">
        <span>
          Mã giảm giá: <strong>{appliedCode}</strong>
        </span>
        <button type="submit" className="text-red-600 underline">
          Bỏ mã
        </button>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex items-start gap-2">
      <div className="flex-1">
        <input
          type="text"
          name="couponCode"
          placeholder="Nhập mã giảm giá"
          className="w-full rounded border px-3 py-2 text-sm uppercase"
        />
        {state.error ? <p className="mt-1 text-sm text-red-600">{state.error}</p> : null}
      </div>
      <button type="submit" disabled={isPending} className="rounded border px-4 py-2 text-sm disabled:opacity-50">
        {isPending ? "Đang áp..." : "Áp dụng"}
      </button>
    </form>
  );
}
