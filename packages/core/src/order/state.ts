import { AppError } from "../errors";

export type OrderStatus = "PENDING" | "PAID" | "FULFILLED" | "EXPIRED" | "CANCELED" | "REFUNDED";

/**
 * ADR-068: `SELLER_CANCEL` / `SELLER_REOPEN` chỉ dùng cho thao tác "Đổi trạng thái…" của người bán (Studio) — huỷ cả đơn đã hết
 * hạn, mở lại đơn hết hạn/đã huỷ. `CANCEL` (khách/luồng cũ) và đường thanh toán tự động giữ nguyên.
 */
export type OrderEvent = "MARK_PAID" | "FULFILL" | "EXPIRE" | "CANCEL" | "REFUND" | "SELLER_CANCEL" | "SELLER_REOPEN";

/** §"M8" state diagram, encoded as an explicit transition table (same pattern as billing/subscription-state.ts). */
const TRANSITIONS: Record<OrderStatus, Partial<Record<OrderEvent, OrderStatus>>> = {
  PENDING: { MARK_PAID: "PAID", EXPIRE: "EXPIRED", CANCEL: "CANCELED", SELLER_CANCEL: "CANCELED" },
  PAID: { FULFILL: "FULFILLED" },
  FULFILLED: { REFUND: "REFUNDED" },
  EXPIRED: { MARK_PAID: "PAID", SELLER_CANCEL: "CANCELED", SELLER_REOPEN: "PENDING" },
  CANCELED: { SELLER_REOPEN: "PENDING" },
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
