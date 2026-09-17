import { generateOpaqueToken, hashOpaqueToken } from "./random-token";

export interface NewRefreshToken {
  token: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** Issued at login: starts a brand new rotation family. */
export function createRefreshToken(familyId: string, ttlDays: number, now: Date): NewRefreshToken {
  const token = generateOpaqueToken();
  return {
    token,
    tokenHash: hashOpaqueToken(token),
    familyId,
    expiresAt: addDays(now, ttlDays),
  };
}

/** Issued on `/api/auth/refresh`: same family, brand new token. */
export function rotateRefreshToken(currentFamilyId: string, ttlDays: number, now: Date): NewRefreshToken {
  return createRefreshToken(currentFamilyId, ttlDays, now);
}

export interface RefreshTokenRecord {
  expiresAt: Date;
  revokedAt: Date | null;
  replacedById: string | null;
}

export type RefreshTokenStatus = "valid" | "expired" | "reused";

/**
 * A token that was already rotated (`replacedById` set) or explicitly
 * revoked being presented again means it was stolen/replayed — the caller
 * must revoke the whole family (docs §"M1" sequence diagram).
 */
export function evaluateRefreshToken(record: RefreshTokenRecord, now: Date): RefreshTokenStatus {
  if (record.revokedAt || record.replacedById) return "reused";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}
