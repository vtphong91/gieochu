import { NextResponse } from "next/server";
import { getPrismaClient } from "@gieochu/db";
import { requireUser } from "../../../lib/session";
import { getRequestId, handleApiError } from "../../../lib/api-response";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    const currentUser = await requireUser();
    const prisma = getPrismaClient();
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: currentUser.userId },
      include: { profile: true },
    });

    return NextResponse.json({
      id: user.id,
      email: user.email,
      role: user.systemRole,
      status: user.status,
      emailVerified: Boolean(user.emailVerifiedAt),
      profileCompleted: Boolean(user.profileCompletedAt),
      profile: user.profile
        ? {
            fullName: user.profile.fullName,
            phone: user.profile.phone,
            occupation: user.profile.occupation,
            province: user.profile.province,
          }
        : null,
    });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
