import { applyOrderToCustomerStats } from "./customer-stats";

describe("M8 tenant_customers upsert", () => {
  it("creates the first-order row, then accumulates orders/spend on repeat purchases", () => {
    const firstOrderAt = new Date("2026-01-01T00:00:00.000Z");
    const created = applyOrderToCustomerStats(null, { totalVnd: 100_000, paidAt: firstOrderAt });
    expect(created).toEqual({ ordersCount: 1, totalSpentVnd: 100_000, firstOrderAt, lastOrderAt: firstOrderAt });

    const secondOrderAt = new Date("2026-02-01T00:00:00.000Z");
    const updated = applyOrderToCustomerStats(created, { totalVnd: 50_000, paidAt: secondOrderAt });
    expect(updated).toEqual({ ordersCount: 2, totalSpentVnd: 150_000, firstOrderAt, lastOrderAt: secondOrderAt });
  });
});
