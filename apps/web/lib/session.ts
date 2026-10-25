import { cache } from "react";
import { cookies } from "next/headers";
import { verifyAccessToken, type SystemRole, type VerifiedAccessToken } from "@gieochu/auth";
import { forbidden, unauthorized } from "@gieochu/core";
import { ACCESS_COOKIE_NAME } from "./cookies";
import { getJwtContext } from "./jwt-context";

export interface CurrentUser {
  userId: string;
  familyId: string;
  role: SystemRole;
  emailVerified: boolean;
  profileCompleted: boolean;
}

/** Verify access token cookie một lần mỗi request (`cache()`) — dùng chung cho getCurrentUser và root layout. */
const readAccessClaims = cache(async (): Promise<VerifiedAccessToken | null> => {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;
  try {
    return await verifyAccessToken(token, getJwtContext());
  } catch {
    return null;
  }
});

/** Reads + verifies the access token cookie. Returns null if absent/invalid/expired. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const claims = await readAccessClaims();
  if (!claims) return null;
  return {
    userId: claims.sub,
    familyId: claims.sid,
    role: claims.role,
    emailVerified: claims.ver,
    profileCompleted: claims.pc,
  };
}

/**
 * ADR-053 — thông tin phiên cho `SessionRefresh` (client): vai trò + "Ghi nhớ" (claim `rm`) để tính chính sách, và lúc
 * access token được phát (`iat`, cùng lúc refresh token hiện tại được tạo) làm mốc đếm idle phía client. Không đọc DB.
 */
export async function getSessionClientInfo(): Promise<{ role: SystemRole; rememberMe: boolean; issuedAtMs: number } | null> {
  const claims = await readAccessClaims();
  if (!claims) return null;
  return { role: claims.role, rememberMe: claims.rm === true, issuedAtMs: claims.iat * 1000 };
}

/**
 * §4.3: every sensitive route handler / server action / server component
 * calls this itself — proxy.ts never gates access on its own.
 */
export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) throw unauthorized();
  return user;
}

export async function requireRole(role: SystemRole): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) throw forbidden();
  return user;
}

/**
 * Server Action guard cho /account/*, /studio/* và checkout — chỉ yêu cầu đã
 * xác minh email, KHÔNG còn chặn theo hồ sơ đầy đủ (đã bỏ cổng bắt buộc điền
 * hồ sơ trước khi dùng, cùng thay đổi với requireVerifiedAccess ở
 * page-guards.ts).
 */
export async function requireVerified(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.emailVerified) {
    throw forbidden("Vui lòng xác minh email trước khi tiếp tục.");
  }
  return user;
}
