import { generateOpaqueToken, hashOpaqueToken } from "../crypto/random-token";

export interface NewDownloadToken {
  token: string;
  tokenHash: string;
  expiresAt: Date;
}

/** §"M9": "tạo download token (hash, sống 60 giây, dùng một lần)". */
export function createDownloadToken(now: Date, ttlSeconds = 60): NewDownloadToken {
  const token = generateOpaqueToken();
  return {
    token,
    tokenHash: hashOpaqueToken(token),
    expiresAt: new Date(now.getTime() + ttlSeconds * 1000),
  };
}

export interface DownloadTokenRecord {
  expiresAt: Date;
  usedAt: Date | null;
}

export type DownloadTokenStatus = "valid" | "expired" | "used";

export function evaluateDownloadToken(record: DownloadTokenRecord, now: Date): DownloadTokenStatus {
  if (record.usedAt) return "used";
  if (record.expiresAt.getTime() <= now.getTime()) return "expired";
  return "valid";
}
