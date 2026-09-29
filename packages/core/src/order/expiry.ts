/** §"M8": "Đơn PENDING hết hạn sau 60 phút (cấu hình được)" — `SystemSettings.orderPendingTtlMinutes` (ADR-032). */
export function computeOrderExpiresAt(now: Date, pendingTtlMinutes: number): Date {
  return new Date(now.getTime() + pendingTtlMinutes * 60 * 1000);
}

/**
 * §"M8": "Xác nhận thanh toán thủ công (chỉ đơn PENDING hoặc EXPIRED trong
 * vòng 24 giờ; bắt buộc nhập ghi chú)". The 24h window is measured from the
 * moment the order expired (`expiresAt`), not from `now` some other way.
 */
export function canManuallyConfirmOrder(
  status: "PENDING" | "EXPIRED" | "PAID" | "FULFILLED" | "CANCELED" | "REFUNDED",
  expiresAt: Date,
  now: Date,
  lateWindowHours = 24,
): boolean {
  if (status === "PENDING") return true;
  if (status === "EXPIRED") {
    const deadline = new Date(expiresAt.getTime() + lateWindowHours * 60 * 60 * 1000);
    return now <= deadline;
  }
  return false;
}
