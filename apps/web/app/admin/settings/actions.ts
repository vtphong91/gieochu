"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getPrismaClient } from "@gieochu/db";
import { requireRole } from "../../../lib/session";

const settingsSchema = z.object({
  platformName: z.string().trim().min(1),
  supportEmail: z.string().trim().email(),
  trialDays: z.coerce.number().int().positive(),
  graceDays: z.coerce.number().int().positive(),
});

export interface SettingsActionState {
  error?: string;
  success?: boolean;
}

export async function updateSystemSettingsAction(
  _prevState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  await requireRole("SYSTEM_ADMIN");

  const parsed = settingsSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { error: "Dữ liệu không hợp lệ." };
  }

  const prisma = getPrismaClient();
  await prisma.systemSettings.upsert({
    where: { id: "default" },
    update: parsed.data,
    create: { id: "default", ...parsed.data },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}
