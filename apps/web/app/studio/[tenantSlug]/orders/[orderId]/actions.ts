"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../../lib/tenant";
import { cancelOrder, confirmOrderManually, markOrderRefunded } from "../../../../../lib/order";
import { grantExtraDownloads, revokeEntitlement } from "../../../../../lib/entitlement";

export interface OrderActionState {
  error?: string;
}

export async function confirmOrderManuallyAction(
  tenantSlug: string,
  orderId: string,
  _prevState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  const note = String(formData.get("note") ?? "");

  try {
    await confirmOrderManually(tenant.id, orderId, note, user.userId);
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
  const { tenant, user } = await requireTenantMember(tenantSlug);
  try {
    await markOrderRefunded(tenant.id, orderId, user.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  revalidatePath(`/studio/${tenantSlug}/orders`);
  return {};
}

/** §"M9": "Tenant có thể cấp thêm lượt ... của một khách". */
export async function grantExtraDownloadsAction(
  tenantSlug: string,
  orderId: string,
  entitlementId: string,
  _prevState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  const extra = Number(formData.get("extra") ?? 0);
  if (!Number.isInteger(extra) || extra <= 0) return { error: "Số lượt cấp thêm phải là số nguyên dương." };

  try {
    await grantExtraDownloads(tenant.id, entitlementId, extra, user.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  return {};
}

/** §"M9": "... hoặc thu hồi entitlement của một khách". */
export async function revokeEntitlementAction(tenantSlug: string, orderId: string, entitlementId: string): Promise<OrderActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  try {
    await revokeEntitlement(tenant.id, entitlementId, user.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  return {};
}
