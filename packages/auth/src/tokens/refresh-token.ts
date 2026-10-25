import { generateOpaqueToken, hashOpaqueToken } from "@gieochu/core";

export interface NewRefreshToken {
  token: string;
  tokenHash: string;
  familyId: string;
  expiresAt: Date;
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

/** ADR-053: token mới với hạn tuyệt đối cho trước (hạn phiên = lúc đăng nhập + absolute, không trượt khi rotate). */
export function issueRefreshToken(familyId: string, expiresAt: Date): NewRefreshToken {
  const token = generateOpaqueToken();
  return { token, tokenHash: hashOpaqueToken(token), familyId, expiresAt };
}

/** Issued at login: starts a brand new rotation family. */
export function createRefreshToken(familyId: string, ttlDays: number, now: Date): NewRefreshToken {
  return issueRefreshToken(familyId, addDays(now, ttlDays));
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

/**
 * ADR-053: ân hạn cho token VỪA được thay. Nhiều tab (hoặc các tab vừa thức dậy cùng lúc) có thể gửi cùng một cookie
 * cũ gần như đồng thời — request tới sau mang cookie cũ là race, không phải dấu hiệu bị đánh cắp.
 */
export const REFRESH_REUSE_GRACE_MS = 30_000;

/** `superseded` = token đã được thay trong vòng ân hạn → từ chối nhưng KHÔNG thu hồi family, không xoá cookie. */
export type RefreshTokenStatus = "valid" | "expired" | "reused" | "superseded";

export interface EvaluateRefreshTokenOptions {
  /** Thời điểm token thay thế được tạo (`createdAt` của bản ghi `replacedById`). Thiếu → không có ân hạn. */
  replacedAt?: Date | null;
  graceMs?: number;
}

/**
 * A token that was already rotated (`replacedById` set) or explicitly
 * revoked being presented again means it was stolen/replayed — the caller
 * must revoke the whole family (docs §"M1" sequence diagram). Ngoại lệ (ADR-053): token bị thay chưa quá
 * `graceMs` và chưa bị thu hồi → `superseded`.
 */
export function evaluateRefreshToken(record: RefreshTokenRecord, now: Date, options: EvaluateRefreshTokenOptions = {}): RefreshTokenStatus {
  if (record.revokedAt) return "reused";
  if (record.replacedById) {
    const graceMs = options.graceMs ?? REFRESH_REUSE_GRACE_MS;
    const replacedAt = options.replacedAt;
    if (replacedAt && now.getTime() - replacedAt.getTime() <= graceMs) return "superseded";
    return "reused";
  }
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}
