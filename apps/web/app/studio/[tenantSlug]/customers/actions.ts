"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireTenantMember } from "../../../../lib/tenant";
import { updateCustomerNote } from "../../../../lib/customer-list";

export interface CustomerNoteState {
  ok?: boolean;
  error?: string;
}

/**
 * ADR-048 mục 4: lưu ghi chú khách (OWNER). Trường form `note` (NFC, trim, ≤ 500 ký tự; rỗng = xoá ghi chú). Lỗi nghiệp vụ
 * trả `{ error }`: VALIDATION_ERROR (quá dài), 404 (khách không thuộc gian hàng). Trang bind `tenantSlug` rồi truyền xuống
 * UI dạng `(userId, prev, formData)`.
 */
export async function saveCustomerNoteAction(
  tenantSlug: string,
  userId: string,
  _prevState: CustomerNoteState,
  formData: FormData,
): Promise<CustomerNoteState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  try {
    await updateCustomerNote(tenant.id, userId, formData.get("note"), user.userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath(`/studio/${tenantSlug}/customers`);
  return { ok: true };
}
