import { generateInvoiceCode, isValidInvoiceCode } from "./invoice-code";

describe("M3 subscription invoice code format", () => {
  it("generates a code matching SUB + 8 uppercase alphanumeric characters", () => {
    const code = generateInvoiceCode();
    expect(code).toMatch(/^SUB[A-Z0-9]{8}$/);
    expect(isValidInvoiceCode(code)).toBe(true);
    expect(isValidInvoiceCode("SUB123")).toBe(false);
    expect(isValidInvoiceCode("subABCD1234")).toBe(false);
  });
});
