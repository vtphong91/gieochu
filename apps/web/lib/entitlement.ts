import { notFound } from "@gieochu/core";
import { withTenant } from "@gieochu/db";

/** §"M9": "Tenant có thể cấp thêm lượt ... của một khách" — raises downloadLimit by `extra` (snapshot value, not the product's current limit). */
export async function grantExtraDownloads(tenantId: string, entitlementId: string, extra: number): Promise<void> {
  const entitlement = await withTenant(tenantId, (tx) => tx.entitlement.findUnique({ where: { id: entitlementId } }));
  if (!entitlement || entitlement.tenantId !== tenantId) throw notFound("Không tìm thấy quyền tải.");

  await withTenant(tenantId, (tx) =>
    tx.entitlement.update({ where: { id: entitlementId }, data: { downloadLimit: { increment: extra } } }),
  );
}

/** §"M9": "... hoặc thu hồi entitlement của một khách" — the customer's downloads stop working immediately (canDownloadEntitlement/RLS both gate on revokedAt). */
export async function revokeEntitlement(tenantId: string, entitlementId: string): Promise<void> {
  const entitlement = await withTenant(tenantId, (tx) => tx.entitlement.findUnique({ where: { id: entitlementId } }));
  if (!entitlement || entitlement.tenantId !== tenantId) throw notFound("Không tìm thấy quyền tải.");

  await withTenant(tenantId, (tx) => tx.entitlement.update({ where: { id: entitlementId }, data: { revokedAt: new Date() } }));
}
