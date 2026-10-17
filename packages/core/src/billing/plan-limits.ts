export type PlanLimitKind = "products" | "storage" | "fileSize";

export interface PlanLimits {
  maxProducts: number;
  storageMb: number;
  maxFileMb: number;
}

/**
 * §"M3" "Áp giới hạn qua assertPlanLimit(tenantId, kind) tại M5" — this is
 * the pure decision the DB-aware wrapper will call once M5 adds product
 * creation/file upload (the wrapper itself is out of scope here: its exact
 * query shape depends on schema M5 introduces, e.g. how storage usage is
 * tallied per file — see docs/BACKLOG.md).
 *
 * ADR-041 A4 — hạn mức `0` nghĩa là **không được phép** (0 sản phẩm / 0 byte); `PLAN_LIMIT_UNLIMITED` (`-1`) nghĩa
 * là **không giới hạn**. Giá trị âm khác bị `isValidPlanInput` từ chối; nếu lọt vào DB vẫn coi là không được phép
 * (an toàn). Hiển thị dùng `describePlanLimit`/`formatPlanLimit` để mọi nơi cùng một nghĩa.
 */
export const PLAN_LIMIT_UNLIMITED = -1;

export function isUnlimitedPlanLimit(limit: number): boolean {
  return limit === PLAN_LIMIT_UNLIMITED;
}

export function isWithinPlanLimit(kind: PlanLimitKind, current: number, limits: PlanLimits): boolean {
  switch (kind) {
    case "products":
      return isUnlimitedPlanLimit(limits.maxProducts) || current < limits.maxProducts;
    case "storage":
      return isUnlimitedPlanLimit(limits.storageMb) || current <= limits.storageMb * 1024 * 1024;
    case "fileSize":
      return isUnlimitedPlanLimit(limits.maxFileMb) || current <= limits.maxFileMb * 1024 * 1024;
  }
}

/** Trường hạn mức của `Plan` hiển thị được ở trang Bảng giá / Billing. */
export const PLAN_LIMIT_FIELDS = ["maxProducts", "storageMb", "maxFileMb", "imageStorageMb"] as const;
export type PlanLimitField = (typeof PLAN_LIMIT_FIELDS)[number];

export const PLAN_LIMIT_FIELD_LABELS: Record<PlanLimitField, string> = {
  maxProducts: "Số tài liệu đang bán",
  storageMb: "Dung lượng tệp",
  maxFileMb: "Kích thước một tệp",
  imageStorageMb: "Dung lượng ảnh",
};

/** `NONE` = 0 (không được phép); `UNLIMITED` = -1; `LIMITED` = số dương. Dùng chung cho Billing Studio và trang Bảng giá. */
export type PlanLimitDisplay = { kind: "NONE" } | { kind: "UNLIMITED" } | { kind: "LIMITED"; value: number };

export function describePlanLimit(value: number): PlanLimitDisplay {
  if (isUnlimitedPlanLimit(value)) return { kind: "UNLIMITED" };
  return Number.isInteger(value) && value > 0 ? { kind: "LIMITED", value } : { kind: "NONE" };
}

/**
 * Chuỗi hiển thị một hạn mức: `maxProducts` → "50 tài liệu"; MB → "500 MB" / "5 GB" (≥1.024 MB đổi GB, tối đa 1 chữ số
 * thập phân kiểu vi-VN, tính bằng số nguyên — không float khi chia hết); 0 → "Không có"; -1 → "Không giới hạn".
 */
export function formatPlanLimit(field: PlanLimitField, value: number): string {
  const display = describePlanLimit(value);
  if (display.kind === "NONE") return "Không có";
  if (display.kind === "UNLIMITED") return "Không giới hạn";
  if (field === "maxProducts") return `${display.value.toLocaleString("vi-VN")} tài liệu`;
  if (display.value < 1024) return `${display.value.toLocaleString("vi-VN")} MB`;
  const tenthsGb = Math.floor((display.value * 10) / 1024);
  const whole = Math.floor(tenthsGb / 10);
  const fraction = tenthsGb % 10;
  return `${whole.toLocaleString("vi-VN")}${fraction > 0 ? `,${fraction}` : ""} GB`;
}
