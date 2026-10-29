"use client";

import { useActionState } from "react";
import Link from "next/link";
import { activateGuestAccountAction, type ActivateGuestState } from "./actions";
import { ErrorBanner, PasswordField, SubmitButton } from "../../_ui/fields";

const initialState: ActivateGuestState = {};
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
const ACTION_LINK = `flex min-h-11 items-center justify-center rounded-lg border bg-white px-3.5 text-sm font-semibold text-[color:var(--color-primary)] transition-colors hover:bg-gray-50 motion-reduce:transition-none ${FOCUS}`;

/**
 * Form đặt mật khẩu (ADR-061 Q1). Mật khẩu chỉ gửi qua Server Action, không lưu ở client.
 * Trình bày lỗi theo `code` của action: lỗi mật khẩu (`WEAK_PASSWORD`, `PASSWORD_MISMATCH`) đặt ngay dưới ô tương ứng; lỗi
 * liên kết (`INVALID_TOKEN`, `TOKEN_EXPIRED`, `TOKEN_ALREADY_USED`) hiện hộp lỗi + lối ra (gửi lại email / đăng nhập).
 */
export function ActivateGuestForm({ token, resendHref }: { token: string; resendHref: string }) {
  const action = activateGuestAccountAction.bind(null, token);
  const [state, formAction, pending] = useActionState(action, initialState);
  const passwordError = state.code === "WEAK_PASSWORD" ? state.error : undefined;
  const confirmError = state.code === "PASSWORD_MISMATCH" ? state.error : undefined;
  const linkError = state.error && !passwordError && !confirmError ? state.error : undefined;

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <PasswordField
        id="activate-password"
        name="password"
        label="Mật khẩu mới"
        autoComplete="new-password"
        hint="Ít nhất 8 ký tự, gồm cả chữ và số."
        error={passwordError}
        required
      />
      <PasswordField
        id="activate-confirm"
        name="confirmPassword"
        label="Nhập lại mật khẩu"
        autoComplete="new-password"
        error={confirmError}
        required
      />
      {linkError ? (
        <div className="space-y-2">
          <ErrorBanner message={linkError} />
          <Link href={resendHref} className={ACTION_LINK} style={{ borderColor: "var(--color-primary)" }}>
            Gửi lại email kích hoạt
          </Link>
          {state.code === "TOKEN_ALREADY_USED" ? (
            <Link href="/login" className={ACTION_LINK} style={{ borderColor: "var(--color-primary)" }}>
              Đăng nhập
            </Link>
          ) : null}
        </div>
      ) : null}
      <SubmitButton loading={pending}>{pending ? "Đang kích hoạt..." : "Kích hoạt và đặt mật khẩu"}</SubmitButton>
    </form>
  );
}
