"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { requireRole } from "../../../lib/session";
import { audit } from "../../../lib/audit";

/**
 * Form `/admin/settings` — chỉ còn email hỗ trợ (ADR-032). Tên nền tảng lấy từ Nhận diện thương hiệu
 * (/admin/settings/branding); dùng thử/ân hạn và các thời hạn khác ở /admin/settings/general.
 */
const supportEmailSchema = z.object({
  supportEmail: z.string().trim().email("Email hỗ trợ không hợp lệ."),
});

export interface SettingsActionState {
  error?: string;
  success?: boolean;
}

export async function updateSupportEmailAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");

  const parsed = supportEmailSchema.safeParse({ supportEmail: formData.get("supportEmail") ?? "" });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const prisma = getPrismaClient();
  const data = { supportEmail: parsed.data.supportEmail, updatedById: actor.userId };
  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: data,
    create: { id: "default", ...data },
  });
  logger.info({ actorId: actor.userId }, "system_settings: cập nhật email hỗ trợ (/admin/settings)");
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    action: "SYSTEM_SETTINGS_UPDATED",
    targetType: "SystemSettings",
    targetId: "default",
    metadata: { form: "supportEmail", changedKeys: ["supportEmail"] },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
