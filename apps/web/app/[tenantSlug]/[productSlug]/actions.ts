"use server";

import { redirect } from "next/navigation";
import { AppError, productPath } from "@gieochu/core";
import { requireCheckoutAccess } from "../../../lib/page-guards";
import { getCurrentUser } from "../../../lib/session";
import { createOrder } from "../../../lib/order";

export interface BuyActionState {
  error?: string;
}

/**
 * §"M8" "Mua ngay". ADR-061 Q1 / ADR-062 Q2: chưa đăng nhập → trang thanh toán khách vãng lai `/{tenant}/checkout?tai-lieu={slug}`
 * (đơn chỉ tạo khi khách điền form). Đã đăng nhập: đã xác minh HOẶC phiên khách vãng lai (`requireCheckoutAccess`) → tạo đơn.
 */
export async function buyProductAction(tenantSlug: string, productId: string, productSlug: string): Promise<BuyActionState> {
  if (!(await getCurrentUser())) {
    redirect(`/${tenantSlug}/checkout?tai-lieu=${encodeURIComponent(productSlug)}`);
  }
  const user = await requireCheckoutAccess(productPath(tenantSlug, productSlug));

  let order;
  try {
    order = await createOrder(user.userId, tenantSlug, productId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  redirect(`/${tenantSlug}/checkout/${order.code}`);
}
