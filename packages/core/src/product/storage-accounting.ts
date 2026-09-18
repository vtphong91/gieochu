/**
 * §"M5": recomputes `tenant.storageUsedBytes` when a file is added
 * (positive delta) or removed/rejected (negative delta) — clamped at 0 so a
 * race or an out-of-order rollback can never underflow it negative.
 */
export function applyStorageDelta(currentBytes: number, deltaBytes: number): number {
  return Math.max(0, currentBytes + deltaBytes);
}
