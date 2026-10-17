"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { brandColors } from "@gieochu/config/theme";
import { Badge, GhostButton, PasswordField, PrimaryButton, TextField } from "../../admin/_ui/kit";
import { IconCheckCircle, IconMail } from "../../admin/_ui/icons";
import { ConfirmDialog, LIBRARY_BTN } from "../library/_ui/confirm-dialog";
import { formatVnDateTime } from "../_ui/format";
import { ResultBanner, useResultFocus } from "../_ui/form-feedback";
import {
  cancelEmailChangeAction,
  changePasswordAction,
  logoutAllDevicesAction,
  requestEmailChangeAction,
  resendEmailChangeAction,
} from "./actions";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
/** Đỏ đạt 6.5:1 trên nền trắng. */
const RED = "#B91C1C";

/**
 * ADR-041 C3 — đổi mật khẩu. Cần mật khẩu hiện tại; thành công giữ phiên này, đăng xuất mọi thiết bị khác. Ô mật
 * khẩu có nút hiện/ẩn (`aria-pressed`), `autocomplete` đúng loại, cho phép dán / trình quản lý mật khẩu.
 * Server không trả lại mật khẩu đã gõ (`values`) — lỗi thì người dùng gõ lại (chủ ý, không giữ mật khẩu trong state).
 */
export function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState(changePasswordAction, null);
  const formRef = useRef<HTMLFormElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);
  useResultFocus(state, formRef, bannerRef);
  const errors = state && !state.ok ? (state.fieldErrors ?? {}) : {};

  return (
    <form ref={formRef} action={formAction} noValidate className="space-y-4">
      <ResultBanner state={state} bannerRef={bannerRef} />
      <PasswordField
        id="currentPassword"
        name="currentPassword"
        label="Mật khẩu hiện tại"
        autoComplete="current-password"
        toggleLabel="Hiện mật khẩu hiện tại"
        required
        error={errors.currentPassword}
      />
      <PasswordField
        id="newPassword"
        name="newPassword"
        label="Mật khẩu mới"
        autoComplete="new-password"
        toggleLabel="Hiện mật khẩu mới"
        required
        minLength={8}
        hint="Ít nhất 8 ký tự, gồm cả chữ và số."
        error={errors.newPassword}
      />
      <div className="flex flex-col sm:flex-row sm:justify-end">
        <PrimaryButton loading={pending} disabled={pending}>
          {pending ? "Đang đổi…" : "Đổi mật khẩu"}
        </PrimaryButton>
      </div>
    </form>
  );
}

type LastEmailAction = "request" | "resend" | "cancel" | null;

/**
 * ADR-041 C4 — email đăng nhập: email hiện tại, yêu cầu đang chờ (Gửi lại / Huỷ yêu cầu) và form gửi link xác minh
 * tới email mới (cần mật khẩu hiện tại). Trạng thái chờ đọc từ props (server revalidate sau mỗi action); chỉ hiện
 * thông báo của thao tác gần nhất.
 */
