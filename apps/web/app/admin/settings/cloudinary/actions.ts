"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { saveSystemCloudinaryConfig, testSystemCloudinaryConnection } from "../../../../lib/system-cloudinary";

export interface CloudinaryActionState {
  error?: string;
  success?: boolean;
  testResult?: { ok: boolean; message?: string };
}

const cloudinarySchema = z.object({
  cloudName: z.string().trim().min(1),
  uploadFolder: z.string().trim().min(1),
});

export async function saveCloudinaryConfigAction(_prevState: CloudinaryActionState, formData: FormData): Promise<CloudinaryActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = cloudinarySchema.safeParse({
    cloudName: formData.get("cloudName"),
    uploadFolder: formData.get("uploadFolder"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const apiKey = String(formData.get("apiKey") ?? "").trim();
  const apiSecret = String(formData.get("apiSecret") ?? "").trim();

  try {
    await saveSystemCloudinaryConfig({
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: parsed.data,
      secrets: { apiKey, apiSecret },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/settings/cloudinary");
  return { success: true };
}

export async function testCloudinaryConnectionAction(): Promise<CloudinaryActionState> {
  await requireRole("SYSTEM_ADMIN");
  const result = await testSystemCloudinaryConnection();
  revalidatePath("/admin/settings/cloudinary");
  return { testResult: result };
}
