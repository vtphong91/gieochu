import { generateOrderCode, isValidOrderCode } from "./code";

describe("M8 order code format", () => {
  it("generates a code with the tenant's prefix followed by 6 unambiguous base32 characters", () => {
    const code = generateOrderCode("HAN");
    expect(code).toMatch(/^HAN[2-9A-HJ-NP-Z]{6}$/);
    expect(code).not.toMatch(/[0O1I]/);
    expect(isValidOrderCode(code, "HAN")).toBe(true);
    expect(isValidOrderCode(code, "OTHER")).toBe(false);
    expect(isValidOrderCode("HAN123", "HAN")).toBe(false);
  });
});
