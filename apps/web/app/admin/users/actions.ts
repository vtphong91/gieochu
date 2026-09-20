"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../lib/session";
import { lockUser, resendVerificationForUser, unlockUser } from "../../../lib/admin-users";

export async function lockUserAction(userId: string): Promise<void> {
  const actor = await requireRole("SYSTEM_ADMIN");
  await lockUser(actor, userId);
  revalidatePath("/admin/users");
}

export async function unlockUserAction(userId: string): Promise<void> {
  await requireRole("SYSTEM_ADMIN");
  await unlockUser(userId);
  revalidatePath("/admin/users");
}

export interface ResendVerificationActionState {
  error?: string;
  success?: boolean;
}

export async function resendVerificationAdminAction(userId: string): Promise<ResendVerificationActionState> {
  await requireRole("SYSTEM_ADMIN");
  try {
    await resendVerificationForUser(userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  return { success: true };
}
