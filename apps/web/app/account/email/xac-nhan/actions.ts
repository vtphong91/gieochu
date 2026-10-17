"use server";

import { headers } from "next/headers";
import { extractAuditIp } from "@gieochu/core";
import { confirmEmailChange, type ConfirmEmailChangeState } from "../../../../lib/account-security";
import { accountErrorState, formString } from "../../../../lib/account-state";
import { getCurrentUser } from "../../../../lib/session";

/**
 * ADR-041 C5 — xác nhận đổi email bằng nút bấm (POST; GET trang chỉ hiển thị để trình quét link trong hộp thư không tự
 * kích hoạt). KHÔNG yêu cầu đăng nhập — quyền dựa trên token (hash SHA-256) gửi tới email mới. `token` lấy từ ô ẩn.
 * Lỗi: `INVALID_TOKEN` | `TOKEN_EXPIRED` | `TOKEN_USED` | `EMAIL_TAKEN` | `ACCOUNT_LOCKED` | `RATE_LIMITED`.
 */
export async function confirmEmailChangeAction(_prev: ConfirmEmailChangeState, formData: FormData): Promise<ConfirmEmailChangeState> {
  try {
    const store = await headers();
    const ip = extractAuditIp(store.get("x-forwarded-for"), store.get("x-real-ip"));
    return await confirmEmailChange(formString(formData, "token"), ip, await getCurrentUser());
  } catch (error) {
    return accountErrorState(error, "confirmEmailChangeAction");
  }
}
