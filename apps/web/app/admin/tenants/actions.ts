"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "../../../lib/session";
import { lockTenant, unlockTenant } from "../../../lib/tenant-lock";

export async function lockTenantAction(tenantId: string): Promise<void> {
  const actor = await requireRole("SYSTEM_ADMIN");
  await lockTenant(actor.userId, tenantId);
  revalidatePath("/admin/tenants");
}

export async function unlockTenantAction(tenantId: string): Promise<void> {
  const actor = await requireRole("SYSTEM_ADMIN");
  await unlockTenant(actor.userId, tenantId);
  revalidatePath("/admin/tenants");
}
