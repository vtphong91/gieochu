export interface LockTargetUser {
  id: string;
  isSuperAdmin: boolean;
}

export type LockRejectReason = "SELF" | "SUPER_ADMIN";

export interface LockUserDecision {
  allowed: boolean;
  reason?: LockRejectReason;
  /** §"M2" flowchart: locking always revokes every refresh token when allowed. */
  revokeSessions: boolean;
}

/** §"M2" — Khoá user: từ chối khoá chính mình hoặc super admin. */
export function decideLockUser(actorId: string, target: LockTargetUser): LockUserDecision {
  if (actorId === target.id) {
    return { allowed: false, reason: "SELF", revokeSessions: false };
  }
  if (target.isSuperAdmin) {
    return { allowed: false, reason: "SUPER_ADMIN", revokeSessions: false };
  }
  return { allowed: true, revokeSessions: true };
}
