import { NextResponse } from "next/server";
import { z } from "zod";
import { createVerificationToken, normalizeEmail } from "@gieochu/auth";
import { logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { renderResetPasswordEmailTemplate } from "@gieochu/email";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../lib/api-response";
import { checkRateLimit } from "../../../../lib/rate-limit";
import { sendEmailNow } from "../../../../lib/email-dispatch";
import { getEffectiveBrand } from "../../../../lib/branding";
import { getSystemSettings } from "../../../../lib/system-settings";

const forgotPasswordSchema = z.object({ email: z.string().email("Email không hợp lệ.") });
const GENERIC_MESSAGE = "Nếu email tồn tại, chúng tôi đã gửi hướng dẫn đặt lại mật khẩu.";

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const { email: rawEmail } = await parseJsonBody(request, forgotPasswordSchema);
    const email = normalizeEmail(rawEmail);

    // §M1 quy tắc: "forgot-password luôn trả 200" — rate limit silently caps
    // abuse without ever changing the response shape or status.
    if (checkRateLimit(`forgot-password:${email}`, 5, 60 * 60 * 1000)) {
      const prisma = getPrismaClient();
      const user = await prisma.user.findUnique({ where: { email } });
      if (user && user.status === "ACTIVE") {
        const env = getEnv();
        const now = new Date();
        const [settings, brand] = await Promise.all([getSystemSettings(), getEffectiveBrand()]);
        const verification = createVerificationToken(settings.passwordResetTtlMinutes / 60, now);
        await prisma.verificationToken.create({
          data: {
            userId: user.id,
            type: "PASSWORD_RESET",
            tokenHash: verification.tokenHash,
            expiresAt: verification.expiresAt,
          },
        });
        const resetUrl = `${env.APP_URL}/reset-password?token=${verification.token}`;
        const rendered = renderResetPasswordEmailTemplate({ appName: brand.name, resetUrl, expiresInMinutes: settings.passwordResetTtlMinutes });
        const sent = await sendEmailNow({ type: "reset_password", to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
        if (!sent.ok) {
          logger.warn({ email: user.email, error: sent.error }, "forgot-password: gửi email thất bại");
        }
      }
    }

    return NextResponse.json({ message: GENERIC_MESSAGE });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
