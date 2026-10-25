import type { SystemRole } from "./rbac";

/**
 * ADR-053 — chính sách phiên đăng nhập (module thuần: không đọc DB/env; người gọi truyền cấu hình từ SystemSettings).
 *
 * | | Không "Ghi nhớ" | "Ghi nhớ" | SYSTEM_ADMIN |
 * |---|---|---|---|
 * | Cookie refresh | session cookie | persistent tới hết absolute | luôn session cookie (bỏ qua "Ghi nhớ") |
 * | Idle (đo ở server) | sessionIdleMinutes | không áp | adminIdleMinutes |
 * | Absolute (từ lúc login, không trượt) | sessionAbsoluteHours | rememberMeDays | adminAbsoluteHours |
 */

export interface SessionPolicySettings {
  accessTokenTtlMinutes: number;
  sessionIdleMinutes: number;
  sessionAbsoluteHours: number;
  rememberMeDays: number;
  adminIdleMinutes: number;
  adminAbsoluteHours: number;
  sessionWarningMinutes: number;
}

export interface SessionPolicy {
  /** Đã áp quy tắc vai trò: SYSTEM_ADMIN luôn `false`. */
  rememberMe: boolean;
  /** `null` = không có idle timeout ("Ghi nhớ"). */
  idleMs: number | null;
  absoluteMs: number;
  /** Cảnh báo trước idle; `null` khi không có idle. Luôn ≤ idle/2. */
  warningMs: number | null;
  /** TTL access token — không dài hơn idle (nếu không, access còn sống sau khi phiên đáng lẽ đã hết). */
  accessTtlSeconds: number;
}

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

export function resolveSessionPolicy(role: SystemRole, requestedRememberMe: boolean, settings: SessionPolicySettings): SessionPolicy {
  const isAdmin = role === "SYSTEM_ADMIN";
  const rememberMe = !isAdmin && requestedRememberMe;
  const idleMs = isAdmin ? settings.adminIdleMinutes * MINUTE_MS : rememberMe ? null : settings.sessionIdleMinutes * MINUTE_MS;
  const absoluteMs = isAdmin
    ? settings.adminAbsoluteHours * HOUR_MS
    : rememberMe
      ? settings.rememberMeDays * DAY_MS
      : settings.sessionAbsoluteHours * HOUR_MS;
  const warningMs = idleMs === null ? null : Math.min(settings.sessionWarningMinutes * MINUTE_MS, Math.floor(idleMs / 2));
  const configuredAccessSeconds = settings.accessTokenTtlMinutes * 60;
  const accessTtlSeconds = idleMs === null ? configuredAccessSeconds : Math.min(configuredAccessSeconds, Math.floor(idleMs / 1000));
  return { rememberMe, idleMs, absoluteMs, warningMs, accessTtlSeconds };
}

export type SessionTimeoutStatus = "active" | "idle" | "absolute";

/**
 * `sessionStartedAt`: lúc đăng nhập (không trượt). `lastActiveAt`: lúc token hiện tại được phát (`createdAt`) — client
 * chỉ làm mới khi có thao tác thật nên đây là mốc hoạt động gần nhất. Absolute xét trước idle.
 */
export function evaluateSessionTimeouts(
  session: { sessionStartedAt: Date; lastActiveAt: Date },
  policy: SessionPolicy,
  now: Date,
): SessionTimeoutStatus {
  if (now.getTime() - session.sessionStartedAt.getTime() > policy.absoluteMs) return "absolute";
  if (policy.idleMs !== null && now.getTime() - session.lastActiveAt.getTime() > policy.idleMs) return "idle";
  return "active";
}

/** Hạn của mọi refresh token trong phiên = lúc đăng nhập + absolute (không trượt theo lần rotate). */
export function sessionExpiresAt(sessionStartedAt: Date, policy: SessionPolicy): Date {
  return new Date(sessionStartedAt.getTime() + policy.absoluteMs);
}

/** `maxAge` (giây) cho cookie refresh: "Ghi nhớ" → còn lại tới hạn phiên; còn lại → `null` = session cookie. */
export function refreshCookieMaxAgeSeconds(policy: SessionPolicy, expiresAt: Date, now: Date): number | null {
  if (!policy.rememberMe) return null;
  return Math.max(1, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
}
