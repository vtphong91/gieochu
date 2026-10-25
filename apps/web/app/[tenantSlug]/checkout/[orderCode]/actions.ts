"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import type { PaymentProviderId } from "@gieochu/payments";
import { requireVerifiedAccess } from "../../../../lib/page-guards";
import { applyCouponToOrder, getOrderForCustomer, initiateOrderCheckout, removeCouponFromOrder } from "../../../../lib/order";

export interface CheckoutActionState {
  error?: string;
}

const VALID_PROVIDERS: PaymentProviderId[] = ["MANUAL_QR", "SEPAY", "MOMO"];

export async function applyCouponAction(
  tenantSlug: string,
  orderCode: string,
  _prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const user = await requireVerifiedAccess(`/${tenantSlug}/checkout/${orderCode}`);
  const couponCode = String(formData.get("couponCode") ?? "").trim();
  if (!couponCode) return { error: "Vui lòng nhập mã giảm giá." };

  const order = await getOrderForCustomer(user.userId, orderCode);
  try {
    await applyCouponToOrder(order.tenantId, order.id, user.userId, couponCode);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/${tenantSlug}/checkout/${orderCode}`);
  return {};
}

// Chữ ký useActionState (prevState, formData) cho coupon-panel; cả hai không dùng — eslint của apps/web không có
// argsIgnorePattern cho `_` nên khai báo ở overload, phần thân bỏ bớt tham số (TS cho phép danh sách ngắn hơn).
export async function removeCouponAction(
  tenantSlug: string,
  orderCode: string,
  prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState>;
export async function removeCouponAction(tenantSlug: string, orderCode: string): Promise<CheckoutActionState> {
  const user = await requireVerifiedAccess(`/${tenantSlug}/checkout/${orderCode}`);
  const order = await getOrderForCustomer(user.userId, orderCode);
  try {
    // ADR-056 bổ sung: ORDER_CHANGED / CHECKOUT_CREATE_FAILED / PROVIDER_NOT_AVAILABLE / ORDER_NOT_PENDING → hiện cho khách.
    await removeCouponFromOrder(order.tenantId, order.id, user.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/${tenantSlug}/checkout/${orderCode}`);
  return {};
}

export async function selectProviderAction(
  tenantSlug: string,
  orderCode: string,
  _prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const user = await requireVerifiedAccess(`/${tenantSlug}/checkout/${orderCode}`);
  const provider = String(formData.get("provider") ?? "") as PaymentProviderId;
  if (!VALID_PROVIDERS.includes(provider)) return { error: "Phương thức thanh toán không hợp lệ." };

  const order = await getOrderForCustomer(user.userId, orderCode);
  try {
    await initiateOrderCheckout(order.tenantId, order.id, user.userId, provider);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/${tenantSlug}/checkout/${orderCode}`);
  return {};
}
