import { canUsePlanFeature } from "./feature-gate";

describe("M3 v2 plan feature gate", () => {
  it("is only true when the flag is exactly true — missing/false/malformed all mean off", () => {
    expect(canUsePlanFeature({ coupons: true }, "coupons")).toBe(true);
    expect(canUsePlanFeature({ coupons: false }, "coupons")).toBe(false);
    expect(canUsePlanFeature({}, "coupons")).toBe(false);
    expect(canUsePlanFeature({ coupons: "true" }, "coupons")).toBe(false);
  });
});
