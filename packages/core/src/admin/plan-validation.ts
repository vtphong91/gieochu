export interface PlanInput {
  interval: "MONTH" | "YEAR";
  intervalCount: number;
  priceVnd: number;
  maxProducts: number;
  storageMb: number;
  maxFileMb: number;
  /** ADR-028: hạn mức ảnh Cloudinary (MB). Tuỳ chọn để call site/test cũ chỉ kiểm giới hạn cũ vẫn hợp lệ. */
  imageStorageMb?: number;
  /** §"M3 v2": optional so existing call sites/tests that only check limits stay valid unchanged. */
  isFree?: boolean;
  features?: Record<string, unknown>;
}

function isNonNegativeInt(value: number): boolean {
  return Number.isInteger(value) && value >= 0;
}

/** §"M2"/"M3 v2": CRUD gói — chu kỳ hợp lệ, mọi giới hạn/giá không âm, features toàn cờ boolean. */
export function isValidPlanInput(input: PlanInput): boolean {
  if (input.interval !== "MONTH" && input.interval !== "YEAR") return false;
  if (!Number.isInteger(input.intervalCount) || input.intervalCount <= 0) return false;
  if (input.features && Object.values(input.features).some((v) => typeof v !== "boolean")) return false;
  return (
    isNonNegativeInt(input.priceVnd) &&
    isNonNegativeInt(input.maxProducts) &&
    isNonNegativeInt(input.storageMb) &&
    isNonNegativeInt(input.maxFileMb) &&
    (input.imageStorageMb === undefined || isNonNegativeInt(input.imageStorageMb))
  );
}
