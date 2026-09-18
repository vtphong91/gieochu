"use client";

import { useActionState } from "react";
import { buyProductAction, type BuyActionState } from "./actions";

const initialState: BuyActionState = {};

export function BuyButton({
  tenantSlug,
  productId,
  productSlug,
  loggedIn,
}: {
  tenantSlug: string;
  productId: string;
  productSlug: string;
  loggedIn: boolean;
}) {
  const action = buyProductAction.bind(null, tenantSlug, productId, productSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      {state.error ? <p className="mb-2 text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-[var(--color-primary)] px-6 py-2 font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Đang xử lý..." : loggedIn ? "Mua ngay" : "Đăng nhập để mua"}
      </button>
    </form>
  );
}
