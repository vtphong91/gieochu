import { NextResponse, type NextRequest } from "next/server";
import { hashOpaqueToken } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { clearAuthCookies, REFRESH_COOKIE_NAME } from "../../../../lib/cookies";
import { getRequestId, handleApiError } from "../../../../lib/api-response";

export async function POST(request: NextRequest) {
  const requestId = getRequestId(request);
  try {
    const rawToken = request.cookies.get(REFRESH_COOKIE_NAME)?.value;
    if (rawToken) {
      const tokenHash = hashOpaqueToken(rawToken);
      const prisma = getPrismaClient();
      const record = await prisma.refreshToken.findUnique({ where: { tokenHash } });
      if (record) {
        await prisma.refreshToken.updateMany({
          where: { familyId: record.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    }

    const response = NextResponse.json({ message: "Đã đăng xuất." });
    clearAuthCookies(response);
    return response;
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
