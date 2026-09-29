"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "../../../../lib/session";
import { saveSystemSettings, systemSettingsErrorState, type SystemSettingsActionState } from "../../../../lib/system-settings";

/**
 * ADR-032 — lưu cấu hình hệ thống (11 khoá, xem `SYSTEM_SETTINGS_BOUNDS`). Dùng với `useActionState`:
 * `(prevState, formData) => Promise<SystemSettingsActionState>`. Tên field trong FormData = tên khoá.
 * Chỉ SYSTEM_ADMIN; lỗi quyền/validate trả về state (không ném ra error boundary).
 */
export async function updateSystemSettingsAction(
  _prevState: SystemSettingsActionState,
  formData: FormData,
): Promise<SystemSettingsActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const result = await saveSystemSettings(actor, formData);
    if (result.ok) {
      revalidatePath("/admin/settings/general");
      revalidatePath("/admin/settings");
    }
    return result;
  } catch (error) {
    return systemSettingsErrorState(error);
  }
}
