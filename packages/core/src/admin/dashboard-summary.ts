export interface AdminDashboardCounts {
  usersByStatus: Record<"PENDING" | "ACTIVE" | "LOCKED", number>;
  tenantsByStatus: Record<"ACTIVE" | "READ_ONLY" | "LOCKED", number>;
  subscriptionsByStatus: Record<string, number>;
  /** §"M3 v2" ADR-021: every tenant has a subscription (Free or Paid) — this is "how many of each", not GMV/MRR (still §"M12"). */
  subscriptionsByPlanType: { free: number; paid: number };
}

export interface AdminDashboardSummary extends AdminDashboardCounts {
  totalUsers: number;
  totalTenants: number;
  totalSubscriptions: number;
}

function sum(record: Record<string, number>): number {
  return Object.values(record).reduce((total, value) => total + value, 0);
}

/**
 * §"M2" dashboard: reshapes raw per-status counts (from `withSystemJob`
 * queries) into the totals the admin UI renders — no personal/tenant-order
 * data ever passes through here, only aggregate counts.
 */
export function buildAdminDashboardSummary(counts: AdminDashboardCounts): AdminDashboardSummary {
  return {
    ...counts,
    totalUsers: sum(counts.usersByStatus),
    totalTenants: sum(counts.tenantsByStatus),
    totalSubscriptions: sum(counts.subscriptionsByStatus),
  };
}
