import { NextResponse, type NextRequest } from "next/server";
import {
  describeUserAgent,
  evaluateRefreshToken,
  evaluateSessionTimeouts,
  hashOpaqueToken,
  isProfileComplete,
  issueRefreshToken,
  refreshCookieMaxAgeSeconds,
  sessionExpiresAt,
} from "@gieochu/auth";
import { AppError, unauthorized } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { applyAuthCookies, clearAuthCookies, REFRESH_COOKIE_NAME } from "../../../../lib/cookies";
import { getGuestSessionPolicy, getSessionPolicy } from "../../../../lib/jwt-context";
import { signSessionAccessToken } from "../../../../lib/session-access";
import { getRequestId, handleApiError } from "../../../../lib/api-response";
import { audit, auditMetaFromRequest } from "../../../../lib/audit";

/** Mã lỗi khi token vừa được tab/request khác thay (ADR-053) — client giữ nguyên phiên, không coi là đăng xuất. */
const SUPERSEDED_CODE = "AUTH_REFRESH_SUPERSEDED";

/** Rotation thua race (token cũ đã bị request khác thay giữa lúc đọc và ghi) — rollback transaction. */
class RotationRaceLost extends Error {}

/**
 * Token đã được thay trong vòng ân hạn: từ chối nhưng KHÔNG thu hồi family và KHÔNG xoá cookie — trình duyệt đã/đang
 * nhận cookie mới từ request thắng race (ADR-053).
 */
function supersededResponse(requestId: string): NextResponse {
  return handleApiError(
    new AppError({ code: SUPERSEDED_CODE, message: "Phiên vừa được làm mới ở tab khác.", httpStatus: 401 }),
    requestId,
  );
}

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  const rawToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;

  if (!rawToken) {
    const response = handleApiError(unauthorized("Chưa đăng nhập."), requestId);
    clearAuthCookies(response);
    return response;
  }

  try {
    const tokenHash = hashOpaqueToken(rawToken);
    const prisma = getPrismaClient();
    const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });

    if (!record) {
      const response = handleApiError(unauthorized("Phiên đăng nhập không hợp lệ."), requestId);
      clearAuthCookies(response);
      return response;
    }

    const now = new Date();
    // Ân hạn chỉ tính theo thời điểm tạo token thay thế (không cần cột mới).
    const replacement =
      record.replacedById && !record.revokedAt
        ? await prisma.refreshToken.findUnique({ where: { id: record.replacedById }, select: { createdAt: true } })
        : null;
    const status = evaluateRefreshToken(record, now, { replacedAt: replacement?.createdAt ?? null });

    if (status === "superseded") return supersededResponse(requestId);

    if (status === "reused") {
      const revoked = await prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: now },
      });
      await audit.log({
        actorId: record.userId,
        scope: "SYSTEM",
        action: "AUTH_REFRESH_REUSE",
        targetType: "User",
        targetId: record.userId,
        metadata: { revokedSessions: revoked.count },
        ...auditMetaFromRequest(request),
      });
      const response = handleApiError(
        new AppError({
          code: "AUTH_REFRESH_REUSE",
          message: "Phiên đăng nhập không hợp lệ, vui lòng đăng nhập lại.",
          httpStatus: 401,
        }),
        requestId,
      );
      clearAuthCookies(response);
      return response;
    }

    if (status === "expired") {
      const response = handleApiError(unauthorized("Phiên đăng nhập đã hết hạn."), requestId);
      clearAuthCookies(response);
      return response;
    }

    const [user, profile] = await Promise.all([
      prisma.user.findUnique({ where: { id: record.userId } }),
      prisma.userProfile.findUnique({ where: { userId: record.userId } }),
    ]);

    // ADR-053: phòng thủ nhiều lớp — khoá user đã thu hồi token, nhưng phiên của user không còn ACTIVE thì không bao giờ được làm mới.
    // ADR-061 Q1 (ngoại lệ DUY NHẤT): phiên khách vãng lai (`guestCheckout`) của user PENDING chưa đặt mật khẩu vẫn làm mới được —
    // với chính sách phiên guest (absolute ≤ 24 giờ, không "Ghi nhớ").
    const guestSessionOk = Boolean(user && record.guestCheckout && user.status === "PENDING" && !user.hasPassword);
    if (!user || (user.status !== "ACTIVE" && !guestSessionOk)) {
      await prisma.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: now } });
      const response = handleApiError(
        user?.status === "LOCKED"
          ? new AppError({ code: "ACCOUNT_LOCKED", message: "Tài khoản đã bị khoá.", httpStatus: 401 })
          : unauthorized("Phiên đăng nhập không hợp lệ."),
        requestId,
      );
      clearAuthCookies(response);
      return response;
    }

    // ADR-053: idle/absolute đo ở server. Phiên tạo trước ADR-053 (sessionStartedAt NULL) tính từ lần rotate này.
    const policy = record.guestCheckout ? await getGuestSessionPolicy() : await getSessionPolicy(user.systemRole, record.rememberMe);
    const isLegacySession = record.sessionStartedAt === null;
    const sessionStartedAt = record.sessionStartedAt ?? now;
    const timeout = evaluateSessionTimeouts(
      { sessionStartedAt, lastActiveAt: isLegacySession ? now : record.createdAt },
      policy,
      now,
    );
    if (timeout !== "active") {
      await prisma.refreshToken.updateMany({ where: { familyId: record.familyId, revokedAt: null }, data: { revokedAt: now } });
      const response = handleApiError(
        timeout === "idle"
          ? new AppError({ code: "SESSION_IDLE_TIMEOUT", message: "Phiên đã hết do lâu không thao tác, vui lòng đăng nhập lại.", httpStatus: 401 })
          : new AppError({ code: "SESSION_EXPIRED", message: "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại.", httpStatus: 401 }),
        requestId,
      );
      clearAuthCookies(response);
      return response;
    }

    const rotated = issueRefreshToken(record.familyId, sessionExpiresAt(sessionStartedAt, policy));

    try {
      await prisma.$transaction(async (tx) => {
        const created = await tx.refreshToken.create({
          data: {
            userId: record.userId,
            familyId: rotated.familyId,
            tokenHash: rotated.tokenHash,
            expiresAt: rotated.expiresAt,
            userAgent: record.userAgent,
            ip: record.ip,
            rememberMe: policy.rememberMe,
            sessionStartedAt,
            deviceLabel: record.deviceLabel ?? describeUserAgent(record.userAgent),
            guestCheckout: record.guestCheckout,
          },
        });
        // Rotation nguyên tử (ADR-053): chỉ thay khi token cũ CHƯA bị request khác thay/thu hồi.
        const claimed = await tx.refreshToken.updateMany({
          where: { id: record.id, replacedById: null, revokedAt: null },
          data: { replacedById: created.id },
        });
        if (claimed.count !== 1) throw new RotationRaceLost();
      });
    } catch (error) {
      if (error instanceof RotationRaceLost) return supersededResponse(requestId);
      throw error;
    }

    const { accessToken, accessTtlSeconds } = await signSessionAccessToken(
      {
        userId: user.id,
        familyId: rotated.familyId,
        role: user.systemRole,
        emailVerified: Boolean(user.emailVerifiedAt),
        profileCompleted: isProfileComplete(profile),
        guestCheckout: record.guestCheckout,
      },
      policy,
    );

    const response = NextResponse.json({ ok: true });
    applyAuthCookies(response, {
      accessToken,
      accessTtlSeconds,
      refreshToken: rotated.token,
      refreshMaxAgeSeconds: refreshCookieMaxAgeSeconds(policy, rotated.expiresAt, now),
    });
    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
