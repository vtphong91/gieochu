import { accessTokenSecret, resolveSessionPolicy, type JwtContext, type SessionPolicy, type SystemRole } from "@gieochu/auth";
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

/**
 * ADR-053: chính sách phiên hiệu lực cho một vai trò + lựa chọn "Ghi nhớ" (SYSTEM_ADMIN luôn bị bỏ qua "Ghi nhớ").
 * Thay `refreshTokenTtlDays` (ADR-032) — hạn refresh = lúc đăng nhập + absolute, không trượt khi rotate.
 */
export async function getSessionPolicy(role: SystemRole, rememberMe: boolean): Promise<SessionPolicy> {
  return resolveSessionPolicy(role, rememberMe, await getSystemSettings());
}
