import { canManuallyConfirmOrder, computeOrderExpiresAt } from "./expiry";

describe("M8 order expiry", () => {
  it("computes expiresAt as now plus the pending TTL", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(computeOrderExpiresAt(now, 60).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });

  it("allows manual confirmation only for PENDING, or EXPIRED within the 24h late window", () => {
    const expiresAt = new Date("2026-01-01T00:00:00.000Z");
    expect(canManuallyConfirmOrder("PENDING", expiresAt, new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    expect(canManuallyConfirmOrder("EXPIRED", expiresAt, new Date("2026-01-01T12:00:00.000Z"))).toBe(true);
    expect(canManuallyConfirmOrder("EXPIRED", expiresAt, new Date("2026-01-02T01:00:00.000Z"))).toBe(false);
    expect(canManuallyConfirmOrder("CANCELED", expiresAt, new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
    expect(canManuallyConfirmOrder("PAID", expiresAt, new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
  });
});
