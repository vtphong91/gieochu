import { getPrismaClient } from "@gieochu/db";

export interface SystemRoleCounts {
  user: number;
  systemAdmin: number;
  superAdmin: number;
}

/** L1 aggregate only (users.systemRole/isSuperAdmin) — safe for System Admin per §7.9. */
export async function getSystemRoleCounts(): Promise<SystemRoleCounts> {
  const prisma = getPrismaClient();
  const [user, systemAdmin, superAdmin] = await Promise.all([
    prisma.user.count({ where: { systemRole: "USER" } }),
    prisma.user.count({ where: { systemRole: "SYSTEM_ADMIN" } }),
    prisma.user.count({ where: { isSuperAdmin: true } }),
  ]);
  return { user, systemAdmin, superAdmin };
}

/**
 * `Tenant.ownerId` is unique — 1 tenant has exactly 1 OWNER membership, so the
 * tenant count *is* the OWNER count. Deliberately does NOT query
 * `tenant_members` directly: that table is L2/RLS-protected (scope "tenant"),
 * and System Admin has no `withTenant()` context to read it across tenants —
 * by design, not an oversight (§7.9).
 */
export async function getTenantOwnerCount(): Promise<number> {
  const prisma = getPrismaClient();
  return prisma.tenant.count();
}
