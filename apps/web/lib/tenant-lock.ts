import { getPrismaClient, type Tx } from "@gieochu/db";
import { audit } from "./audit";

/**
 * Khoá / mở khoá tenant (System Admin) — dùng chung cho /admin/tenants và xử lý báo cáo vi phạm (ADR-038 mục 5).
 * `tenants` không bật RLS (ADR-023 mục 2) nên ghi được bằng client thường hoặc trong transaction có sẵn (withSystemJob).
 * Audit luôn ghi SAU khi nghiệp vụ commit (xem lib/audit.ts).
 */

/** Đặt LOCKED trong transaction của caller. Trả trạng thái trước đó; null nếu tenant không tồn tại. */
export async function lockTenantInTx(tx: Tx, tenantId: string): Promise<{ previousStatus: string } | null> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
  if (!tenant) return null;
  if (tenant.status !== "LOCKED") {
    await tx.tenant.update({ where: { id: tenantId }, data: { status: "LOCKED" } });
  }
  return { previousStatus: tenant.status };
}

export async function auditTenantLocked(actorId: string, tenantId: string, metadata?: Record<string, unknown>): Promise<void> {
  await audit.log({ actorId, scope: "SYSTEM", tenantId, action: "TENANT_LOCKED", targetType: "Tenant", targetId: tenantId, metadata });
}

export async function lockTenant(actorId: string, tenantId: string): Promise<void> {
  const tenant = await getPrismaClient().tenant.update({ where: { id: tenantId }, data: { status: "LOCKED" } });
  await auditTenantLocked(actorId, tenant.id);
}

export async function unlockTenant(actorId: string, tenantId: string): Promise<void> {
  const tenant = await getPrismaClient().tenant.update({ where: { id: tenantId }, data: { status: "ACTIVE" } });
  await audit.log({ actorId, scope: "SYSTEM", tenantId: tenant.id, action: "TENANT_UNLOCKED", targetType: "Tenant", targetId: tenant.id });
}
