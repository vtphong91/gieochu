import { NextResponse } from "next/server";
import { z } from "zod";
import {
  describeUserAgent,
  isProfileComplete,
  issueRefreshToken,
  normalizeEmail,
  refreshCookieMaxAgeSeconds,
  sessionExpiresAt,
  verifyPassword,
} from "@gieochu/auth";
import { AppError } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { getSessionPolicy } from "../../../../lib/jwt-context";
import { signSessionAccessToken } from "../../../../lib/session-access";
import { applyAuthCookies } from "../../../../lib/cookies";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../lib/api-response";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { getClientIp } from "../../../../lib/request-meta";
import { resolveLandingPath } from "../../../../lib/landing-path";
import { audit, auditMetaFromRequest } from "../../../../lib/audit";

const loginSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string().min(1),
  /** ADR-053: "Ghi nhớ đăng nhập" (mặc định tắt). SYSTEM_ADMIN: server bỏ qua (`resolveSessionPolicy`). */
  rememberMe: z.boolean().optional().default(false),
});

const INVALID_CREDENTIALS = new AppError({
  code: "INVALID_CREDENTIALS",
  message: "Email hoặc mật khẩu không đúng.",
  httpStatus: 401,
});

// Ngưỡng khoá tạm sau nhiều lần sai mật khẩu liên tiếp — chỉ đếm khi email có
// thật (không đếm cho email không tồn tại, tránh tạo cớ khoá tài khoản người
// khác chỉ bằng cách đoán email). Đạt ngưỡng -> bắt buộc qua /forgot-password,
// không mở lại được chỉ bằng cách nhập đúng mật khẩu cũ nữa.
const MAX_FAILED_LOGIN_ATTEMPTS = 5;

const PASSWORD_RESET_REQUIRED = new AppError({
  code: "PASSWORD_RESET_REQUIRED",
  message: "Tài khoản đã bị khoá tạm thời do đăng nhập sai quá nhiều lần. Vui lòng đặt lại mật khẩu để tiếp tục.",
  httpStatus: 403,
});

// ADR-073: quản trị viên bật `passwordResetRequired` qua `requestUserPasswordReset` (không tăng `failedLoginAttempts`) →
// cùng mã/HTTP status (login-form.tsx map theo mã để hiện lối "Quên mật khẩu"), chỉ khác câu báo.
const ADMIN_PASSWORD_RESET_REQUIRED = new AppError({
  code: "PASSWORD_RESET_REQUIRED",
  message:
    "Tài khoản của bạn cần đặt lại mật khẩu trước khi đăng nhập. Vui lòng dùng liên kết trong email chúng tôi đã gửi hoặc chọn \"Quên mật khẩu\".",
  httpStatus: 403,
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
    // ADR-037: email không tồn tại KHÔNG ghi audit (bảng chỉ-INSERT giữ 12 tháng — tránh bị spam dòng bằng email
    // ngẫu nhiên; không lưu email người lạ). Mọi lần thất bại của tài khoản có thật đều ghi AUTH_LOGIN_FAILED.
    if (!user) throw INVALID_CREDENTIALS;
    const requestMeta = auditMetaFromRequest(request);
    const auditLoginFailed = (reason: string, extra: Record<string, unknown> = {}) =>
      audit.log({
        actorId: user.id,
        scope: "SYSTEM",
        action: "AUTH_LOGIN_FAILED",
        targetType: "User",
        targetId: user.id,
        metadata: { reason, ...extra },
        ...requestMeta,
      });

    if (user.status === "LOCKED") {
      await auditLoginFailed("ACCOUNT_LOCKED");
      throw new AppError({ code: "ACCOUNT_LOCKED", message: "Tài khoản đã bị khoá.", httpStatus: 403 });
    }

    // ADR-061 Q1: tài khoản tạo lúc mua không cần đăng ký — chưa có mật khẩu (hash ngẫu nhiên) → báo rõ để khách gửi lại email
    // "Kích hoạt tài khoản và đặt mật khẩu" (Bổ sung ADR-062 mục 4). Không so mật khẩu, không tăng đếm sai mật khẩu.
    if (!user.hasPassword && user.status === "PENDING") {
      await auditLoginFailed("GUEST_NOT_ACTIVATED");
      throw new AppError({
        code: "GUEST_NOT_ACTIVATED",
        message: "Tài khoản này được tạo khi mua tài liệu và chưa đặt mật khẩu. Kiểm tra email \"Kích hoạt tài khoản và đặt mật khẩu\" hoặc gửi lại email kích hoạt.",
        httpStatus: 403,
      });
    }

    if (user.passwordResetRequired) {
      await auditLoginFailed("PASSWORD_RESET_REQUIRED");
      // Đạt ngưỡng sai mật khẩu → câu "khoá tạm thời"; còn lại là do quản trị viên yêu cầu (ADR-073).
      throw user.failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS ? PASSWORD_RESET_REQUIRED : ADMIN_PASSWORD_RESET_REQUIRED;
    }

    const passwordOk = await verifyPassword(user.passwordHash, body.password);
    if (!passwordOk) {
      const failedLoginAttempts = user.failedLoginAttempts + 1;
      const lockedOut = failedLoginAttempts >= MAX_FAILED_LOGIN_ATTEMPTS;
      await prisma.user.update({
        where: { id: user.id },
        data: { failedLoginAttempts, passwordResetRequired: lockedOut },
      });
      await auditLoginFailed("WRONG_PASSWORD", { failedAttempts: failedLoginAttempts, lockedOut });
      throw lockedOut ? PASSWORD_RESET_REQUIRED : INVALID_CREDENTIALS;
    }

    if (user.status === "PENDING") {
      await auditLoginFailed("EMAIL_NOT_VERIFIED");
      throw new AppError({
        code: "EMAIL_NOT_VERIFIED",
        message: "Tài khoản chưa được kích hoạt. Vui lòng kiểm tra email hoặc gửi lại liên kết kích hoạt.",
        httpStatus: 403,
      });
    }

    const now = new Date();
    const familyId = crypto.randomUUID();
    // ADR-053: chính sách phiên theo vai trò + "Ghi nhớ"; hạn refresh = lúc đăng nhập + absolute (không trượt).
    const policy = await getSessionPolicy(user.systemRole, body.rememberMe);
    const refresh = issueRefreshToken(familyId, sessionExpiresAt(now, policy));
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
          rememberMe: policy.rememberMe,
          sessionStartedAt: now,
          deviceLabel: describeUserAgent(userAgent),
        },
      }),
      prisma.userProfile.findUnique({ where: { userId: user.id } }),
      prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, failedLoginAttempts: 0 } }),
    ]);

    await audit.log({ actorId: user.id, scope: "SYSTEM", action: "AUTH_LOGIN", targetType: "User", targetId: user.id, ...requestMeta });

    const profileCompleted = isProfileComplete(profile);
    const { accessToken, accessTtlSeconds } = await signSessionAccessToken(
      { userId: user.id, familyId, role: user.systemRole, emailVerified: true, profileCompleted },
      policy,
    );

    const landingPath = await resolveLandingPath({ userId: user.id, role: user.systemRole });
    const response = NextResponse.json({
      user: { id: user.id, email: user.email, role: user.systemRole, profileCompleted, landingPath },
    });
    applyAuthCookies(response, {
      accessToken,
      accessTtlSeconds,
      refreshToken: refresh.token,
      refreshMaxAgeSeconds: refreshCookieMaxAgeSeconds(policy, refresh.expiresAt, now),
    });
    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
