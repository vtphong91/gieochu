"use server";

import { revalidatePath } from "next/cache";
import { after } from "next/server";
import { AppError } from "@gieochu/core";
import type { PaymentProviderId } from "@gieochu/payments";
import { requireCheckoutAccess } from "../../../../lib/page-guards";
import { applyCouponToOrder, getOrderForCustomer, initiateOrderCheckout, removeCouponFromOrder } from "../../../../lib/order";
import { cancelOrderByCustomer, declareOrderPaid, undoDeclareOrderPaid } from "../../../../lib/order-customer";

export interface CheckoutActionState {
  error?: string;
  /** Mã lỗi nghiệp vụ (vd `ORDER_DECLARED_PAID`, `PROVIDER_HOLD_EXPIRED`) để UI chọn câu chữ/hành vi. */
  code?: string;
  /** Thành công (ADR-062 §6.2 — UI đọc thông báo). */
  ok?: boolean;
  /** `selectProviderAction`: phương thức vừa áp dụng. */
  provider?: PaymentProviderId;
}

const VALID_PROVIDERS: PaymentProviderId[] = ["MANUAL_QR", "SEPAY", "MOMO", "MOMO_MANUAL"];

function errorState(error: unknown): CheckoutActionState | null {
  return error instanceof AppError ? { error: error.message, code: error.code } : null;
}

export async function applyCouponAction(
  tenantSlug: string,
  orderCode: string,
  _prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState> {
  const user = await requireCheckoutAccess(`/${tenantSlug}/checkout/${orderCode}`);
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
  const user = await requireCheckoutAccess(`/${tenantSlug}/checkout/${orderCode}`);
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
  const user = await requireCheckoutAccess(`/${tenantSlug}/checkout/${orderCode}`);
  const provider = String(formData.get("provider") ?? "") as PaymentProviderId;
  if (!VALID_PROVIDERS.includes(provider)) return { error: "Phương thức thanh toán không hợp lệ." };

  const order = await getOrderForCustomer(user.userId, orderCode);
  try {
    // ADR-059 + ADR-061 Q7/Q10: email người bán (đơn chờ xác nhận tay) + email hướng dẫn cho khách gửi sau response.
    await initiateOrderCheckout(order.tenantId, order.id, user.userId, provider, { scheduleNotification: (task) => after(task) });
  } catch (error) {
    const state = errorState(error);
    if (state) return state;
    throw error;
  }

  revalidatePath(`/${tenantSlug}/checkout/${orderCode}`);
  return { ok: true, provider };
}

// Ba action dưới không đọc form (chữ ký useActionState giữ ở overload — cùng lý do `removeCouponAction`).

/** ADR-062 Q1 — "Tôi đã chuyển khoản" (chỉ cổng xác nhận tay). Email người bán gửi sau response, một lần/đơn. */
export async function declarePaidAction(tenantSlug: string, orderCode: string, prevState: CheckoutActionState, formData: FormData): Promise<CheckoutActionState>;
export async function declarePaidAction(tenantSlug: string, orderCode: string): Promise<CheckoutActionState> {
  const user = await requireCheckoutAccess(`/${tenantSlug}/checkout/${orderCode}`);
  const order = await getOrderForCustomer(user.userId, orderCode);
  try {
    await declareOrderPaid(user.userId, order.id, { scheduleNotification: (task) => after(task), actorId: user.userId });
  } catch (error) {
    const state = errorState(error);
    if (state) return state;
    throw error;
  }
  revalidatePath(`/${tenantSlug}/checkout/${orderCode}`);
  return { ok: true };
}

/** ADR-062 Q1 — "Tôi chưa chuyển khoản" (hoàn tác). */
export async function undoDeclarePaidAction(tenantSlug: string, orderCode: string, prevState: CheckoutActionState, formData: FormData): Promise<CheckoutActionState>;
export async function undoDeclarePaidAction(tenantSlug: string, orderCode: string): Promise<CheckoutActionState> {
  const user = await requireCheckoutAccess(`/${tenantSlug}/checkout/${orderCode}`);
  const order = await getOrderForCustomer(user.userId, orderCode);
  try {
    await undoDeclareOrderPaid(user.userId, order.id, { actorId: user.userId });
  } catch (error) {
    const state = errorState(error);
    if (state) return state;
    throw error;
  }
  revalidatePath(`/${tenantSlug}/checkout/${orderCode}`);
  return { ok: true };
}

/** ADR-062 Q4 — khách tự huỷ đơn đang chờ (UI có hộp xác nhận). */
export async function cancelOrderByCustomerAction(
  tenantSlug: string,
  orderCode: string,
  prevState: CheckoutActionState,
  formData: FormData,
): Promise<CheckoutActionState>;
export async function cancelOrderByCustomerAction(tenantSlug: string, orderCode: string): Promise<CheckoutActionState> {
  const user = await requireCheckoutAccess(`/${tenantSlug}/checkout/${orderCode}`);
  const order = await getOrderForCustomer(user.userId, orderCode);
  try {
    await cancelOrderByCustomer(user.userId, order.id, { actorId: user.userId });
  } catch (error) {
    const state = errorState(error);
    if (state) return state;
    throw error;
  }
  revalidatePath(`/${tenantSlug}/checkout/${orderCode}`);
  revalidatePath("/account/orders");
  return { ok: true };
}
