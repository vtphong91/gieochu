"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "../../../lib/session";
import { grantSystemAdmin, lockUser, resendVerificationForUser, unlockUser } from "../../../lib/admin-users";

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

export async function resendVerificationAdminAction(userId: string): Promise<void> {
  await requireRole("SYSTEM_ADMIN");
  await resendVerificationForUser(userId);
}

export async function grantSystemAdminAction(userId: string): Promise<void> {
  const actor = await requireRole("SYSTEM_ADMIN");
  await grantSystemAdmin(actor, userId);
  revalidatePath("/admin/users");
}
