"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getPrismaClient } from "@gieochu/db";
import {
  cancelEmailChange,
  changePassword,
  requestEmailChange,
  resendEmailChange,
  type ChangePasswordState,
  type EmailChangeState,
} from "../../../lib/account-security";
import { accountErrorState } from "../../../lib/account-state";
import { requireUser, requireVerified } from "../../../lib/session";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "../../../lib/cookies";

/**
 * ADR-041 C3 — đổi mật khẩu (`useActionState`): `currentPassword`, `newPassword`. Lỗi theo ô; thành công thu hồi
 * mọi phiên khác (giữ phiên hiện tại), email báo, audit.
 */
export async function changePasswordAction(_prev: ChangePasswordState, formData: FormData): Promise<ChangePasswordState> {
  try {
    return await changePassword(await requireVerified(), formData);
  } catch (error) {
    return accountErrorState(error, "changePasswordAction");
  }
}

/** ADR-041 C4 — yêu cầu đổi email: `newEmail`, `currentPassword` → `{ ok, message, pendingEmail }`. */
export async function requestEmailChangeAction(_prev: EmailChangeState, formData: FormData): Promise<EmailChangeState> {
  try {
    const state = await requestEmailChange(await requireVerified(), formData);
    if (state?.ok) revalidatePath("/account", "layout");
    return state;
  } catch (error) {
    return accountErrorState(error, "requestEmailChangeAction");
  }
}

/** ADR-041 C4 — gửi lại link cho yêu cầu đang chờ. Không nhận tham số (dùng được với `useActionState` hoặc gọi trực tiếp). */
export async function resendEmailChangeAction(): Promise<EmailChangeState> {
  try {
    const state = await resendEmailChange(await requireVerified());
    if (state?.ok) revalidatePath("/account", "layout");
    return state;
  } catch (error) {
    return accountErrorState(error, "resendEmailChangeAction");
  }
}

/** ADR-041 C4 — huỷ yêu cầu đổi email đang chờ. */
export async function cancelEmailChangeAction(): Promise<EmailChangeState> {
  try {
    const state = await cancelEmailChange(await requireVerified());
    revalidatePath("/account", "layout");
    return state;
  } catch (error) {
    return accountErrorState(error, "cancelEmailChangeAction");
  }
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
  // Cookie refresh đặt với Path=/api/auth — phải xoá đúng path, không thì cookie còn lại trên trình duyệt.
  store.delete({ name: REFRESH_COOKIE_NAME, path: "/api/auth" });

  redirect("/login");
}
