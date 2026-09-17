"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isProfileComplete, signAccessToken } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { requireUser } from "../../../lib/session";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../../lib/jwt-context";
import { ACCESS_COOKIE_NAME } from "../../../lib/cookies";

const profileSchema = z.object({
  fullName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  occupation: z.string().trim().min(1),
  province: z.string().trim().min(1),
  next: z.string().optional(),
});

/** Server Action backing /account/profile — §"M1" "Chặn hoàn thiện hồ sơ" flow. */
export async function completeProfileAction(formData: FormData): Promise<void> {
  const currentUser = await requireUser();
  const parsed = profileSchema.safeParse({
    fullName: formData.get("fullName"),
    phone: formData.get("phone"),
    occupation: formData.get("occupation"),
    province: formData.get("province"),
    next: formData.get("next") ?? undefined,
  });

  if (!parsed.success) {
    redirect("/account/profile?complete=1&error=1");
  }

  const { next, ...profileData } = parsed.data;
  const prisma = getPrismaClient();
  const now = new Date();

  const updatedProfile = await prisma.userProfile.update({
    where: { userId: currentUser.userId },
    data: profileData,
  });

  const complete = isProfileComplete(updatedProfile);
  const user = await prisma.user.update({
    where: { id: currentUser.userId },
    data: complete ? { profileCompletedAt: now } : {},
  });

  // Re-issue the access token so its `pc` claim reflects the update immediately.
  const accessTtl = getAccessTokenTtlSeconds();
  const accessToken = await signAccessToken(
    {
      sub: user.id,
      sid: currentUser.familyId,
      role: user.systemRole,
      ver: Boolean(user.emailVerifiedAt),
      pc: complete,
    },
    getJwtContext(),
    accessTtl,
  );

  const store = await cookies();
  store.set(ACCESS_COOKIE_NAME, accessToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: accessTtl,
  });

  if (!complete) {
    redirect("/account/profile?complete=1");
  }
  const destination = next && next.startsWith("/") ? next : "/account/library";
  redirect(destination);
}
