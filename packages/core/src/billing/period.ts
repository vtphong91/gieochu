export type PlanInterval = "MONTH" | "YEAR";

export interface PlanIntervalInfo {
  interval: PlanInterval;
  intervalCount: number;
}

/**
 * Adds calendar months in UTC, clamping the day-of-month to the target
 * month's last day (31/01 + 1 month -> 28 or 29/02, never rolls into
 * March) — §"M3" unit test 1/2.
 */
export function addBillingPeriod(date: Date, plan: PlanIntervalInfo): Date {
  const months = plan.interval === "YEAR" ? plan.intervalCount * 12 : plan.intervalCount;
  const day = date.getUTCDate();

  const result = new Date(date.getTime());
  result.setUTCDate(1);
  result.setUTCMonth(result.getUTCMonth() + months);

  const lastDayOfTargetMonth = new Date(Date.UTC(result.getUTCFullYear(), result.getUTCMonth() + 1, 0)).getUTCDate();
  result.setUTCDate(Math.min(day, lastDayOfTargetMonth));
  return result;
}

/**
 * §"M3": "Subscription còn hiệu lực → kỳ mới nối tiếp currentPeriodEnd cũ;
 * đã hết → kỳ mới bắt đầu từ thời điểm thanh toán."
 */
export function computeRenewalPeriod(
  now: Date,
  currentPeriodEnd: Date,
  plan: PlanIntervalInfo,
): { periodStart: Date; periodEnd: Date } {
  const periodStart = currentPeriodEnd > now ? currentPeriodEnd : now;
  return { periodStart, periodEnd: addBillingPeriod(periodStart, plan) };
}

export function computeGraceEndsAt(periodEnd: Date, graceDays: number): Date {
  return new Date(periodEnd.getTime() + graceDays * 24 * 60 * 60 * 1000);
}
