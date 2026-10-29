import type { NextResponse } from "next/server";

// §7.1: httpOnly, Secure (prod), SameSite=Lax; refresh cookie scoped to /api/auth.
export const ACCESS_COOKIE_NAME = "gieochu_access";
export const REFRESH_COOKIE_NAME = "gieochu_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";

export interface AuthCookiePayload {
  accessToken: string;
  accessTtlSeconds: number;
  refreshToken: string;
  /**
   * ADR-053: `null` = session cookie (không `maxAge`, mất khi đóng trình duyệt) cho CẢ hai cookie — phiên không "Ghi nhớ"
   * và SYSTEM_ADMIN. Số = "Ghi nhớ đăng nhập": refresh persistent tới hết hạn phiên, access persistent theo TTL.
   */
  refreshMaxAgeSeconds: number | null;
}

/** Tối thiểu chung của `NextResponse.cookies` (route handler) và `cookies()` store (Server Action). */
export interface CookieSetter {
  set(
    name: string,
    value: string,
    options: { httpOnly: boolean; secure: boolean; sameSite: "lax"; path: string; maxAge?: number },
  ): unknown;
}

/**
 * ADR-053: access cookie persistent (`maxAge` = TTL) CHỈ khi phiên "Ghi nhớ"; còn lại là session cookie. Mọi nơi đặt
 * access cookie phải đi qua hàm này (login/refresh qua `applyAuthCookies`, ký lại phiên qua `issueAccessCookieForSession`).
 */
export function setAccessCookie(target: CookieSetter, accessToken: string, accessTtlSeconds: number, persistent: boolean): void {
  target.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    ...(persistent ? { maxAge: accessTtlSeconds } : {}),
  });
}

export function applyAuthCookies(response: NextResponse, payload: AuthCookiePayload): void {
  applyAuthCookiesTo(response.cookies, payload);
}

/** Như `applyAuthCookies` nhưng cho mọi `CookieSetter` — Server Action dùng `cookies()` store (ADR-061 Q1: phiên khách vãng lai). */
export function applyAuthCookiesTo(target: CookieSetter, payload: AuthCookiePayload): void {
  const secure = process.env.NODE_ENV === "production";
  const refreshMaxAge = payload.refreshMaxAgeSeconds;
  setAccessCookie(target, payload.accessToken, payload.accessTtlSeconds, refreshMaxAge !== null);
  target.set(REFRESH_COOKIE_NAME, payload.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    ...(refreshMaxAge !== null ? { maxAge: refreshMaxAge } : {}),
  });
}

export function clearAuthCookies(response: NextResponse): void {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE_NAME, "", { httpOnly: true, secure, sameSite: "lax", path: "/", maxAge: 0 });
  response.cookies.set(REFRESH_COOKIE_NAME, "", {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: 0,
  });
}
