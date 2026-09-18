"use client";

import { useActionState } from "react";
import {
  archiveProductAction,
  publishProductAction,
  restoreProductAction,
  unpublishProductAction,
  type ProductActionState,
} from "../actions";

const initialState: ProductActionState = {};

function ActionButton({
  label,
  action,
  variant = "primary",
}: {
  label: string;
  action: () => Promise<ProductActionState>;
  variant?: "primary" | "secondary";
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  return (
    <form action={formAction} className="inline-block">
      <button
        type="submit"
        disabled={isPending}
        className={
          variant === "primary"
            ? "rounded bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
            : "rounded border px-4 py-2 text-sm disabled:opacity-50"
        }
      >
        {isPending ? "Đang xử lý..." : label}
      </button>
      {state.error ? <p className="mt-1 text-sm text-red-600">{state.error}</p> : null}
    </form>
  );
}

export function ProductStatusActions({
  tenantSlug,
  productId,
  status,
}: {
  tenantSlug: string;
  productId: string;
  status: string;
}) {
  if (status === "DRAFT") {
    return (
      <div className="flex flex-wrap gap-3">
        <ActionButton label="Xuất bản" action={publishProductAction.bind(null, tenantSlug, productId)} />
        <ActionButton
          label="Lưu trữ"
          action={archiveProductAction.bind(null, tenantSlug, productId)}
          variant="secondary"
        />
      </div>
    );
  }
  if (status === "PUBLISHED") {
    return (
      <div className="flex flex-wrap gap-3">
        <ActionButton
          label="Gỡ xuống (về nháp)"
          action={unpublishProductAction.bind(null, tenantSlug, productId)}
          variant="secondary"
        />
        <ActionButton
          label="Lưu trữ"
          action={archiveProductAction.bind(null, tenantSlug, productId)}
          variant="secondary"
        />
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-3">
      <ActionButton label="Khôi phục (về nháp)" action={restoreProductAction.bind(null, tenantSlug, productId)} />
    </div>
  );
}
