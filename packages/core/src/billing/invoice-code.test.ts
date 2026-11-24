import { generateInvoiceCode, isValidInvoiceCode } from "./invoice-code";
import { normalizePaymentCodePrefix } from "./payment-code";

describe("M3 subscription invoice code format", () => {
  it("generates prefix + 8 digits (ADR-065: SePay only recognises a numeric fixed-length suffix)", () => {
    const code = generateInvoiceCode();
    expect(code).toMatch(/^SUB[1-9]\d{7}$/);
    expect(isValidInvoiceCode(code)).toBe(true);
    expect(generateInvoiceCode("SEVQR")).toMatch(/^SEVQR[1-9]\d{7}$/);
    expect(isValidInvoiceCode("SUB123")).toBe(false);
    expect(isValidInvoiceCode("SUBWQRMN878")).toBe(false);
    // Tiền tố SePay: 2–5 chữ cái, chuẩn hoá in hoa; số/ký tự khác/quá dài → null.
    expect(normalizePaymentCodePrefix(" sevqr ")).toBe("SEVQR");
    expect(normalizePaymentCodePrefix("SUB1")).toBeNull();
    expect(normalizePaymentCodePrefix("SEVQRX")).toBeNull();
    expect(() => generateInvoiceCode("S")).toThrow();
  });
});
