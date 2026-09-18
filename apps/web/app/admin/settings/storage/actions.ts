"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import { saveSystemStorageConfig, testSystemStorageConnection } from "../../../../lib/system-storage";

export interface StorageActionState {
  error?: string;
  success?: boolean;
  testResult?: { ok: boolean; message?: string };
}

const storageSchema = z.object({
  endpoint: z.string().trim().url(),
  region: z.string().trim().min(1),
  bucketPrivate: z.string().trim().min(1),
  bucketPublic: z.string().trim().min(1),
  publicBaseUrl: z.string().trim().optional(),
});

export async function saveStorageConfigAction(_prevState: StorageActionState, formData: FormData): Promise<StorageActionState> {
  await requireRole("SYSTEM_ADMIN");
  const parsed = storageSchema.safeParse({
    endpoint: formData.get("endpoint"),
    region: formData.get("region"),
    bucketPrivate: formData.get("bucketPrivate"),
    bucketPublic: formData.get("bucketPublic"),
    publicBaseUrl: formData.get("publicBaseUrl") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ." };

  const accessKeyId = String(formData.get("accessKeyId") ?? "").trim();
  const secretAccessKey = String(formData.get("secretAccessKey") ?? "").trim();

  try {
    await saveSystemStorageConfig({
      isEnabled: formData.get("isEnabled") === "on",
      publicConfig: parsed.data,
      secrets: { accessKeyId, secretAccessKey },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidatePath("/admin/settings/storage");
  return { success: true };
}

export async function testStorageConnectionAction(): Promise<StorageActionState> {
  await requireRole("SYSTEM_ADMIN");
  const result = await testSystemStorageConnection();
  revalidatePath("/admin/settings/storage");
  return { testResult: result };
}
