"use client";

import {
  useActionState,
  useEffect,
  useId,
  useImperativeHandle,
  useRef,
  useState,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type SyntheticEvent,
} from "react";
import { brandColors } from "@gieochu/config/theme";
import { FormBanner, GhostButton, Notice, PrimaryButton } from "../../_ui/kit";
import { requestUserPasswordResetAction, resendVerificationAdminAction, revokeUserSessionsAction } from "../actions";

/**
 * ADR-073 — hộp xác nhận chung cho 3 thao tác không cần nhập lý do: "Đăng xuất mọi thiết bị", "Yêu cầu đặt lại mật khẩu",
 * "Gửi lại email kích hoạt". Cùng mẫu `<dialog>` + `showModal()` với `UserLockDialog`: focus tiêu đề khi mở, Esc / "Huỷ bỏ" / nền mờ
 * để đóng (đang xử lý thì không đóng), đóng xong gọi `onClosed` để nơi mở trả focus.
 *
 * Khác hộp khoá: các thao tác này KHÔNG làm đổi thứ gì nhìn thấy được ở nơi mở (gửi lại email kích hoạt không đổi dòng nào), nên thành
 * công → hộp ĐỔI sang màn kết quả (banner xanh `role="status"` + nút "Đóng") thay vì tự đóng; email lỗi (`emailSent:false`) thêm cảnh
 * báo vàng. Lỗi từ server (vd giới hạn tần suất) hiện trong hộp và giữ nguyên form để thử lại.
 */

export type UserConfirmKind = "revoke-sessions" | "password-reset" | "resend-verification";

export interface UserConfirmTarget {
  id: string;
  /** Tên hiển thị: họ tên, hoặc email khi chưa có hồ sơ. */
  name: string;
  email: string;
}

export interface UserConfirmDialogHandle {
  open: () => void;
}

/** Hình dạng chung của kết quả 3 action (`UserActionState` ∪ `ResendVerificationActionState`). */
interface ConfirmState {
  error?: string;
  success?: boolean;
  emailSent?: boolean;
  revokedCount?: number;
}

const initialState: ConfirmState = {};

interface KindConfig {
  title: string;
  doneTitle: string;
  confirmLabel: string;
  pendingLabel: string;
  body: (user: UserConfirmTarget) => ReactNode;
  notice: { tone: "info" | "warning"; heading?: string; lines: readonly string[] };
  successMessage: (state: ConfirmState, user: UserConfirmTarget) => string;
  /** Câu cảnh báo khi thao tác xong nhưng email không gửi được. */
  emailFailedMessage?: string;
}

const strong = (text: string) => <strong className="font-semibold text-gray-900 [overflow-wrap:anywhere]">{text}</strong>;

const CONFIG: Record<UserConfirmKind, KindConfig> = {
  "revoke-sessions": {
    title: "Đăng xuất mọi thiết bị?",
    doneTitle: "Đã đăng xuất mọi thiết bị",
    confirmLabel: "Đăng xuất mọi thiết bị",
    pendingLabel: "Đang đăng xuất...",
    body: (user) => <>Mọi thiết bị đang đăng nhập của {strong(user.name)} sẽ bị đăng xuất ngay.</>,
    notice: {
      tone: "info",
      lines: ["Người dùng vẫn đăng nhập lại được bằng mật khẩu của mình.", "Hệ thống không gửi email cho người dùng khi bạn đăng xuất mọi thiết bị."],
    },
    successMessage: (state) => `Đã đăng xuất ${state.revokedCount ?? 0} phiên đăng nhập.`,
  },
  "password-reset": {
    title: "Yêu cầu đặt lại mật khẩu?",
    doneTitle: "Đã yêu cầu đặt lại mật khẩu",
    confirmLabel: "Yêu cầu đặt lại mật khẩu",
    pendingLabel: "Đang gửi yêu cầu...",
    body: (user) => <>Gửi email đặt lại mật khẩu cho {strong(user.name)} tại {strong(user.email)}.</>,
    notice: {
      tone: "warning",
      heading: "Khi yêu cầu đặt lại mật khẩu:",
      lines: [
        "Mọi thiết bị đang đăng nhập bị đăng xuất ngay.",
        "Tài khoản được đánh dấu “Bắt buộc đặt lại mật khẩu”: người dùng không đăng nhập được cho tới khi đặt mật khẩu mới.",
        "Người dùng nhận email kèm liên kết để tự đặt mật khẩu mới. Bạn không xem hay đặt mật khẩu thay người dùng được.",
      ],
    },
    successMessage: (state) =>
      `Đã yêu cầu đặt lại mật khẩu và đăng xuất ${state.revokedCount ?? 0} phiên đăng nhập.${state.emailSent === false ? "" : " Đã gửi email cho người dùng."}`,
    emailFailedMessage: "Đã yêu cầu đặt lại mật khẩu nhưng chưa gửi được email cho người dùng. Hãy liên hệ người dùng trực tiếp.",
  },
  "resend-verification": {
    title: "Gửi lại email kích hoạt?",
    doneTitle: "Đã gửi email kích hoạt",
    confirmLabel: "Gửi email kích hoạt",
    pendingLabel: "Đang gửi...",
    body: (user) => <>Gửi lại email kích hoạt tài khoản cho {strong(user.name)} tại {strong(user.email)}.</>,
    notice: {
      tone: "info",
      lines: ["Email có liên kết để người dùng xác minh địa chỉ email và kích hoạt tài khoản.", "Mỗi tài khoản chỉ được gửi lại sau một khoảng thời gian ngắn."],
    },
    successMessage: (_state, user) => `Đã gửi email kích hoạt tới ${user.email}.`,
  },
};

