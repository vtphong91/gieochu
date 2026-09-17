import type { NextResponse } from "next/server";

// §7.1: httpOnly, Secure (prod), SameSite=Lax; refresh cookie scoped to /api/auth.
export const ACCESS_COOKIE_NAME = "gieochu_access";
export const REFRESH_COOKIE_NAME = "gieochu_refresh";
const REFRESH_COOKIE_PATH = "/api/auth";

export interface AuthCookiePayload {
  accessToken: string;
  accessTtlSeconds: number;
  refreshToken: string;
  refreshTtlSeconds: number;
}

export function applyAuthCookies(response: NextResponse, payload: AuthCookiePayload): void {
  const secure = process.env.NODE_ENV === "production";
  response.cookies.set(ACCESS_COOKIE_NAME, payload.accessToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: "/",
    maxAge: payload.accessTtlSeconds,
  });
  response.cookies.set(REFRESH_COOKIE_NAME, payload.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: "lax",
    path: REFRESH_COOKIE_PATH,
    maxAge: payload.refreshTtlSeconds,
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
