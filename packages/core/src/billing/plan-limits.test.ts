import { isWithinPlanLimit } from "./plan-limits";

const limits = { maxProducts: 10, storageMb: 500, maxFileMb: 20 };

describe("M3 plan limits", () => {
  it("checks the product count limit", () => {
    expect(isWithinPlanLimit("products", 9, limits)).toBe(true);
    expect(isWithinPlanLimit("products", 10, limits)).toBe(false);
    expect(isWithinPlanLimit("products", 11, limits)).toBe(false);
  });

  it("checks the storage limit in bytes against the plan's MB cap", () => {
    const withinCap = limits.storageMb * 1024 * 1024;
    expect(isWithinPlanLimit("storage", withinCap, limits)).toBe(true);
    expect(isWithinPlanLimit("storage", withinCap + 1, limits)).toBe(false);
  });
});

describe("M5 per-file size limit (reuses isWithinPlanLimit built in M3)", () => {
  it("checks a single file's size against the plan's per-file MB cap", () => {
    const withinCap = limits.maxFileMb * 1024 * 1024;
    expect(isWithinPlanLimit("fileSize", withinCap, limits)).toBe(true);
    expect(isWithinPlanLimit("fileSize", withinCap + 1, limits)).toBe(false);
  });
});
