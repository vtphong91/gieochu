"use client";

import { useActionState } from "react";
import { buyProductAction, type BuyActionState } from "./actions";

const initialState: BuyActionState = {};

export function BuyButton({
  tenantSlug,
  productId,
  productSlug,
}: {
  tenantSlug: string;
  productId: string;
  productSlug: string;
}) {
  const action = buyProductAction.bind(null, tenantSlug, productId, productSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      {state.error ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center rounded-full bg-[color:var(--color-primary)] px-8 text-[15px] font-bold text-white shadow-[0_12px_26px_-12px_var(--color-primary)] transition-[filter] duration-200 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] motion-reduce:transition-none disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:brightness-100"
      >
        {isPending ? "Đang xử lý..." : "Mua ngay"}
      </button>
    </form>
  );
}
