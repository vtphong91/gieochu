"use client";

import { useActionState } from "react";
import {
  archiveProductAction,
  publishProductAction,
  restoreProductAction,
  unpublishProductAction,
  type ProductActionState,
} from "../actions";
import { GhostButton, PrimaryButton } from "../../../../admin/_ui/kit";

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
      {variant === "primary" ? (
        <PrimaryButton loading={isPending}>{isPending ? "Đang xử lý..." : label}</PrimaryButton>
      ) : (
        <GhostButton type="submit" disabled={isPending}>
          {isPending ? "Đang xử lý..." : label}
        </GhostButton>
      )}
      {state.error ? (
        <p className="mt-1 text-sm" style={{ color: "#DC2626" }}>
          {state.error}
        </p>
      ) : null}
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
