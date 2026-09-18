"use client";

import { useTransition } from "react";
import { revokeShareLinkAction } from "./actions";

export function RevokeButton({ tenantSlug, productId, shareLinkId }: { tenantSlug: string; productId: string; shareLinkId: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={isPending}
      onClick={() => startTransition(() => revokeShareLinkAction(tenantSlug, productId, shareLinkId))}
      className="text-xs text-red-600 underline disabled:opacity-50"
    >
      {isPending ? "Đang thu hồi..." : "Thu hồi"}
    </button>
  );
}
