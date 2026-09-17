import { canManageTenant } from "./membership";

describe("M4 tenant membership role", () => {
  it("only OWNER can manage the tenant", () => {
    expect(canManageTenant("OWNER")).toBe(true);
    expect(canManageTenant("STAFF")).toBe(false);
    expect(canManageTenant(null)).toBe(false);
  });
});
