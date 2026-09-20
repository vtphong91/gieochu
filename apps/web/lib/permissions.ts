import type { SystemRole } from "@gieochu/auth";
import type { TenantMemberRole } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";

// ADR-022 — Role/Permission (packages/db schema) là nguồn sự thật cho "tier
// này được làm gì". SystemRole/TenantMemberRole vẫn là nhãn định danh (không
// đổi thành FK) — 2 hàm dưới đây map nhãn đó sang `Role.code` đã seed rồi
// tra `role_permissions`. Đọc thẳng qua getPrismaClient() (L1, không tenantId,
// không qua RLS) — đúng cách apps/web/lib/tenant.ts đang đọc `Tenant`.

const SYSTEM_ROLE_CODE: Record<SystemRole, string | null> = {
  SYSTEM_ADMIN: "SYSTEM_ADMIN",
  USER: null,
};

const TENANT_ROLE_CODE: Record<TenantMemberRole, string> = {
  OWNER: "TENANT_OWNER",
  STAFF: "TENANT_STAFF",
};

export async function hasSystemPermission(role: SystemRole, code: string): Promise<boolean> {
  const roleCode = SYSTEM_ROLE_CODE[role];
  if (!roleCode) return false;
  return hasPermission(roleCode, code);
}

export async function hasTenantPermission(role: TenantMemberRole, code: string): Promise<boolean> {
  return hasPermission(TENANT_ROLE_CODE[role], code);
}

async function hasPermission(roleCode: string, permissionCode: string): Promise<boolean> {
  const match = await getPrismaClient().role.findFirst({
    where: { code: roleCode, permissions: { some: { permission: { code: permissionCode } } } },
    select: { id: true },
  });
  return match !== null;
}
