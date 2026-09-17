import { NextResponse, type NextRequest } from "next/server";
import {
  evaluateRefreshToken,
  hashOpaqueToken,
  isProfileComplete,
  rotateRefreshToken,
  signAccessToken,
} from "@gieochu/auth";
import { AppError, unauthorized } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { applyAuthCookies, clearAuthCookies, REFRESH_COOKIE_NAME } from "../../../../lib/cookies";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../../../lib/jwt-context";
import { getRequestId, handleApiError } from "../../../../lib/api-response";

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
      await prisma.refreshToken.updateMany({
        where: { familyId: record.familyId, revokedAt: null },
        data: { revokedAt: now },
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

    const env = getEnv();
    const rotated = rotateRefreshToken(record.familyId, env.REFRESH_TOKEN_TTL_DAYS, now);
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

    const accessTtl = getAccessTokenTtlSeconds();
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
      refreshTtlSeconds: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
