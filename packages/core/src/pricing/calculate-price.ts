export type CouponType = "PERCENT" | "FIXED";
export type CouponErrorCode = "EXPIRED" | "LIMIT_REACHED" | "NOT_APPLICABLE";

export interface PricingLineInput {
  productId: string;
  priceVnd: number;
  salePriceVnd?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
}

export interface PricedLine {
  productId: string;
  originalPriceVnd: number;
  unitPriceVnd: number;
  isOnSale: boolean;
  discountVnd: number;
  totalVnd: number;
}

/** A read-only snapshot of the coupon row at calculation time — the caller (apps/web) owns fetching it. */
export interface CouponSnapshot {
  type: CouponType;
  /** Percent (1-100) for PERCENT, VND amount for FIXED. */
  value: number;
  maxDiscountVnd?: number | null;
  minOrderVnd?: number | null;
  /** null = unlimited. */
  usageLimit?: number | null;
  usedCount: number;
  /** null = unlimited. */
  perCustomerLimit?: number | null;
  startsAt?: Date | null;
  endsAt?: Date | null;
  /** null/empty = applies to every product. */
  productIds?: string[] | null;
  isEnabled: boolean;
}

export interface CalculatePriceInput {
  items: PricingLineInput[];
  coupon?: CouponSnapshot | null;
  customerUsageCount: number;
  now: Date;
}

export interface CalculatePriceResult {
  lines: PricedLine[];
  subtotalVnd: number;
  discountVnd: number;
  totalVnd: number;
  couponError?: CouponErrorCode;
}

function isOnSale(item: PricingLineInput, now: Date): boolean {
  if (item.salePriceVnd == null || item.salePriceVnd >= item.priceVnd) return false;
  if (item.saleStartsAt && now < item.saleStartsAt) return false;
  if (item.saleEndsAt && now > item.saleEndsAt) return false;
  return true;
}

function validateCoupon(coupon: CouponSnapshot, subtotalVnd: number, applicableCount: number, customerUsageCount: number, now: Date): CouponErrorCode | undefined {
  const started = !coupon.startsAt || now >= coupon.startsAt;
  const notEnded = !coupon.endsAt || now <= coupon.endsAt;
  if (!coupon.isEnabled || !started || !notEnded) return "EXPIRED";

  const underTotalLimit = coupon.usageLimit == null || coupon.usedCount < coupon.usageLimit;
  const underCustomerLimit = coupon.perCustomerLimit == null || customerUsageCount < coupon.perCustomerLimit;
  if (!underTotalLimit || !underCustomerLimit) return "LIMIT_REACHED";

  const meetsMinOrder = coupon.minOrderVnd == null || subtotalVnd >= coupon.minOrderVnd;
  if (!meetsMinOrder || applicableCount === 0) return "NOT_APPLICABLE";

  return undefined;
}

/**
 * §"M6" pure pricing engine — no DB access. Mirrors the spec's flowchart
 * exactly: per-line sale price resolution, then coupon validation
 * (EXPIRED -> LIMIT_REACHED -> NOT_APPLICABLE, first failure wins), then
 * discount distributed across applicable lines only (PERCENT rounds down
 * and is capped by maxDiscountVnd; FIXED never exceeds the applicable
 * lines' own subtotal). An invalid coupon never throws — it just returns
 * the full price plus `couponError` so the caller can show why.
 */
export function calculatePrice(input: CalculatePriceInput): CalculatePriceResult {
  const priced = input.items.map((item) => {
    const onSale = isOnSale(item, input.now);
    const unitPriceVnd = onSale ? (item.salePriceVnd as number) : item.priceVnd;
    return { productId: item.productId, originalPriceVnd: item.priceVnd, unitPriceVnd, isOnSale: onSale };
  });

  const subtotalVnd = priced.reduce((sum, line) => sum + line.unitPriceVnd, 0);

  if (!input.coupon) {
    return {
      lines: priced.map((line) => ({ ...line, discountVnd: 0, totalVnd: line.unitPriceVnd })),
      subtotalVnd,
      discountVnd: 0,
      totalVnd: subtotalVnd,
    };
  }

  const coupon = input.coupon;
  const applicableProductIds = coupon.productIds && coupon.productIds.length > 0 ? new Set(coupon.productIds) : null;
  const applicableLines = priced.filter((line) => !applicableProductIds || applicableProductIds.has(line.productId));

  const couponError = validateCoupon(coupon, subtotalVnd, applicableLines.length, input.customerUsageCount, input.now);
  if (couponError) {
    return {
      lines: priced.map((line) => ({ ...line, discountVnd: 0, totalVnd: line.unitPriceVnd })),
      subtotalVnd,
      discountVnd: 0,
      totalVnd: subtotalVnd,
      couponError,
    };
  }

  const applicableSubtotalVnd = applicableLines.reduce((sum, line) => sum + line.unitPriceVnd, 0);
  let totalDiscountVnd = 0;
  if (applicableSubtotalVnd > 0) {
    if (coupon.type === "PERCENT") {
      totalDiscountVnd = Math.floor((applicableSubtotalVnd * coupon.value) / 100);
      if (coupon.maxDiscountVnd != null) totalDiscountVnd = Math.min(totalDiscountVnd, coupon.maxDiscountVnd);
    } else {
      totalDiscountVnd = Math.min(coupon.value, applicableSubtotalVnd);
    }
  }

  const applicableIds = new Set(applicableLines.map((line) => line.productId));
  let distributed = 0;
  const lines: PricedLine[] = priced.map((line, index) => {
    if (!applicableIds.has(line.productId)) {
      return { ...line, discountVnd: 0, totalVnd: line.unitPriceVnd };
    }
    const isLastApplicable = index === priced.length - 1 || !priced.slice(index + 1).some((l) => applicableIds.has(l.productId));
    const share = isLastApplicable
      ? totalDiscountVnd - distributed
      : applicableSubtotalVnd > 0
        ? Math.floor((line.unitPriceVnd * totalDiscountVnd) / applicableSubtotalVnd)
        : 0;
    distributed += share;
    return { ...line, discountVnd: share, totalVnd: line.unitPriceVnd - share };
  });

  return {
    lines,
    subtotalVnd,
    discountVnd: totalDiscountVnd,
    totalVnd: Math.max(0, subtotalVnd - totalDiscountVnd),
  };
}
