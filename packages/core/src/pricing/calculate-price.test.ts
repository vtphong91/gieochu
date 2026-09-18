import { calculatePrice, type CouponSnapshot, type PricingLineInput } from "./calculate-price";

const NOW = new Date("2026-06-15T00:00:00.000Z");

function item(overrides: Partial<PricingLineInput> = {}): PricingLineInput {
  return { productId: "p1", priceVnd: 100_000, ...overrides };
}

function coupon(overrides: Partial<CouponSnapshot> = {}): CouponSnapshot {
  return { type: "PERCENT", value: 10, usedCount: 0, isEnabled: true, ...overrides };
}

describe("M6 calculatePrice", () => {
  it("1. uses the base price when there is no sale", () => {
    const result = calculatePrice({ items: [item()], customerUsageCount: 0, now: NOW });
    expect(result.lines[0]?.unitPriceVnd).toBe(100_000);
    expect(result.lines[0]?.isOnSale).toBe(false);
    expect(result.totalVnd).toBe(100_000);
  });

  it("2. uses the sale price when now is inside the sale window", () => {
    const result = calculatePrice({
      items: [item({ salePriceVnd: 80_000, saleStartsAt: new Date("2026-06-01"), saleEndsAt: new Date("2026-06-30") })],
      customerUsageCount: 0,
      now: NOW,
    });
    expect(result.lines[0]?.unitPriceVnd).toBe(80_000);
    expect(result.lines[0]?.isOnSale).toBe(true);
  });

  it("3. ignores the sale price when now is outside the sale window", () => {
    const result = calculatePrice({
      items: [item({ salePriceVnd: 80_000, saleStartsAt: new Date("2026-07-01"), saleEndsAt: new Date("2026-07-31") })],
      customerUsageCount: 0,
      now: NOW,
    });
    expect(result.lines[0]?.unitPriceVnd).toBe(100_000);
    expect(result.lines[0]?.isOnSale).toBe(false);
  });

  it("4. ignores a sale price that isn't lower than the base price", () => {
    const result = calculatePrice({ items: [item({ salePriceVnd: 100_000 })], customerUsageCount: 0, now: NOW });
    expect(result.lines[0]?.unitPriceVnd).toBe(100_000);
    expect(result.lines[0]?.isOnSale).toBe(false);
  });

  it("5. applies a PERCENT coupon", () => {
    const result = calculatePrice({ items: [item()], coupon: coupon({ type: "PERCENT", value: 20 }), customerUsageCount: 0, now: NOW });
    expect(result.discountVnd).toBe(20_000);
    expect(result.totalVnd).toBe(80_000);
  });

  it("6. applies a FIXED coupon", () => {
    const result = calculatePrice({ items: [item()], coupon: coupon({ type: "FIXED", value: 15_000 }), customerUsageCount: 0, now: NOW });
    expect(result.discountVnd).toBe(15_000);
    expect(result.totalVnd).toBe(85_000);
  });

  it("7. caps a PERCENT discount at maxDiscountVnd", () => {
    const result = calculatePrice({
      items: [item({ priceVnd: 1_000_000 })],
      coupon: coupon({ type: "PERCENT", value: 50, maxDiscountVnd: 100_000 }),
      customerUsageCount: 0,
      now: NOW,
    });
    expect(result.discountVnd).toBe(100_000);
    expect(result.totalVnd).toBe(900_000);
  });

  it("8. rejects a coupon that doesn't meet minOrderVnd", () => {
    const result = calculatePrice({
      items: [item({ priceVnd: 50_000 })],
      coupon: coupon({ minOrderVnd: 100_000 }),
      customerUsageCount: 0,
      now: NOW,
    });
    expect(result.couponError).toBe("NOT_APPLICABLE");
    expect(result.discountVnd).toBe(0);
    expect(result.totalVnd).toBe(50_000);
  });

  it("9. rejects a coupon that hasn't started yet or has already ended", () => {
    const notStarted = calculatePrice({ items: [item()], coupon: coupon({ startsAt: new Date("2026-07-01") }), customerUsageCount: 0, now: NOW });
    expect(notStarted.couponError).toBe("EXPIRED");

    const ended = calculatePrice({ items: [item()], coupon: coupon({ endsAt: new Date("2026-06-01") }), customerUsageCount: 0, now: NOW });
    expect(ended.couponError).toBe("EXPIRED");
  });

  it("10. rejects a coupon that has reached its total usage limit", () => {
    const result = calculatePrice({
      items: [item()],
      coupon: coupon({ usageLimit: 10, usedCount: 10 }),
      customerUsageCount: 0,
      now: NOW,
    });
    expect(result.couponError).toBe("LIMIT_REACHED");
  });

  it("11. rejects a coupon that has reached this customer's per-customer limit", () => {
    const result = calculatePrice({
      items: [item()],
      coupon: coupon({ perCustomerLimit: 1 }),
      customerUsageCount: 1,
      now: NOW,
    });
    expect(result.couponError).toBe("LIMIT_REACHED");
  });

  it("12. only discounts the products the coupon is restricted to", () => {
    const result = calculatePrice({
      items: [item({ productId: "p1", priceVnd: 100_000 }), item({ productId: "p2", priceVnd: 50_000 })],
      coupon: coupon({ type: "PERCENT", value: 10, productIds: ["p1"] }),
      customerUsageCount: 0,
      now: NOW,
    });
    const line1 = result.lines.find((l) => l.productId === "p1");
    const line2 = result.lines.find((l) => l.productId === "p2");
    expect(line1?.discountVnd).toBe(10_000);
    expect(line2?.discountVnd).toBe(0);
    expect(result.totalVnd).toBe(140_000);
  });

  it("13. never goes negative and rounds the total exactly (line discounts sum to the total discount)", () => {
    const result = calculatePrice({
      items: [item({ productId: "p1", priceVnd: 10_001 }), item({ productId: "p2", priceVnd: 10_001 }), item({ productId: "p3", priceVnd: 10_001 })],
      coupon: coupon({ type: "PERCENT", value: 33 }),
      customerUsageCount: 0,
      now: NOW,
    });
    const sumOfLineDiscounts = result.lines.reduce((sum, l) => sum + l.discountVnd, 0);
    expect(sumOfLineDiscounts).toBe(result.discountVnd);
    expect(result.totalVnd).toBeGreaterThanOrEqual(0);
    expect(result.totalVnd).toBe(result.subtotalVnd - result.discountVnd);
  });

  it("14. totals to 0 for a free document or a 100%-off coupon", () => {
    const free = calculatePrice({ items: [item({ priceVnd: 0 })], customerUsageCount: 0, now: NOW });
    expect(free.totalVnd).toBe(0);

    const fullDiscount = calculatePrice({ items: [item()], coupon: coupon({ type: "PERCENT", value: 100 }), customerUsageCount: 0, now: NOW });
    expect(fullDiscount.totalVnd).toBe(0);
  });
});
