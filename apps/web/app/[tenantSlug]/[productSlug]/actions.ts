"use server";

import { redirect } from "next/navigation";
import { AppError, productPath } from "@gieochu/core";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { createOrder } from "../../../lib/order";

export interface BuyActionState {
  error?: string;
}

/** §"M8" "Mua ngay": gated the same way `/studio/*` and `/account/*` are — not logged in -> /login, unverified -> /verify-email. */
export async function buyProductAction(tenantSlug: string, productId: string, productSlug: string): Promise<BuyActionState> {
  const user = await requireVerifiedAccess(productPath(tenantSlug, productSlug));

  let order;
  try {
    order = await createOrder(user.userId, tenantSlug, productId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  redirect(`/${tenantSlug}/checkout/${order.code}`);
}
