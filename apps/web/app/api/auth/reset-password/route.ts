import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateVerificationToken, hashOpaqueToken, hashPassword, isValidPassword } from "@gieochu/auth";
import { AppError } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../lib/api-response";

const resetPasswordSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string(),
});

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const body = await parseJsonBody(request, resetPasswordSchema);
    if (!isValidPassword(body.newPassword)) {
      throw new AppError({
        code: "WEAK_PASSWORD",
        message: "Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số.",
        httpStatus: 400,
      });
    }

    const tokenHash = hashOpaqueToken(body.token);
    const prisma = getPrismaClient();
    const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.type !== "PASSWORD_RESET") {
      throw new AppError({ code: "INVALID_TOKEN", message: "Liên kết đặt lại mật khẩu không hợp lệ.", httpStatus: 400 });
    }

    const now = new Date();
    const status = evaluateVerificationToken(record, now);
    if (status === "used") {
      throw new AppError({ code: "TOKEN_ALREADY_USED", message: "Liên kết đã được sử dụng.", httpStatus: 400 });
    }
    if (status === "expired") {
      throw new AppError({ code: "TOKEN_EXPIRED", message: "Liên kết đã hết hạn.", httpStatus: 400 });
    }

    const passwordHash = await hashPassword(body.newPassword);
    await prisma.$transaction([
      prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: now } }),
      prisma.user.update({ where: { id: record.userId }, data: { passwordHash } }),
      // §M1: đặt lại mật khẩu thành công thu hồi mọi refresh token đang hoạt động.
      prisma.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now } }),
    ]);

    return NextResponse.json({ message: "Đặt lại mật khẩu thành công." });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
