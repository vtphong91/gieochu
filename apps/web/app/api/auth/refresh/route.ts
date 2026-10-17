import { NextResponse, type NextRequest } from "next/server";
import {
  evaluateRefreshToken,
  hashOpaqueToken,
  isProfileComplete,
  rotateRefreshToken,
  signAccessToken,
} from "@gieochu/auth";
import { AppError, unauthorized } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { applyAuthCookies, clearAuthCookies, REFRESH_COOKIE_NAME } from "../../../../lib/cookies";
import { getAccessTokenTtlSeconds, getJwtContext, getRefreshTokenTtl } from "../../../../lib/jwt-context";
import { getRequestId, handleApiError } from "../../../../lib/api-response";
import { audit, auditMetaFromRequest } from "../../../../lib/audit";

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
    const status = evaluateRefreshToken(record, now);

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

    const [refreshTtl, accessTtl] = await Promise.all([getRefreshTokenTtl(), getAccessTokenTtlSeconds()]);
    const rotated = rotateRefreshToken(record.familyId, refreshTtl.days, now);
    const [user, profile] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: record.userId } }),
      prisma.userProfile.findUnique({ where: { userId: record.userId } }),
    ]);

    await prisma.$transaction(async (tx) => {
      const created = await tx.refreshToken.create({
        data: {
          userId: record.userId,
          familyId: rotated.familyId,
          tokenHash: rotated.tokenHash,
          expiresAt: rotated.expiresAt,
        },
      });
      await tx.refreshToken.update({ where: { id: record.id }, data: { replacedById: created.id } });
    });

    const accessToken = await signAccessToken(
      {
        sub: user.id,
        sid: rotated.familyId,
        role: user.systemRole,
        ver: Boolean(user.emailVerifiedAt),
        pc: isProfileComplete(profile),
      },
      getJwtContext(),
      accessTtl,
    );

    const response = NextResponse.json({ ok: true });
    applyAuthCookies(response, {
      accessToken,
      accessTtlSeconds: accessTtl,
      refreshToken: rotated.token,
      refreshTtlSeconds: refreshTtl.seconds,
    });
    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
