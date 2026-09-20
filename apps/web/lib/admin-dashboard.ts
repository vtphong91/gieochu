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

export interface RecentTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: Date;
  planName: string;
  planIsFree: boolean;
}

/** §7.9: tenant name/slug/status/plan only — never its orders or customers. */
export async function getRecentTenants(limit = 6): Promise<RecentTenant[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
      subscription: { select: { plan: { select: { name: true, isFree: true } } } },
    },
  });
  return rows.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    createdAt: t.createdAt,
    planName: t.subscription?.plan.name ?? "—",
    planIsFree: t.subscription?.plan.isFree ?? true,
  }));
}

export interface RecentPlatformPayment {
  id: string;
  code: string;
  tenantName: string;
  planName: string;
  amountVnd: number;
  paidAt: Date;
}

/**
 * §7.9: Platform Billing revenue events (tenant paying Gieo Chữ for its own
 * subscription) — this is L1 (subscription_invoices), the opposite direction
 * from tenant order/customer data admin may never read.
 */
export async function getRecentPlatformPayments(limit = 6): Promise<RecentPlatformPayment[]> {
  const prisma = getPrismaClient();
  const rows = await prisma.subscriptionInvoice.findMany({
    where: { status: "PAID" },
    orderBy: { paidAt: "desc" },
    take: limit,
    select: {
      id: true,
      code: true,
      amountVnd: true,
      paidAt: true,
      tenant: { select: { name: true } },
      plan: { select: { name: true } },
    },
  });
  return rows.map((r) => ({
    id: r.id,
    code: r.code,
    tenantName: r.tenant.name,
    planName: r.plan.name,
    amountVnd: r.amountVnd,
    paidAt: r.paidAt!,
  }));
}

export interface MonthlyRevenuePoint {
  label: string;
  totalVnd: number;
}

/** Platform subscription revenue (not tenant GMV) bucketed by calendar month, oldest first. */
export async function getMonthlyPlatformRevenue(monthsBack = 6): Promise<MonthlyRevenuePoint[]> {
  const prisma = getPrismaClient();
  const since = new Date();
  since.setDate(1);
  since.setHours(0, 0, 0, 0);
  since.setMonth(since.getMonth() - (monthsBack - 1));

  const invoices = await prisma.subscriptionInvoice.findMany({
    where: { status: "PAID", paidAt: { gte: since } },
    select: { amountVnd: true, paidAt: true },
  });

  const buckets: { key: string; date: Date; totalVnd: number }[] = [];
  for (let i = 0; i < monthsBack; i += 1) {
    const d = new Date(since);
    d.setMonth(d.getMonth() + i);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, date: d, totalVnd: 0 });
  }
  const byKey = new Map(buckets.map((b) => [b.key, b]));
  for (const inv of invoices) {
    if (!inv.paidAt) continue;
    const key = `${inv.paidAt.getFullYear()}-${inv.paidAt.getMonth()}`;
    const bucket = byKey.get(key);
    if (bucket) bucket.totalVnd += inv.amountVnd;
  }

  return buckets.map((b) => ({ label: b.date.toLocaleDateString("vi-VN", { month: "short" }), totalVnd: b.totalVnd }));
}

export interface PlanDistributionRow {
  planName: string;
  isFree: boolean;
  count: number;
}

/** Active subscriptions grouped by plan — plan names/counts only, no tenant identity. */
export async function getPlanDistribution(): Promise<PlanDistributionRow[]> {
  const prisma = getPrismaClient();
  const plans = await prisma.plan.findMany({ where: { isActive: true }, orderBy: { priceVnd: "asc" }, select: { id: true, name: true, isFree: true } });
  const counts = await prisma.subscription.groupBy({ by: ["planId"], _count: { _all: true } });
  const countByPlanId = new Map(counts.map((c) => [c.planId, c._count._all]));
  return plans.map((p) => ({ planName: p.name, isFree: p.isFree, count: countByPlanId.get(p.id) ?? 0 }));
}
