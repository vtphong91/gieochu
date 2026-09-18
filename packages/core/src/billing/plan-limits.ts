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
 */
export function isWithinPlanLimit(kind: PlanLimitKind, current: number, limits: PlanLimits): boolean {
  switch (kind) {
    case "products":
      return current < limits.maxProducts;
    case "storage":
      return current <= limits.storageMb * 1024 * 1024;
    case "fileSize":
      return current <= limits.maxFileMb * 1024 * 1024;
  }
}
