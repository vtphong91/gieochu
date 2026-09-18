"use client";

import { useActionState } from "react";
import { removeProductFileAction, type ProductActionState } from "../actions";

const initialState: ProductActionState = {};

export function RemoveFileButton({ tenantSlug, productId, fileId }: { tenantSlug: string; productId: string; fileId: string }) {
  const action = removeProductFileAction.bind(null, tenantSlug, productId, fileId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="inline">
      <button type="submit" disabled={isPending} className="text-xs text-red-600 underline disabled:opacity-50">
        {isPending ? "Đang ẩn..." : "Ẩn"}
      </button>
      {state.error ? <p className="text-xs text-red-600">{state.error}</p> : null}
    </form>
  );
}
