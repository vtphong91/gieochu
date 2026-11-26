import { canManageTenant, forbidden, notFound, type TenantMemberRole } from "@gieochu/core";
import { getPrismaClient, withTenant, type Tenant } from "@gieochu/db";
import { assertActiveSession, requireUser, type CurrentUser } from "./session";

export interface TenantContext {
  user: CurrentUser;
  tenant: Tenant;
  role: TenantMemberRole;
}

/**
 * §4.3: `requireTenantMember(slug, OWNER)` — every /studio/[tenantSlug]/*
 * server component/action calls this itself (proxy.ts does not gate it).
 * The membership lookup goes through withTenant so RLS on tenant_members
 * actually lets a legitimate member's own row through (a plain unscoped
 * query would be filtered to nothing by RLS even for the real owner).
 */
export async function requireTenantMember(slug: string, requiredRole: TenantMemberRole = "OWNER"): Promise<TenantContext> {
  const user = await requireUser();
  const prisma = getPrismaClient();

  const tenant = await prisma.tenant.findUnique({ where: { slug } });
  if (!tenant) throw notFound("Không tìm thấy trang.");

  const member = await withTenant(tenant.id, (tx) =>
    tx.tenantMember.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.userId } } }),
  );

  if (!member || (requiredRole === "OWNER" && !canManageTenant(member.role))) {
    throw forbidden("Bạn không có quyền truy cập trang này.");
  }
  // ADR-073 mục 9: Studio — tài khoản bị khoá / phiên đã thu hồi bị chặn ngay dù access token còn hạn.
  await assertActiveSession(user);

  return { user, tenant, role: member.role };
}
