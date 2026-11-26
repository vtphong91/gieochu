"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../lib/session";
import {
  lockUser,
  requestUserPasswordReset,
  resendVerificationForUser,
  revealUserPhone,
  revokeUserSessions,
  unlockUser,
  USER_ADMIN_ERROR_CODES,
  USER_LOCK_REASON_MAX_LENGTH,
} from "../../../lib/admin-users";

export interface UserLockState {
  error?: string;
  reasonError?: string;
  success?: boolean;
  emailSent?: boolean;
}

export interface UserActionState {
  error?: string;
  success?: boolean;
  emailSent?: boolean;
  revokedCount?: number;
}

export interface RevealPhoneState {
  phone?: string;
  error?: string;
}

const REASON_ERROR = `Hãy nhập lý do (tối đa ${USER_LOCK_REASON_MAX_LENGTH} ký tự).`;

/** Danh sách + trang chi tiết người dùng (route động → mẫu + `"page"`, Next 16 `revalidatePath`). */
function revalidateUserPages(): void {
  revalidatePath("/admin/users");
  revalidatePath("/admin/users/[userId]", "page");
}

function toLockState(error: unknown): UserLockState {
  if (error instanceof AppError) {
    if (error.code === USER_ADMIN_ERROR_CODES.REASON_INVALID) return { reasonError: REASON_ERROR };
    return { error: error.message };
  }
  throw error;
}

function toActionState(error: unknown): UserActionState {
  if (error instanceof AppError) return { error: error.message };
  throw error;
}

/** ADR-073 — khoá tài khoản từ hộp xác nhận (lý do bắt buộc, gửi cho người dùng). Điều kiện kiểm lại ở server. */
export async function lockUserAction(userId: string, _prev: UserLockState, formData: FormData): Promise<UserLockState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  let emailSent: boolean;
  try {
    ({ emailSent } = await lockUser(actor, userId, formData.get("reason")));
  } catch (error) {
    return toLockState(error);
  }
  revalidateUserPages();
  return { success: true, emailSent };
}

/** ADR-073 — mở khoá (về PENDING nếu chưa xác minh email, ngược lại ACTIVE), lý do bắt buộc (gửi cho người dùng). */
export async function unlockUserAction(userId: string, _prev: UserLockState, formData: FormData): Promise<UserLockState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  let emailSent: boolean;
  try {
    ({ emailSent } = await unlockUser(actor, userId, formData.get("reason")));
  } catch (error) {
    return toLockState(error);
  }
  revalidateUserPages();
  return { success: true, emailSent };
}

/** ADR-073 — "Đăng xuất mọi thiết bị": thu hồi mọi phiên còn hiệu lực (không với chính mình / siêu quản trị). */
export async function revokeUserSessionsAction(userId: string): Promise<UserActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  let revokedCount: number;
  try {
    ({ revokedCount } = await revokeUserSessions(actor, userId));
  } catch (error) {
    return toActionState(error);
  }
  revalidateUserPages();
  return { success: true, revokedCount };
}

/** ADR-073 — "Yêu cầu đặt lại mật khẩu": bật cờ bắt đặt lại + thu hồi mọi phiên + email đặt lại (token chỉ lưu hash). */
export async function requestUserPasswordResetAction(userId: string): Promise<UserActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  let result: { revokedCount: number; emailSent: boolean };
  try {
    result = await requestUserPasswordReset(actor, userId);
  } catch (error) {
    return toActionState(error);
  }
  revalidateUserPages();
  return { success: true, emailSent: result.emailSent, revokedCount: result.revokedCount };
}

/** ADR-073 mục 2 — số điện thoại đầy đủ cho đúng lần xem này (audit trước khi trả; không đưa vào HTML ban đầu). */
export async function revealUserPhoneAction(userId: string): Promise<RevealPhoneState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  try {
    return { phone: await revealUserPhone(actor, userId) };
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
}

export interface ResendVerificationActionState {
  error?: string;
  success?: boolean;
}

/** Gửi lại email kích hoạt (PENDING) — audit `USER_VERIFICATION_RESENT`, 1 lần/60 giây/người dùng. */
export async function resendVerificationAdminAction(userId: string): Promise<ResendVerificationActionState> {
  const actor = await requireRole("SYSTEM_ADMIN");
  try {
    await resendVerificationForUser(actor, userId);
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    throw error;
  }
  revalidateUserPages();
  return { success: true };
}
