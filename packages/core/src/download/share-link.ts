export interface ShareLinkSnapshot {
  expiresAt: Date | null;
  maxUses: number | null;
  usedCount: number;
  revokedAt: Date | null;
}

export type ShareLinkBlockReason = "REVOKED" | "EXPIRED" | "LIMIT_REACHED";

export interface ShareLinkUsability {
  usable: boolean;
  reason?: ShareLinkBlockReason;
}

/** §"M9" flowchart: revoked/expired/out-of-uses all resolve to "410 Link không còn hiệu lực" at the route level. */
export function isShareLinkUsable(link: ShareLinkSnapshot, now: Date): ShareLinkUsability {
  if (link.revokedAt) return { usable: false, reason: "REVOKED" };
  if (link.expiresAt && now.getTime() >= link.expiresAt.getTime()) return { usable: false, reason: "EXPIRED" };
  if (link.maxUses != null && link.usedCount >= link.maxUses) return { usable: false, reason: "LIMIT_REACHED" };
  return { usable: true };
}
