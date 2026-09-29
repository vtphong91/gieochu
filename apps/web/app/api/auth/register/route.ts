import { NextResponse } from "next/server";
import { z } from "zod";
import { createVerificationToken, isValidPassword, hashPassword, normalizeEmail } from "@gieochu/auth";
import { AppError, conflict, logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { renderVerifyEmailTemplate } from "@gieochu/email";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../lib/api-response";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { getClientIp } from "../../../../lib/request-meta";
import { sendEmailNow } from "../../../../lib/email-dispatch";
import { getEffectiveBrand } from "../../../../lib/branding";
import { getSystemSettings } from "../../../../lib/system-settings";

const registerSchema = z.object({
  email: z.string().email("Email không hợp lệ."),
  password: z.string(),
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên."),
  consent: z.boolean().refine((value) => value === true, {
    message: "Bạn cần đồng ý điều khoản và xử lý dữ liệu cá nhân.",
  }),
  // Không lưu vào DB — chỉ dùng để chọn nơi đưa user tới sau khi kích hoạt
  // email + hoàn thiện hồ sơ (TENANT -> mở gian hàng /studio, CUSTOMER -> trang
  // chủ). Trở thành Tenant vẫn là một hành động riêng, tự nguyện (tạo Tenant
  // row qua /studio) — trường này không gán role/tạo bản ghi gì cả.
  accountType: z.enum(["TENANT", "CUSTOMER"]),
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
    const settings = await getSystemSettings();
    const verification = createVerificationToken(settings.emailVerifyTtlHours, now);

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

    const next = body.accountType === "TENANT" ? "/studio" : "/";
    const verifyUrl = `${env.APP_URL}/verify-email?token=${verification.token}&next=${encodeURIComponent(next)}`;
    const brand = await getEffectiveBrand();
    const rendered = renderVerifyEmailTemplate({ appName: brand.name, verifyUrl, expiresInHours: settings.emailVerifyTtlHours });
    // Gửi SMTP đồng bộ ngay — không qua hàng đợi/worker. Không chặn đăng ký nếu gửi
    // lỗi (tài khoản vẫn tạo thành công, user có thể tự bấm "Gửi lại email kích hoạt").
    const sent = await sendEmailNow({ type: "verify_email", to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
    if (!sent.ok) {
      logger.warn({ email: user.email, error: sent.error }, "register: gửi email kích hoạt thất bại");
    }

    return NextResponse.json({ message: "Đăng ký thành công. Vui lòng kiểm tra email để kích hoạt tài khoản." }, {
      status: 201,
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
