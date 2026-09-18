"use server";

import { revalidatePath } from "next/cache";
import { getPrismaClient } from "@gieochu/db";
import { requireRole } from "../../../lib/session";

export async function lockTenantAction(tenantId: string): Promise<void> {
  await requireRole("SYSTEM_ADMIN");
  const prisma = getPrismaClient();
  await prisma.tenant.update({ where: { id: tenantId }, data: { status: "LOCKED" } });
  revalidatePath("/admin/tenants");
}

export async function unlockTenantAction(tenantId: string): Promise<void> {
  await requireRole("SYSTEM_ADMIN");
  const prisma = getPrismaClient();
  await prisma.tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } });
  revalidatePath("/admin/tenants");
}
