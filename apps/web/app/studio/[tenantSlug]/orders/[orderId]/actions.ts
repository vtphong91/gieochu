"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../../lib/tenant";
import { changeOrderStatusBySeller, markOrderRefunded } from "../../../../../lib/order";
import { grantExtraDownloads, revokeEntitlement } from "../../../../../lib/entitlement";
import { addOrderNote, deleteOrderNote } from "../../../../../lib/order-note";

export interface OrderActionState {
  error?: string;
}

export interface ChangeOrderStatusState {
  error?: string;
  success?: boolean;
}

const orderStatusTargetSchema = z.enum(["PAID", "PENDING", "CANCELLED"]);

/**
 * ADR-068 — "Đổi trạng thái…" đơn hàng: Đã thanh toán / Chưa thanh toán (mở lại) / Huỷ. `tenantId` lấy từ guard, không từ form;
 * trạng thái hiện tại và điều kiện chuyển kiểm lại ở server. Ghi chú không bắt buộc (ghi chú nội bộ + `confirmNote` khi xác nhận).
 */
export async function changeOrderStatusAction(
  tenantSlug: string,
  orderId: string,
  _prevState: ChangeOrderStatusState,
  formData: FormData,
): Promise<ChangeOrderStatusState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  const target = orderStatusTargetSchema.safeParse(formData.get("target"));
  if (!target.success) return { error: "Vui lòng chọn trạng thái hợp lệ." };
  const note = formData.get("note");

  try {
    await changeOrderStatusBySeller(tenant.id, orderId, target.data, typeof note === "string" ? note : null, user.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }

  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  revalidatePath(`/studio/${tenantSlug}/orders`);
  return { success: true };
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

/**
 * ADR-047: thêm ghi chú nội bộ (OWNER). Trường form `body` (trim, 1–1000 ký tự). Lỗi nghiệp vụ trả `{ error }`:
 * VALIDATION_ERROR, 404 không có đơn, ORDER_NOTES_UNAVAILABLE (migration chưa áp).
 */
export async function addOrderNoteAction(
  tenantSlug: string,
  orderId: string,
  _prevState: OrderActionState,
  formData: FormData,
): Promise<OrderActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  try {
    await addOrderNote(tenant.id, orderId, user.userId, formData.get("body"));
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  return {};
}

/** ADR-047: xoá ghi chú nội bộ — chỉ tác giả (403 ORDER_NOTE_FORBIDDEN / 404 ORDER_NOTE_NOT_FOUND trả `{ error }`). */
export async function deleteOrderNoteAction(tenantSlug: string, orderId: string, noteId: string): Promise<OrderActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  try {
    await deleteOrderNote(tenant.id, orderId, noteId, user.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/orders/${orderId}`);
  return {};
}
