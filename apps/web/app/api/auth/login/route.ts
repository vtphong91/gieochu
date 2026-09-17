import { NextResponse } from "next/server";
import { z } from "zod";
import { createRefreshToken, isProfileComplete, normalizeEmail, signAccessToken, verifyPassword } from "@gieochu/auth";
import { AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../../../lib/jwt-context";
import { applyAuthCookies } from "../../../../lib/cookies";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../lib/api-response";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { getClientIp } from "../../../../lib/request-meta";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(1),
});

const INVALID_CREDENTIALS = new AppError({
  code: "INVALID_CREDENTIALS",
  message: "Email hoặc mật khẩu không đúng.",
  httpStatus: 401,
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = await parseJsonBody(request, loginSchema);
    const email = normalizeEmail(body.email);

    if (!checkRateLimit(`login:${email}`, 10, 15 * 60 * 1000)) {
      throw new AppError({ code: "RATE_LIMITED", message: "Bạn thao tác quá nhanh, thử lại sau.", httpStatus: 429 });
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) throw INVALID_CREDENTIALS;

    if (user.status === "LOCKED") {
      throw new AppError({ code: "ACCOUNT_LOCKED", message: "Tài khoản đã bị khoá.", httpStatus: 403 });
    }

    const passwordOk = await verifyPassword(user.passwordHash, body.password);
    if (!passwordOk) throw INVALID_CREDENTIALS;

    if (user.status === "PENDING") {
      throw new AppError({
        code: "EMAIL_NOT_VERIFIED",
        message: "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email hoặc gửi lại liên kết kích hoạt.",
        httpStatus: 403,
      });
    }

    const now = new Date();
    const familyId = crypto.randomUUID();
    const env = getEnv();
    const refresh = createRefreshToken(familyId, env.REFRESH_TOKEN_TTL_DAYS, now);
    const ip = getClientIp(request);
    const userAgent = request.headers.get("user-agent") ?? undefined;

    const [, profile] = await prisma.$transaction([
      prisma.refreshToken.create({
        data: {
          userId: user.id,
          familyId,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
          userAgent,
          ip,
        },
      }),
      prisma.userProfile.findUnique({ where: { userId: user.id } }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now } }),
    ]);

    const profileCompleted = isProfileComplete(profile);
    const accessTtl = getAccessTokenTtlSeconds();
    const accessToken = await signAccessToken(
      { sub: user.id, sid: familyId, role: user.systemRole, ver: true, pc: profileCompleted },
      getJwtContext(),
      accessTtl,
    );

    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.systemRole, profileCompleted },
    });
    applyAuthCookies(response, {
      accessToken,
      accessTtlSeconds: accessTtl,
      refreshToken: refresh.token,
      refreshTtlSeconds: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
    });
    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
