import { generateOpaqueToken, hashOpaqueToken } from "@gieochu/core";

export interface NewVerificationToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

/** Used for both EMAIL_VERIFY (24h TTL) and PASSWORD_RESET (30min TTL) — caller picks ttlHours. */
export function createVerificationToken(ttlHours: number, now: Date): NewVerificationToken {
  const token = generateOpaqueToken();
  return {
    token,
    tokenHash: hashOpaqueToken(token),
    expiresAt: addHours(now, ttlHours),
  };
}

export interface VerificationTokenRecord {
  expiresAt: Date;
  usedAt: Date | null;
}

export type VerificationTokenStatus = "valid" | "expired" | "used";

export function evaluateVerificationToken(record: VerificationTokenRecord, now: Date): VerificationTokenStatus {
  if (record.usedAt) return "used";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}
