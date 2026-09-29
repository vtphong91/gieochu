import { accessTokenSecret, type JwtContext } from "@gieochu/auth";
import { getEnv } from "@gieochu/config";
import { getSystemSettings } from "./system-settings";

export function getJwtContext(): JwtContext {
  const env = getEnv();
  return {
    secret: accessTokenSecret(env.JWT_ACCESS_SECRET),
    issuer: env.JWT_ISSUER,
    audience: env.JWT_AUDIENCE,
  };
}

/**
 * ADR-032: access token TTL (giây) cho token MỚI ký — nguồn `SystemSettings.accessTokenTtlMinutes`
 * (5–60 phút). Token đã phát hành giữ `exp` cũ (verify không phụ thuộc TTL).
 */
export async function getAccessTokenTtlSeconds(): Promise<number> {
  const settings = await getSystemSettings();
  return settings.accessTokenTtlMinutes * 60;
}

/** ADR-032: refresh token TTL cho token MỚI — `days` cho bản ghi DB, `seconds` cho cookie maxAge. */
export async function getRefreshTokenTtl(): Promise<{ days: number; seconds: number }> {
  const settings = await getSystemSettings();
  return { days: settings.refreshTokenTtlDays, seconds: settings.refreshTokenTtlDays * 24 * 60 * 60 };
}
