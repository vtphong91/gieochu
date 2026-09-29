"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { logger, systemSettingsSchema } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { requireRole } from "../../../lib/session";

const settingsSchema = z.object({
  platformName: z.string().trim().min(1),
  supportEmail: z.string().trim().email(),
  // ADR-032: cùng giới hạn với /admin/settings/general (packages/core) — không để form cũ ghi vượt khoảng.
  trialDays: systemSettingsSchema.shape.trialDays,
  graceDays: systemSettingsSchema.shape.graceDays,
});

export interface SettingsActionState {
  error?: string;
  success?: boolean;
}

export async function updateSystemSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };
  }

  const prisma = getPrismaClient();
  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: { ...parsed.data, updatedById: actor.userId },
    create: { id: "default", ...parsed.data, updatedById: actor.userId },
  });
  logger.info(
    { actorId: actor.userId, trialDays: parsed.data.trialDays, graceDays: parsed.data.graceDays },
    "system_settings: cập nhật thông tin nền tảng / dùng thử / ân hạn (/admin/settings)",
  );

  revalidatePath("/admin/settings");
  return { success: true };
}
