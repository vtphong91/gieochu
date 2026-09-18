export interface EntitlementSnapshot {
  revokedAt: Date | null;
  downloadsUsed: number;
  /** Snapshot of Product.downloadLimit at purchase time — 0 means unlimited (§"M5" ADR-015, same convention). */
  downloadLimit: number;
}

export type DownloadBlockReason = "REVOKED" | "LIMIT_REACHED";

export interface DownloadGuardResult {
  allowed: boolean;
  reason?: DownloadBlockReason;
}

/** §"M9": revoked entitlements and exhausted download limits both block a new download token from being issued. */
export function canDownloadEntitlement(entitlement: EntitlementSnapshot): DownloadGuardResult {
  if (entitlement.revokedAt) return { allowed: false, reason: "REVOKED" };
  if (entitlement.downloadLimit !== 0 && entitlement.downloadsUsed >= entitlement.downloadLimit) {
    return { allowed: false, reason: "LIMIT_REACHED" };
  }
  return { allowed: true };
}
