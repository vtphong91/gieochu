"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../lib/session";
import { lockTenant, TENANT_LOCK_ERROR_CODES, TENANT_LOCK_REASON_MAX_LENGTH, unlockTenant } from "../../../lib/tenant-lock";

export interface TenantLockState {
  error?: string;
  reasonError?: string;
  success?: boolean;
  emailSent?: boolean;
}

const REASON_ERROR = `Hãy nhập lý do (tối đa ${TENANT_LOCK_REASON_MAX_LENGTH} ký tự).`;

/** Danh sách + trang chi tiết gian hàng (route động → mẫu + `"page"`, Next 16 `revalidatePath`). */
function revalidateTenantPages(): void {
  revalidatePath("/admin/tenants");
  revalidatePath("/admin/tenants/[tenantId]", "page");
}

function toState(error: unknown): TenantLockState {
  if (error instanceof AppError) {
    if (error.code === TENANT_LOCK_ERROR_CODES.REASON_INVALID) return { reasonError: REASON_ERROR };
    return { error: error.message };
  }
  throw error;
}

/** ADR-072 — khoá gian hàng từ hộp xác nhận (lý do bắt buộc, gửi cho chủ gian hàng). Trạng thái kiểm lại ở server. */
export async function lockTenantAction(tenantId: string, _prev: TenantLockState, formData: FormData): Promise<TenantLockState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  let emailSent: boolean;
  try {
    ({ emailSent } = await lockTenant(actor, tenantId, formData.get("reason")));
  } catch (error) {
    return toState(error);
  }
  revalidateTenantPages();
  return { success: true, emailSent };
}

/** ADR-072 — mở khoá gian hàng (luôn về ACTIVE) từ hộp xác nhận, lý do bắt buộc (gửi cho chủ gian hàng). */
export async function unlockTenantAction(tenantId: string, _prev: TenantLockState, formData: FormData): Promise<TenantLockState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  let emailSent: boolean;
  try {
    ({ emailSent } = await unlockTenant(actor, tenantId, formData.get("reason")));
  } catch (error) {
    return toState(error);
  }
  revalidateTenantPages();
  return { success: true, emailSent };
}
