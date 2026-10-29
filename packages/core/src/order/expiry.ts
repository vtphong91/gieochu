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

/**
 * Mốc cuối owner còn xác nhận tay được đơn theo luật chung — ADR-061 (chốt tiếp): **không còn cửa sổ trễ** sau hạn giữ đơn,
 * nên mốc này chính là `expiresAt`. Ngoại lệ "khách đã báo chuyển trước hạn" xem {@link canManuallyConfirmOrder}.
 */
export function manualConfirmDeadline(expiresAt: Date): Date {
  return new Date(expiresAt.getTime());
}

export interface ManualConfirmOptions {
  /**
   * ADR-062 bổ sung mục 3: lúc khách bấm "Tôi đã chuyển khoản" (`orders.customerDeclaredPaidAt`, chỉ có ở cổng xác nhận tay).
   * Đơn đã EXPIRED vẫn xác nhận được nếu mốc này **trước** `expiresAt`.
   */
  declaredPaidAt?: Date | null;
}

/**
 * §"M8" xác nhận thanh toán thủ công (bắt buộc ghi chú) — ADR-061: chỉ khi đơn còn PENDING (trạng thái hiệu lực, ADR-036);
 * bỏ cửa sổ trễ 24 giờ. Ngoại lệ ADR-062 bổ sung mục 3: đơn EXPIRED mà khách đã báo chuyển trước hạn.
 */
export function canManuallyConfirmOrder(status: OrderStatusValue, expiresAt: Date, now: Date, options: ManualConfirmOptions = {}): boolean {
  const effective = effectiveOrderStatus(status, expiresAt, now);
  if (effective === "PENDING") return true;
  if (effective === "EXPIRED") return Boolean(options.declaredPaidAt && options.declaredPaidAt.getTime() < expiresAt.getTime());
  return false;
}

/** ADR-061/062: hạn giữ đơn = lúc đặt đơn + số giờ của phương thức (thủ công/chưa chọn hoặc tự xác nhận). */
export function computeOrderHoldExpiresAt(createdAt: Date, holdHours: number): Date {
  return new Date(createdAt.getTime() + holdHours * 60 * 60 * 1000);
}
