import { canManuallyConfirmOrder, computeOrderExpiresAt, computeOrderHoldExpiresAt } from "./expiry";

describe("M8 order expiry", () => {
  it("computes expiresAt as now plus the pending TTL", () => {
    const now = new Date("2026-01-01T00:00:00.000Z");
    expect(computeOrderExpiresAt(now, 60).toISOString()).toBe("2026-01-01T01:00:00.000Z");
  });

  it("allows manual confirmation only for PENDING, or EXPIRED when the customer declared payment before the deadline", () => {
    const expiresAt = new Date("2026-01-01T00:00:00.000Z");
    expect(canManuallyConfirmOrder("PENDING", expiresAt, new Date("2026-01-01T00:00:00.000Z"))).toBe(true);
    // ADR-061: không còn cửa sổ trễ 24 giờ.
    expect(canManuallyConfirmOrder("EXPIRED", expiresAt, new Date("2026-01-01T12:00:00.000Z"))).toBe(false);
    expect(canManuallyConfirmOrder("PENDING", expiresAt, new Date("2026-01-01T00:00:01.000Z"))).toBe(false);
    // ADR-062 bổ sung mục 3: khách báo đã chuyển TRƯỚC hạn → vẫn xác nhận được sau hạn; báo sau hạn → không.
    const declaredBefore = { declaredPaidAt: new Date("2025-12-31T20:00:00.000Z") };
    expect(canManuallyConfirmOrder("EXPIRED", expiresAt, new Date("2026-01-05T00:00:00.000Z"), declaredBefore)).toBe(true);
    expect(canManuallyConfirmOrder("PENDING", expiresAt, new Date("2026-01-05T00:00:00.000Z"), declaredBefore)).toBe(true);
    expect(canManuallyConfirmOrder("EXPIRED", expiresAt, new Date("2026-01-05T00:00:00.000Z"), { declaredPaidAt: expiresAt })).toBe(false);
    expect(canManuallyConfirmOrder("CANCELED", expiresAt, new Date("2025-12-31T00:00:00.000Z"), declaredBefore)).toBe(false);
    expect(computeOrderHoldExpiresAt(expiresAt, 72).toISOString()).toBe("2026-01-04T00:00:00.000Z");
    expect(canManuallyConfirmOrder("CANCELED", expiresAt, new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
    expect(canManuallyConfirmOrder("PAID", expiresAt, new Date("2026-01-01T00:00:00.000Z"))).toBe(false);
  });
});
