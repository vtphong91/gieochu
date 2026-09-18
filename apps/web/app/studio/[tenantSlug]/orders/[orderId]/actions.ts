"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../../lib/tenant";
import { cancelOrder, confirmOrderManually, markOrderRefunded } from "../../../../../lib/order";

export interface OrderActionState {
  error?: string;
}

export async function confirmOrderManuallyAction(
  tenantSlug: string,
  orderId: string,
  _prevState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  const note = String(formData.get("note") ?? "");

  try {
    await confirmOrderManually(tenant.id, orderId, note);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  revalidatePath(`/studio/${tenantSlug}/orders`);
  return {};
}

export async function cancelOrderAction(tenantSlug: string, orderId: string): Promise<OrderActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  try {
    await cancelOrder(tenant.id, orderId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  revalidatePath(`/studio/${tenantSlug}/orders`);
  return {};
}

export async function markOrderRefundedAction(tenantSlug: string, orderId: string): Promise<OrderActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  try {
    await markOrderRefunded(tenant.id, orderId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  revalidatePath(`/studio/${tenantSlug}/orders`);
  return {};
}
