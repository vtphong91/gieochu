import { isValidPlanInput, type PlanInput } from "./plan-validation";

const validPlan: PlanInput = {
  interval: "MONTH",
  intervalCount: 1,
  priceVnd: 199_000,
  maxProducts: 50,
  storageMb: 5_000,
  maxFileMb: 200,
};

describe("M2 plan validation", () => {
  it("accepts a valid plan and rejects bad interval or negative limits", () => {
    expect(isValidPlanInput(validPlan)).toBe(true);
    expect(isValidPlanInput({ ...validPlan, interval: "WEEK" as PlanInput["interval"] })).toBe(false);
    expect(isValidPlanInput({ ...validPlan, intervalCount: 0 })).toBe(false);
    expect(isValidPlanInput({ ...validPlan, priceVnd: -1 })).toBe(false);
    expect(isValidPlanInput({ ...validPlan, maxProducts: -1 })).toBe(false);
    expect(isValidPlanInput({ ...validPlan, storageMb: 1.5 })).toBe(false);
    expect(isValidPlanInput({ ...validPlan, isFree: true, features: { coupons: true } })).toBe(true);
    expect(isValidPlanInput({ ...validPlan, features: { coupons: "yes" as unknown as boolean } })).toBe(false);
  });
});
