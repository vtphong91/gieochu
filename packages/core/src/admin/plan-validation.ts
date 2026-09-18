export interface PlanInput {
  interval: "MONTH" | "YEAR";
  intervalCount: number;
  priceVnd: number;
  maxProducts: number;
  storageMb: number;
  maxFileMb: number;
}

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** §"M2": CRUD gói — chu kỳ hợp lệ, mọi giới hạn/giá không âm. */
export function isValidPlanInput(input: PlanInput): boolean {
  if (input.interval !== "MONTH" && input.interval !== "YEAR") return false;
  if (!Number.isInteger(input.intervalCount) || input.intervalCount <= 0) return false;
  return (
    isNonNegativeInt(input.priceVnd) &&
    isNonNegativeInt(input.maxProducts) &&
    isNonNegativeInt(input.storageMb) &&
    isNonNegativeInt(input.maxFileMb)
  );
}
