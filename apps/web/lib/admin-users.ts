import { createVerificationToken } from "@gieochu/auth";
import { AppError, decideLockUser, forbidden, notFound } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import { renderVerifyEmailTemplate } from "@gieochu/email";
import { EMAIL_NOT_CONFIGURED, emailNotConfiguredError, sendEmailNow } from "./email-dispatch";
import { getEffectiveBrand } from "./branding";
import { getSystemSettings } from "./system-settings";
import { audit } from "./audit";
import type { CurrentUser } from "./session";

/** §"M2" Khoá user: từ chối tự khoá/khoá super admin, thu hồi mọi refresh token khi cho phép. */
export async function lockUser(actor: CurrentUser, targetUserId: string): Promise<void> {
  const prisma = getPrismaClient();
  const target = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!target) throw notFound("Không tìm thấy user.");

  const decision = decideLockUser(actor.userId, { id: target.id, isSuperAdmin: target.isSuperAdmin });
  if (!decision.allowed) {
    throw new AppError({
      code: `LOCK_REJECTED_${decision.reason}`,
      message: decision.reason === "SELF" ? "Bạn không thể tự khoá chính mình." : "Không thể khoá super admin.",
      httpStatus: 400,
    });
  }

  const now = new Date();
  const [, revoked] = await prisma.$transaction([
    prisma.user.update({ where: { id: targetUserId }, data: { status: "LOCKED" } }),
    prisma.refreshToken.updateMany({ where: { userId: targetUserId, revokedAt: null }, data: { revokedAt: now } }),
  ]);
  // Đặc tả §"M2" ghi "USER_LOCKED + lý do" — form khoá hiện chưa có ô lý do (chưa xây), nên metadata chưa có `reason`.
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    action: "USER_LOCKED",
    targetType: "User",
    targetId: targetUserId,
    metadata: { previousStatus: target.status, revokedSessions: revoked.count },
  });
}

export async function unlockUser(actor: CurrentUser, targetUserId: string): Promise<void> {
  const prisma = getPrismaClient();
  const updated = await prisma.user.update({ where: { id: targetUserId }, data: { status: "ACTIVE" } });
  await audit.log({ actorId: actor.userId, scope: "SYSTEM", action: "USER_UNLOCKED", targetType: "User", targetId: updated.id });
}

export async function resendVerificationForUser(targetUserId: string): Promise<void> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user || user.status !== "PENDING") {
    throw new AppError({ code: "NOT_PENDING", message: "User không ở trạng thái chờ kích hoạt.", httpStatus: 400 });
  }

  const env = getEnv();
  const now = new Date();
  const [settings, brand] = await Promise.all([getSystemSettings(), getEffectiveBrand()]);
  const verification = createVerificationToken(settings.emailVerifyTtlHours, now);
  await prisma.verificationToken.create({
    data: { userId: user.id, type: "EMAIL_VERIFY", tokenHash: verification.tokenHash, expiresAt: verification.expiresAt },
  });
  const verifyUrl = `${env.APP_URL}/verify-email?token=${verification.token}`;
  const rendered = renderVerifyEmailTemplate({ appName: brand.name, verifyUrl, expiresInHours: settings.emailVerifyTtlHours });
  const result = await sendEmailNow({ type: "verify_email", to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
  if (!result.ok) {
    if (result.code === EMAIL_NOT_CONFIGURED) throw emailNotConfiguredError();
    throw new AppError({ code: "EMAIL_SEND_FAILED", message: `Gửi email thất bại: ${result.error}`, httpStatus: 502 });
  }
}

/** §"M2": chỉ super admin mới được cấp quyền SYSTEM_ADMIN. */
export async function grantSystemAdmin(actor: CurrentUser, targetUserId: string): Promise<void> {
  const prisma = getPrismaClient();
  const actorRecord = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (!actorRecord.isSuperAdmin) {
    throw forbidden("Chỉ super admin mới được cấp quyền quản trị hệ thống.");
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { systemRole: "SYSTEM_ADMIN" } });
}
