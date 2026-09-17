import { generateOrderCodePrefix, isValidOrderCodePrefix } from "./order-code-prefix";

describe("M4 order code prefix", () => {
  it("generates a 3-4 uppercase-letter prefix from the tenant name", () => {
    expect(isValidOrderCodePrefix(generateOrderCodePrefix("Cô Hạnh Toán 9"))).toBe(true);
    expect(generateOrderCodePrefix("Cô Hạnh Toán 9")).toBe("COHA");
    expect(isValidOrderCodePrefix(generateOrderCodePrefix("Ab"))).toBe(true); // pads short names
    expect(isValidOrderCodePrefix(generateOrderCodePrefix("123"))).toBe(true); // falls back when no letters
  });
});
