import { calculatePrice, type CouponErrorCode, type CouponSnapshot } from "../pricing/calculate-price";

export interface OrderProductSnapshot {
  productId: string;
  title: string;
  priceVnd: number;
  salePriceVnd?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
}

export interface OrderPricedLine {
  productId: string;
  titleSnapshot: string;
  unitPriceVnd: number;
  finalPriceVnd: number;
}

export interface OrderPricingResult {
  lines: OrderPricedLine[];
  subtotalVnd: number;
  discountVnd: number;
  totalVnd: number;
  couponError?: CouponErrorCode;
}

/**
 * §"M8" test 7: takes only server-fetched `OrderProductSnapshot[]` (from the
 * tenant's own product rows) — there is no "client total" parameter this
 * function could even accept, so nothing a browser sends can influence the
 * price actually charged (§7.5).
 */
export function calculateOrderPricing(
  products: OrderProductSnapshot[],
  coupon: CouponSnapshot | null,
  customerUsageCount: number,
  now: Date,
): OrderPricingResult {
  const priced = calculatePrice({
    items: products.map((p) => ({
      productId: p.productId,
      priceVnd: p.priceVnd,
      salePriceVnd: p.salePriceVnd,
      saleStartsAt: p.saleStartsAt,
      saleEndsAt: p.saleEndsAt,
    })),
    coupon,
    customerUsageCount,
    now,
  });

  const titleByProductId = new Map(products.map((p) => [p.productId, p.title]));
  return {
    lines: priced.lines.map((line) => ({
      productId: line.productId,
      titleSnapshot: titleByProductId.get(line.productId) ?? "",
      unitPriceVnd: line.unitPriceVnd,
      finalPriceVnd: line.totalVnd,
    })),
    subtotalVnd: priced.subtotalVnd,
    discountVnd: priced.discountVnd,
    totalVnd: priced.totalVnd,
    couponError: priced.couponError,
  };
}
