import { buildAdminDashboardSummary, type AdminDashboardSummary } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";

type CountRow = { status: string; _count: { _all: number } };

function toRecord(rows: CountRow[]): Record<string, number> {
  return Object.fromEntries(rows.map((row) => [row.status, row._count._all]));
}

/**
 * §"M2" dashboard: only ever reads aggregate counts from L1 tables
 * (users/tenants/subscriptions) — never orders/order_items/tenant_customers,
 * which system admin has no route to at all (§4.2, §7.9).
 */
export async function getAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const prisma = getPrismaClient();
  const [usersByStatus, tenantsByStatus, subscriptionsByStatus, freeSubscriptions, paidSubscriptions] = await Promise.all([
    prisma.user.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.tenant.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.subscription.groupBy({ by: ["status"], _count: { _all: true } }),
    prisma.subscription.count({ where: { plan: { isFree: true } } }),
    prisma.subscription.count({ where: { plan: { isFree: false } } }),
  ]);

  return buildAdminDashboardSummary({
    usersByStatus: { PENDING: 0, ACTIVE: 0, LOCKED: 0, ...toRecord(usersByStatus) },
    tenantsByStatus: { ACTIVE: 0, READ_ONLY: 0, LOCKED: 0, ...toRecord(tenantsByStatus) },
    subscriptionsByStatus: toRecord(subscriptionsByStatus),
    subscriptionsByPlanType: { free: freeSubscriptions, paid: paidSubscriptions },
  });
}