function runAction(kind: UserConfirmKind, userId: string): Promise<ConfirmState> {
  switch (kind) {
    case "revoke-sessions":
      return revokeUserSessionsAction(userId);
    case "password-reset":
      return requestUserPasswordResetAction(userId);
    case "resend-verification":
      return resendVerificationAdminAction(userId);
  }
}

export function UserConfirmDialog({
  ref,
  kind,
  user,
  onClosed,
}: {
  ref: Ref<UserConfirmDialogHandle>;
  kind: UserConfirmKind;
  user: UserConfirmTarget;
  onClosed: () => void;
}) {
  const config = CONFIG[kind];
  const [state, formAction, isPending] = useActionState(() => runAction(kind, user.id), initialState);
  const [baseline, setBaseline] = useState<ConfirmState | null>(null);
  const [open, setOpen] = useState(false);

  const uid = useId();
  const titleId = `${uid}-title`;
  const descId = `${uid}-desc`;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Chỉ kết quả MỚI hơn mốc lúc mở hộp mới hiện (lỗi/kết quả của lần mở trước không hiện lại).
  const fresh = baseline !== null && state !== baseline;
  const done = open && fresh && state.success === true;
  const emailFailed = done && state.emailSent === false;
  const error = open && fresh && !state.success ? state.error : undefined;
  const resultMessage = done ? config.successMessage(state, user) : "";

  // Chuyển sang màn kết quả (nút submit biến mất) → đưa focus về tiêu đề để trình đọc màn hình đọc kết quả.
  useEffect(() => {
    if (done) titleRef.current?.focus();
  }, [done]);

  useImperativeHandle(ref, () => ({
    open() {
      const dialog = dialogRef.current;
      if (!dialog || dialog.open) return;
      setBaseline(state);
      setOpen(true);
      dialog.showModal();
      // Focus tiêu đề: trình đọc màn hình đọc tên + mô tả hộp trước.
      titleRef.current?.focus();
    },
  }));

  function closeDialog() {
    if (!isPending) dialogRef.current?.close();
  }

  function handleClosed() {
    setOpen(false);
    onClosed();
  }

  function handleCancel(event: SyntheticEvent<HTMLDialogElement>) {
    // Esc khi đang gửi: giữ hộp mở để người dùng thấy kết quả.
    if (isPending) event.preventDefault();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) closeDialog();
  }

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClose={handleClosed}
      onCancel={handleCancel}
      onClick={handleBackdropClick}
      // Không đặt `flex`/`block` trên <dialog> (đè display:none khi đóng) — bố cục nằm ở <div> con.
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-gray-200 bg-white p-0 text-left shadow-xl backdrop:bg-[rgba(18,33,58,0.45)]"
      style={{ color: brandColors.ink }}
    >
      <div className="max-h-[calc(100dvh-2rem)] overflow-y-auto p-5 sm:p-6">
        <h2
          ref={titleRef}
          id={titleId}
          tabIndex={-1}
          className="font-[family-name:var(--font-heading)] text-lg leading-snug font-semibold outline-none"
        >
          {done ? config.doneTitle : config.title}
        </h2>
        <p id={descId} className="mt-2 text-sm leading-relaxed" style={{ color: brandColors.inkSoft }}>
          {config.body(user)}
        </p>

        {done ? (
          <>
            <div className="mt-4">
              <FormBanner ok message={resultMessage} />
            </div>
            {emailFailed && config.emailFailedMessage ? (
              <div className="mt-4">
                <Notice tone="warning">
                  <p>{config.emailFailedMessage}</p>
                </Notice>
              </div>
            ) : null}
            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <GhostButton onClick={closeDialog}>Đóng</GhostButton>
            </div>
          </>
        ) : (
          <form action={formAction}>
            <div className="mt-4">
              <Notice tone={config.notice.tone}>
                {config.notice.heading ? <p className="font-semibold">{config.notice.heading}</p> : null}
                {config.notice.lines.length === 1 ? (
                  <p>{config.notice.lines[0]}</p>
                ) : (
                  <ul className={`${config.notice.heading ? "mt-1 " : ""}list-disc space-y-1 pl-5`}>
                    {config.notice.lines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                )}
              </Notice>
            </div>

            {error ? (
              <div className="mt-3">
                <FormBanner ok={false} message={error} />
              </div>
            ) : null}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <GhostButton disabled={isPending} onClick={closeDialog}>
                Huỷ bỏ
              </GhostButton>
              <PrimaryButton loading={isPending}>{isPending ? config.pendingLabel : config.confirmLabel}</PrimaryButton>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
