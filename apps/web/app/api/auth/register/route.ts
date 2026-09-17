import { NextResponse } from "next/server";
import { z } from "zod";
import { createVerificationToken, isValidPassword, hashPassword, normalizeEmail } from "@gieochu/auth";
import { AppError, conflict } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { renderVerifyEmailTemplate } from "@gieochu/email";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../lib/api-response";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { getClientIp } from "../../../../lib/request-meta";
import { enqueueEmail } from "../../../../lib/jobs";

const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string(),
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên."),
  consent: z.boolean().refine((value) => value === true, {
    message: "Bạn cần đồng ý điều khoản và xử lý dữ liệu cá nhân.",
  }),
});

const EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = await parseJsonBody(request, registerSchema);
    const email = normalizeEmail(body.email);

    if (!isValidPassword(body.password)) {
      throw new AppError({
        code: "WEAK_PASSWORD",
        message: "Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số.",
        httpStatus: 400,
      });
    }

    const ip = getClientIp(request);
    if (!checkRateLimit(`register:${ip ?? "unknown"}`, 10, EMAIL_VERIFY_RATE_LIMIT_WINDOW_MS)) {
      throw new AppError({ code: "RATE_LIMITED", message: "Bạn thao tác quá nhanh, thử lại sau.", httpStatus: 429 });
    }

    const prisma = getPrismaClient();
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw conflict("EMAIL_ALREADY_REGISTERED", "Email này đã được đăng ký.");
    }

    const passwordHash = await hashPassword(body.password);
    const now = new Date();
    const env = getEnv();
    const verification = createVerificationToken(env.EMAIL_VERIFY_TTL_HOURS, now);

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          email,
          passwordHash,
          status: "PENDING",
          profile: {
            create: { fullName: body.fullName, consentAt: now },
          },
        },
      });
      await tx.verificationToken.create({
        data: {
          userId: created.id,
          type: "EMAIL_VERIFY",
          tokenHash: verification.tokenHash,
          expiresAt: verification.expiresAt,
        },
      });
      return created;
    });

    const verifyUrl = `${env.APP_URL}/verify-email?token=${verification.token}`;
    const rendered = renderVerifyEmailTemplate({ appName: env.APP_NAME, verifyUrl });
    await enqueueEmail({ to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });

    return NextResponse.json({ message: "Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản." }, {
      status: 201,
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
