import { addBillingPeriod, computeGraceEndsAt, computeRenewalPeriod } from "./period";

describe("M3 subscription billing period", () => {
  it("adds a month, clamping the end-of-month day (31/01 -> 28/02 non-leap year)", () => {
    const result = addBillingPeriod(new Date("2025-01-31T00:00:00.000Z"), { interval: "MONTH", intervalCount: 1 });
    expect(result.toISOString()).toBe("2025-02-28T00:00:00.000Z");
  });

  it("adds a year, landing on the same day next year", () => {
    const result = addBillingPeriod(new Date("2026-03-15T00:00:00.000Z"), { interval: "YEAR", intervalCount: 1 });
    expect(result.toISOString()).toBe("2027-03-15T00:00:00.000Z");
  });

  it("computes graceEndsAt as periodEnd plus graceDays", () => {
    const periodEnd = new Date("2026-01-01T00:00:00.000Z");
    expect(computeGraceEndsAt(periodEnd, 7).toISOString()).toBe("2026-01-08T00:00:00.000Z");
  });

  it("renews from currentPeriodEnd when the subscription is still in effect", () => {
    const now = new Date("2026-01-05T00:00:00.000Z");
    const currentPeriodEnd = new Date("2026-01-20T00:00:00.000Z");
    const { periodStart, periodEnd } = computeRenewalPeriod(now, currentPeriodEnd, { interval: "MONTH", intervalCount: 1 });
    expect(periodStart).toEqual(currentPeriodEnd);
    expect(periodEnd.toISOString()).toBe("2026-02-20T00:00:00.000Z");
  });

  it("renews from the payment time when the subscription has already expired", () => {
    const now = new Date("2026-02-10T00:00:00.000Z");
    const currentPeriodEnd = new Date("2026-01-20T00:00:00.000Z");
    const { periodStart, periodEnd } = computeRenewalPeriod(now, currentPeriodEnd, { interval: "MONTH", intervalCount: 1 });
    expect(periodStart).toEqual(now);
    expect(periodEnd.toISOString()).toBe("2026-03-10T00:00:00.000Z");
  });
});
