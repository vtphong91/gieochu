import { cookies } from "next/headers";
import { verifyAccessToken, type SystemRole } from "@gieochu/auth";
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

/** Reads + verifies the access token cookie. Returns null if absent/invalid/expired. */
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE_NAME)?.value;
  if (!token) return null;

  try {
    const claims = await verifyAccessToken(token, getJwtContext());
    return {
      userId: claims.sub,
      familyId: claims.sid,
      role: claims.role,
      emailVerified: claims.ver,
      profileCompleted: claims.pc,
    };
  } catch {
    return null;
  }
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
