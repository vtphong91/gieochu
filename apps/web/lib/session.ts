import { cache } from "react";
import { cookies } from "next/headers";
import { verifyAccessToken, type SystemRole, type VerifiedAccessToken } from "@gieochu/auth";
import { AppError, forbidden, unauthorized } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { ACCESS_COOKIE_NAME } from "./cookies";
import { getJwtContext } from "./jwt-context";

export interface CurrentUser {
  userId: string;
  familyId: string;
  role: SystemRole;
  emailVerified: boolean;
  profileCompleted: boolean;
  /** ADR-061 Q1: phiên khách vãng lai (claim `gco`) — chỉ dùng được với `requireCheckoutUser` / `requireCheckoutAccess`. */
  guestCheckout?: boolean;
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
    guestCheckout: claims.gco === true,
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

export type SessionState = "ACTIVE" | "LOCKED" | "REVOKED";

/**
 * ADR-073 mục 9 — trạng thái THẬT của phiên trong DB (access token stateless chỉ hết hiệu lực khi hết hạn): tài khoản bị khoá
 * → LOCKED; họ phiên (`familyId` = claim `sid`) không còn refresh token nào chưa thu hồi (đăng xuất, "Đăng xuất mọi thiết bị",
 * đặt lại mật khẩu, phát hiện dùng lại token, hết idle/absolute ở lần refresh) → REVOKED. Một truy vấn `users` + `refresh_tokens`
 * (bảng L1, index `familyId`), `cache()` theo request + tham số. Token bị thay khi rotate vẫn `revokedAt = NULL` → phiên đang
 * làm mới song song không bị coi là đã thu hồi.
 */
const loadSessionState = cache(async (userId: string, familyId: string): Promise<SessionState> => {
  const row = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: { status: true, refreshTokens: { where: { familyId, revokedAt: null }, select: { id: true }, take: 1 } },
  });
  if (!row) return "REVOKED";
  if (row.status === "LOCKED") return "LOCKED";
  return row.refreshTokens.length > 0 ? "ACTIVE" : "REVOKED";
});

export async function getSessionState(user: CurrentUser): Promise<SessionState> {
  return loadSessionState(user.userId, user.familyId);
}

export const SESSION_GUARD_ERROR_CODES = { LOCKED: "ACCOUNT_LOCKED", REVOKED: "SESSION_REVOKED" } as const;

/**
 * ADR-073 mục 9 — guard khu vực nhạy cảm (System Center, Studio, thanh toán/checkout, cấp token tải): khoá tài khoản hoặc
 * thu hồi phiên có hiệu lực NGAY, không đợi access token hết hạn. Ném AppError 401.
 */
export async function assertActiveSession(user: CurrentUser): Promise<void> {
  const state = await getSessionState(user);
  if (state === "LOCKED") {
    throw new AppError({ code: SESSION_GUARD_ERROR_CODES.LOCKED, message: "Tài khoản đã bị khoá.", httpStatus: 401 });
  }
  if (state === "REVOKED") {
    throw new AppError({
      code: SESSION_GUARD_ERROR_CODES.REVOKED,
      message: "Phiên đăng nhập đã kết thúc, vui lòng đăng nhập lại.",
      httpStatus: 401,
    });
  }
}

/** Kiểm vai trò TRƯỚC (không tốn truy vấn với người không đủ quyền), rồi trạng thái phiên trong DB (ADR-073 mục 9). */
export async function requireRole(role: SystemRole): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== role) throw forbidden();
  await assertActiveSession(user);
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
  // ADR-073 mục 9: Server Actions profile/security/library/review/mở Studio — khoá/thu hồi phiên có hiệu lực ngay.
  await assertActiveSession(user);
  return user;
}

/**
 * ADR-061 Q1 / Bổ sung ADR-062 mục 1 — guard cho ĐÚNG 4 nhóm: checkout (trang + action), `/account/orders`, `/account/library`,
 * API tải. Cho qua: user đã xác minh email, HOẶC phiên khách vãng lai (`gco`, tối đa 24 giờ — ép ở refresh). Mọi nơi khác vẫn
 * `requireVerified` (khách vãng lai chưa kích hoạt không vào được).
 */
export async function requireCheckoutUser(): Promise<CurrentUser> {
  const user = await requireUser();
  if (!user.emailVerified && !user.guestCheckout) {
    throw forbidden("Vui lòng xác minh email trước khi tiếp tục.");
  }
  // ADR-073 mục 9: thanh toán + cấp token tải — khoá/đăng xuất có hiệu lực ngay.
  await assertActiveSession(user);
  return user;
}
