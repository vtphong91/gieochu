"use client";

import { useActionState } from "react";
import { confirmManualInvoiceAction, type ConfirmInvoiceActionState } from "./actions";

const initialState: ConfirmInvoiceActionState = {};

export function ConfirmButton({ invoiceId }: { invoiceId: string }) {
  const action = confirmManualInvoiceAction.bind(null, invoiceId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={isPending} className="rounded bg-[var(--color-primary)] px-3 py-1 text-xs text-white disabled:opacity-50">
        {isPending ? "Đang xác nhận..." : "Xác nhận đã nhận tiền"}
      </button>
      {state.error ? <p className="mt-1 text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
