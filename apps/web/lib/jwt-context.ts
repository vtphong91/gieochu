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

/** Bổ sung ADR-062 mục 1: phiên khách vãng lai sống tối đa 24 giờ kể từ lúc tạo, kể cả khi refresh. */
export const GUEST_SESSION_MAX_HOURS = 24;

/**
 * Chính sách phiên khách vãng lai: idle/absolute như phiên USER thường (ADR-053), không "Ghi nhớ", absolute bị kẹp ≤ 24 giờ.
 * Refresh dùng `sessionStartedAt` cố định nên hạn không bao giờ trượt quá mốc 24 giờ.
 */
export async function getGuestSessionPolicy(): Promise<SessionPolicy> {
  const base = resolveSessionPolicy("USER", false, await getSystemSettings());
  return { ...base, rememberMe: false, absoluteMs: Math.min(base.absoluteMs, GUEST_SESSION_MAX_HOURS * 60 * 60 * 1000) };
}
