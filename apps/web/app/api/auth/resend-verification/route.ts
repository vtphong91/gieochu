import { NextResponse } from "next/server";
import { z } from "zod";
import { createVerificationToken, normalizeEmail } from "@gieochu/auth";
import { logger, rateLimited } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { renderVerifyEmailTemplate } from "@gieochu/email";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../lib/api-response";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { sendEmailNow } from "../../../../lib/email-dispatch";
import { getEffectiveBrand } from "../../../../lib/branding";
import { getSystemSettings } from "../../../../lib/system-settings";
import { resendGuestActivation } from "../../../../lib/guest-checkout";

const resendSchema = z.object({ email: z.string().email("Email không hợp lệ.") });
const RESEND_LIMIT = 3;
const RESEND_WINDOW_MS = 60 * 60 * 1000;

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const { email: rawEmail } = await parseJsonBody(request, resendSchema);
    const email = normalizeEmail(rawEmail);

    if (!checkRateLimit(`resend-verification:${email}`, RESEND_LIMIT, RESEND_WINDOW_MS)) {
      throw rateLimited("Bạn đã yêu cầu gửi lại quá nhiều lần, vui lòng thử lại sau 1 giờ.");
    }

    const prisma = getPrismaClient();
    const user = await prisma.user.findUnique({ where: { email } });
    if (user && user.status === "PENDING" && !user.hasPassword) {
      // ADR-061 Q1 / Bổ sung ADR-062 mục 5, 7: tài khoản khách vãng lai → email "Kích hoạt tài khoản và đặt mật khẩu" (huỷ token
      // cũ, token mới 7 ngày), giới hạn 3 lần/email/giờ trên DB. Cùng câu trả lời bên dưới (không lộ email có tồn tại hay không).
      await resendGuestActivation(user.id, email);
    } else if (user && user.status === "PENDING") {
      const env = getEnv();
      const now = new Date();
      const [settings, brand] = await Promise.all([getSystemSettings(), getEffectiveBrand()]);
      const verification = createVerificationToken(settings.emailVerifyTtlHours, now);
      await prisma.verificationToken.create({
        data: {
          userId: user.id,
          type: "EMAIL_VERIFY",
          tokenHash: verification.tokenHash,
          expiresAt: verification.expiresAt,
        },
      });
      const verifyUrl = `${env.APP_URL}/verify-email?token=${verification.token}`;
      const rendered = renderVerifyEmailTemplate({ appName: brand.name, verifyUrl, expiresInHours: settings.emailVerifyTtlHours });
      const sent = await sendEmailNow({ type: "verify_email", to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
      if (!sent.ok) {
        logger.warn({ email: user.email, error: sent.error }, "resend-verification: gửi email thất bại");
      }
    }

    // Same response whether the email exists or not, to avoid enumeration.
    return NextResponse.json({
      message: "Nếu email tồn tại và chưa kích hoạt, chúng tôi đã gửi lại liên kết kích hoạt.",
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
