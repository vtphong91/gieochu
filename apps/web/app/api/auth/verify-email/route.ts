import { NextResponse } from "next/server";
import { z } from "zod";
import { evaluateVerificationToken, hashOpaqueToken } from "@gieochu/auth";
import { AppError } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../lib/api-response";

const verifyEmailSchema = z.object({ token: z.string().min(1) });

export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const { token } = await parseJsonBody(request, verifyEmailSchema);
    const tokenHash = hashOpaqueToken(token);

    const prisma = getPrismaClient();
    const record = await prisma.verificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.type !== "EMAIL_VERIFY") {
      throw new AppError({ code: "INVALID_TOKEN", message: "Liên kết kích hoạt không hợp lệ.", httpStatus: 400 });
    }

    const now = new Date();
    const status = evaluateVerificationToken(record, now);
    if (status === "used") {
      throw new AppError({ code: "TOKEN_ALREADY_USED", message: "Liên kết kích hoạt đã được sử dụng.", httpStatus: 400 });
    }
    if (status === "expired") {
      throw new AppError({ code: "TOKEN_EXPIRED", message: "Liên kết kích hoạt đã hết hạn.", httpStatus: 400 });
    }

    await prisma.$transaction([
      prisma.verificationToken.update({ where: { id: record.id }, data: { usedAt: now } }),
      prisma.user.update({ where: { id: record.userId }, data: { status: "ACTIVE", emailVerifiedAt: now } }),
    ]);

    return NextResponse.json({ message: "Kích hoạt tài khoản thành công." });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
