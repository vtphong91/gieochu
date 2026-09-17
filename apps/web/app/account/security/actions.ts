"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { hashPassword, isValidPassword, verifyPassword } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { requireUser } from "../../../lib/session";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "../../../lib/cookies";

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string(),
});

export async function changePasswordAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = changePasswordSchema.safeParse({
    currentPassword: formData.get("currentPassword"),
    newPassword: formData.get("newPassword"),
  });
  if (!parsed.success) {
    redirect("/account/security?error=invalid");
  }

  const prisma = getPrismaClient();
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.userId } });
  const currentPasswordOk = await verifyPassword(dbUser.passwordHash, parsed.data.currentPassword);
  if (!currentPasswordOk) {
    redirect("/account/security?error=wrong_password");
  }
  if (!isValidPassword(parsed.data.newPassword)) {
    redirect("/account/security?error=weak_password");
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);
  await prisma.user.update({ where: { id: user.userId }, data: { passwordHash } });

  redirect("/account/security?success=password_changed");
}

/** "Đăng xuất mọi thiết bị": revokes every active refresh token family for this user. */
export async function logoutAllDevicesAction(): Promise<void> {
  const user = await requireUser();
  const prisma = getPrismaClient();
  await prisma.refreshToken.updateMany({
    where: { userId: user.userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });

  const store = await cookies();
  store.delete(ACCESS_COOKIE_NAME);
  store.delete(REFRESH_COOKIE_NAME);

  redirect("/login");
}
