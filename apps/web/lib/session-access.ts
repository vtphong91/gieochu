import { signAccessToken, type SessionPolicy, type SystemRole } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { setAccessCookie, type CookieSetter } from "./cookies";
import { getGuestSessionPolicy, getJwtContext, getSessionPolicy } from "./jwt-context";

/**
 * ADR-053 — nguồn DUY NHẤT để ký access token cho một phiên (login, refresh, ký lại khi đổi hồ sơ): claim `rm`, TTL
 * theo `policy.accessTtlSeconds`. Kiểu cookie (session/persistent) suy ra từ `policy.rememberMe` ở `setAccessCookie`
 * /`applyAuthCookies` — không tự đặt `maxAge` ở nơi gọi.
 */
export interface SessionAccessClaims {
  userId: string;
  familyId: string;
  role: SystemRole;
  emailVerified: boolean;
  profileCompleted: boolean;
  /** ADR-061 Q1: phiên khách vãng lai (claim `gco`). */
  guestCheckout?: boolean;
}

export async function signSessionAccessToken(
  claims: SessionAccessClaims,
  policy: SessionPolicy,
): Promise<{ accessToken: string; accessTtlSeconds: number }> {
  const accessTtlSeconds = policy.accessTtlSeconds;
  const accessToken = await signAccessToken(
    {
      sub: claims.userId,
      sid: claims.familyId,
      role: claims.role,
      ver: claims.emailVerified,
      pc: claims.profileCompleted,
      rm: policy.rememberMe,
      gco: claims.guestCheckout === true,
    },
    getJwtContext(),
    accessTtlSeconds,
  );
  return { accessToken, accessTtlSeconds };
}

/**
 * Ký lại access cookie cho phiên ĐANG có (không rotate refresh) — vd đổi hồ sơ làm đổi claim `pc`. "Ghi nhớ" đọc từ
 * refresh token còn hiệu lực của family (`familyId` = claim `sid`), không tin claim cũ. Family không còn token hiệu lực
 * (đã thu hồi) → không ký lại, trả `false`; access cũ hết hạn tự nhiên và lần refresh kế tiếp sẽ bị từ chối.
 */
export async function issueAccessCookieForSession(
  target: CookieSetter,
  claims: SessionAccessClaims,
): Promise<boolean> {
  const prisma = getPrismaClient();
  const record = await prisma.refreshToken.findFirst({
    where: { familyId: claims.familyId, userId: claims.userId, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: { rememberMe: true, guestCheckout: true },
  });
  if (!record) return false;

  const policy = record.guestCheckout ? await getGuestSessionPolicy() : await getSessionPolicy(claims.role, record.rememberMe);
  const { accessToken, accessTtlSeconds } = await signSessionAccessToken({ ...claims, guestCheckout: record.guestCheckout }, policy);
  setAccessCookie(target, accessToken, accessTtlSeconds, policy.rememberMe);
  return true;
}
