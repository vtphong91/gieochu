import { matchPaymentAmount } from "./payment-match";

describe("M8 payment amount matching", () => {
  it("matches when the received amount is exactly the order total", () => {
    expect(matchPaymentAmount(199_000, 199_000)).toBe("MATCHED");
  });

  it("reports a mismatch when the received amount differs from the order total", () => {
    expect(matchPaymentAmount(199_000, 150_000)).toBe("MISMATCH_AMOUNT");
    expect(matchPaymentAmount(199_000, 200_000)).toBe("MISMATCH_AMOUNT");
  });
});
