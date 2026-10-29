"use server";

import { redirect } from "next/navigation";
import { activateGuestAccount } from "../../../../lib/guest-checkout";

export interface ActivateGuestState {
  error?: string;
  code?: string;
}

/**
 * ADR-061 Q1 — "Kích hoạt tài khoản và đặt mật khẩu": token `GUEST_ACTIVATION` một lần (chỉ so hash) → đặt mật khẩu, xác minh
 * email, ACTIVE. Server Action (CSRF sẵn của Next.js). Thành công → trang đăng nhập (không tự đăng nhập — phiên mới đi qua luồng
 * đăng nhập thường, áp chính sách phiên ADR-053).
 */
export async function activateGuestAccountAction(token: string, _prevState: ActivateGuestState, formData: FormData): Promise<ActivateGuestState> {
  const result = await activateGuestAccount(token, formData.get("password"), formData.get("confirmPassword"));
  if (!result.ok) return { error: result.error, code: result.code };
  redirect(`/login?da-kich-hoat=1&next=${encodeURIComponent("/account/library")}`);
}
