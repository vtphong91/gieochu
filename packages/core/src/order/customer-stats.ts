export interface TenantCustomerStats {
  ordersCount: number;
  totalSpentVnd: number;
  firstOrderAt: Date;
  lastOrderAt: Date;
}

/** §"M8": "Cập nhật tenant_customers (upsert, cộng dồn)" when an order becomes PAID. `current === null` means this is the customer's first order at this tenant. */
export function applyOrderToCustomerStats(
  current: TenantCustomerStats | null,
  order: { totalVnd: number; paidAt: Date },
): TenantCustomerStats {
  if (!current) {
    return { ordersCount: 1, totalSpentVnd: order.totalVnd, firstOrderAt: order.paidAt, lastOrderAt: order.paidAt };
  }
  return {
    ordersCount: current.ordersCount + 1,
    totalSpentVnd: current.totalSpentVnd + order.totalVnd,
    firstOrderAt: current.firstOrderAt,
    lastOrderAt: order.paidAt,
  };
}
