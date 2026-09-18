import { buildAdminDashboardSummary } from "./dashboard-summary";

describe("M2 admin dashboard summary mapper", () => {
  it("sums per-status counts into totals without adding any other data", () => {
    const summary = buildAdminDashboardSummary({
      usersByStatus: { PENDING: 2, ACTIVE: 10, LOCKED: 1 },
      tenantsByStatus: { ACTIVE: 4, READ_ONLY: 1, LOCKED: 0 },
      subscriptionsByStatus: { ACTIVE: 5 },
      subscriptionsByPlanType: { free: 3, paid: 2 },
    });

    expect(summary.totalUsers).toBe(13);
    expect(summary.totalTenants).toBe(5);
    expect(summary.totalSubscriptions).toBe(5);
    expect(summary.usersByStatus.ACTIVE).toBe(10);
    expect(summary.subscriptionsByPlanType).toEqual({ free: 3, paid: 2 });
  });
});