export function EmailChangeSection({
  currentEmail,
  pendingEmail,
}: {
  currentEmail: string;
  pendingEmail: { email: string; expiresAt: Date } | null;
}) {
  const [requestState, requestAction, requesting] = useActionState(requestEmailChangeAction, null);
  const [resendState, resendAction, resending] = useActionState(resendEmailChangeAction, null);
  const [cancelState, cancelAction, canceling] = useActionState(cancelEmailChangeAction, null);
  const [last, setLast] = useState<LastEmailAction>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const bannerRef = useRef<HTMLDivElement>(null);

  const lastState = last === "request" ? requestState : last === "resend" ? resendState : last === "cancel" ? cancelState : null;
  useResultFocus(lastState, formRef, bannerRef);

  const requestFailed = requestState && !requestState.ok ? requestState : null;
  const errors = last === "request" ? (requestFailed?.fieldErrors ?? {}) : {};
  const values = requestFailed?.values ?? {};
  const busy = requesting || resending || canceling;

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Email hiện tại
        </p>
        <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[15px] font-medium" style={{ color: INK }}>
          <span className="[overflow-wrap:anywhere]">{currentEmail}</span>
          <Badge tone="success">
            <IconCheckCircle className="mr-1 h-3.5 w-3.5" />
            Đã xác minh
          </Badge>
        </p>
      </div>

      {pendingEmail ? (
        <div className="rounded-xl border px-4 py-3.5 text-sm" style={{ background: brandColors.surface, borderColor: "#BFDBFE", color: INK }}>
          <p className="flex items-start gap-2">
            <IconMail className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              <strong className="font-semibold">Đang chờ xác minh</strong>{" "}
              <strong className="font-semibold [overflow-wrap:anywhere]">{pendingEmail.email}</strong> — hết hạn lúc{" "}
              {formatVnDateTime(pendingEmail.expiresAt)}. Mở hộp thư email mới và bấm link để hoàn tất. Email hiện tại vẫn dùng
              để đăng nhập tới khi xác minh xong.
            </span>
          </p>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row">
            <form action={resendAction} onSubmit={() => setLast("resend")}>
              <GhostButton type="submit" disabled={busy}>
                {resending ? "Đang gửi lại…" : "Gửi lại link"}
              </GhostButton>
            </form>
            <form action={cancelAction} onSubmit={() => setLast("cancel")}>
              <GhostButton type="submit" disabled={busy}>
                {canceling ? "Đang huỷ…" : "Huỷ yêu cầu"}
              </GhostButton>
            </form>
          </div>
        </div>
      ) : null}

      <ResultBanner state={lastState} bannerRef={bannerRef} />

      <form ref={formRef} action={requestAction} onSubmit={() => setLast("request")} noValidate className="space-y-4">
        <h3 className="text-sm font-semibold" style={{ color: INK }}>
          {pendingEmail ? "Đổi sang email khác" : "Đổi email đăng nhập"}
        </h3>
        <TextField
          key={requestState?.ok ? `sent-${pendingEmail?.email ?? ""}` : "editing"}
          id="newEmail"
          name="newEmail"
          type="email"
          inputMode="email"
          autoComplete="email"
          label="Email mới"
          required
          defaultValue={values.newEmail ?? ""}
          hint="Chúng tôi gửi link xác minh tới email này. Một yêu cầu mới sẽ huỷ yêu cầu đang chờ."
          error={errors.newEmail}
        />
        <PasswordField
          id="emailCurrentPassword"
          name="currentPassword"
          label="Mật khẩu hiện tại"
          autoComplete="current-password"
          toggleLabel="Hiện mật khẩu hiện tại"
          required
          hint="Nhập lại để xác nhận đúng là bạn."
          error={errors.currentPassword}
        />
        <div className="flex flex-col sm:flex-row sm:justify-end">
          <PrimaryButton loading={requesting} disabled={busy}>
            {requesting ? "Đang gửi…" : "Gửi link xác minh"}
          </PrimaryButton>
        </div>
      </form>
    </div>
  );
}

/**
 * "Đăng xuất mọi thiết bị" — khối nguy hiểm tách riêng (`destructive-emphasis`) + hộp thoại xác nhận
 * (`confirmation-dialogs`): bị đăng xuất cả trên thiết bị này.
 */
export function LogoutAllDevices() {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        className={`${LIBRARY_BTN} w-full border bg-white hover:bg-red-50 sm:w-auto`}
        style={{ borderColor: RED, color: RED }}
      >
        Đăng xuất mọi thiết bị
      </button>
      <ConfirmDialog
        open={open}
        onClose={() => setOpen(false)}
        title="Đăng xuất mọi thiết bị?"
        description={
          <p>
            Mọi phiên đăng nhập của tài khoản sẽ kết thúc — <strong className="font-semibold">kể cả trên thiết bị này</strong>. Bạn cần đăng nhập lại.
          </p>
        }
        confirm={
          <form action={logoutAllDevicesAction}>
            <LogoutAllSubmit />
          </form>
        }
        returnFocusRef={triggerRef}
      />
    </>
  );
}

function LogoutAllSubmit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={`${LIBRARY_BTN} w-full text-white hover:brightness-110 sm:w-auto`} style={{ background: RED }}>
      {pending ? "Đang đăng xuất…" : "Đăng xuất mọi thiết bị"}
    </button>
  );
}
