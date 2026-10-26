/** §"M8": "Đơn PENDING hết hạn sau 60 phút (cấu hình được)" — `SystemSettings.orderPendingTtlMinutes` (ADR-032). */
export function computeOrderExpiresAt(now: Date, pendingTtlMinutes: number): Date {
  return new Date(now.getTime() + pendingTtlMinutes * 60 * 1000);
}

type OrderStatusValue = "PENDING" | "EXPIRED" | "PAID" | "FULFILLED" | "CANCELED" | "REFUNDED";

/**
 * ADR-036 mục 3: the status an order really has right now. A PENDING order past `expiresAt` is EXPIRED
 * even if the sweep (now daily) hasn't written that yet — same boundary as `runOrderSweep`
 * (`expiresAt < now`). Every read/payment decision uses this instead of the stored status.
 */
export function effectiveOrderStatus<S extends OrderStatusValue>(status: S, expiresAt: Date, now: Date): S | "EXPIRED" {
  if (status === "PENDING" && expiresAt.getTime() < now.getTime()) return "EXPIRED";
  return status;
}

/** Mốc cuối owner còn xác nhận tay được đơn (hết hạn thanh toán + cửa sổ trễ) — dùng chung cho kiểm tra và email báo (ADR-059). */
export function manualConfirmDeadline(expiresAt: Date, lateWindowHours = 24): Date {
  return new Date(expiresAt.getTime() + lateWindowHours * 60 * 60 * 1000);
}

/**
 * §"M8": "Xác nhận thanh toán thủ công (chỉ đơn PENDING hoặc EXPIRED trong
 * vòng 24 giờ; bắt buộc nhập ghi chú)". The 24h window is measured from the
 * moment the order expired (`expiresAt`), not from `now` some other way.
 * ADR-036: judged on `effectiveOrderStatus` — a stored-PENDING order past `expiresAt` gets the same 24h
 * window an already-swept EXPIRED order gets (before, it stayed confirmable forever if no sweep ran).
 */
export function canManuallyConfirmOrder(
  status: OrderStatusValue,
  expiresAt: Date,
  now: Date,
  lateWindowHours = 24,
): boolean {
  const effective = effectiveOrderStatus(status, expiresAt, now);
  if (effective === "PENDING") return true;
  if (effective === "EXPIRED") return now <= manualConfirmDeadline(expiresAt, lateWindowHours);
  return false;
}
