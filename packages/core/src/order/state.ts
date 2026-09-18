import { AppError } from "../errors";

export type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "EXPIRED" | "CANCELED" | "REFUNDED";

export type OrderEvent = "MARK_PAID" | "FULFILL" | "EXPIRE" | "CANCEL" | "REFUND";

/** §"M8" state diagram, encoded as an explicit transition table (same pattern as billing/subscription-state.ts). */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  PENDING: { MARK_PAID: "PAID", EXPIRE: "EXPIRED", CANCEL: "CANCELED" },
  PAID: { FULFILL: "FULFILLED" },
  FULFILLED: { REFUND: "REFUNDED" },
  EXPIRED: { MARK_PAID: "PAID" },
  CANCELED: {},
  REFUNDED: {},
};

/** Throws (not a decision object) — an out-of-band transition is a bug, not a user-facing outcome. */
export function transitionOrderStatus(current: OrderStatus, event: OrderEvent): OrderStatus {
  const next = TRANSITIONS[current]?.[event];
  if (!next) {
    throw new AppError({
      code: "INVALID_ORDER_TRANSITION",
      message: `Không thể chuyển đơn hàng từ ${current} với sự kiện ${event}.`,
      httpStatus: 409,
      expose: false,
    });
  }
  return next;
}
