import { calculateOrderPricing } from "./pricing";

describe("M8 order pricing recomputes from server-side product data", () => {
  it("ignores any client-supplied total — the total is always derived from the product's own priceVnd", () => {
    const now = new Date("2026-06-01T00:00:00.000Z");
    const result = calculateOrderPricing(
      [{ productId: "p1", title: "Đề thi Toán", priceVnd: 199_000 }],
      null,
      0,
      now,
    );
    expect(result.totalVnd).toBe(199_000);
    expect(result.lines[0]?.titleSnapshot).toBe("Đề thi Toán");
    expect(result.lines[0]?.finalPriceVnd).toBe(199_000);

    // Same product, same server-side price — the result is identical no matter what a client might have claimed;
    // there is simply no parameter here through which a client-supplied amount could ever reach the total.
    const again = calculateOrderPricing([{ productId: "p1", title: "Đề thi Toán", priceVnd: 199_000 }], null, 0, now);
    expect(again.totalVnd).toBe(result.totalVnd);
  });
});
