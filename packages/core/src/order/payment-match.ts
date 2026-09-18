export type PaymentMatchStatus = "MATCHED" | "MISMATCH_AMOUNT";

/** §"M8": an order was found by code — this only decides whether the amount received actually matches it. */
export function matchPaymentAmount(orderTotalVnd: number, receivedAmountVnd: number): PaymentMatchStatus {
  return receivedAmountVnd === orderTotalVnd ? "MATCHED" : "MISMATCH_AMOUNT";
}
