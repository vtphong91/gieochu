"use client";

import { useRef, type ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconLock, IconMail, IconMonitor, IconShield, IconUnlock } from "../../_ui/icons";
// `import type` bị xoá khi biên dịch → không kéo code server (Prisma, email…) vào bundle client.
import type { AdminUserDetail } from "../../../../lib/admin-user-detail";
import { UserConfirmDialog, type UserConfirmDialogHandle, type UserConfirmKind } from "./user-confirm-dialog";
import { UserLockDialog, type UserLockDialogHandle, type UserLockTarget } from "./user-lock-dialog";

/**
 * ADR-073 — nhóm nút thao tác ở đầu trang `/admin/users/[userId]`. Chỉ hiện NÚT khi cờ `detail.actions` cho phép (server tính sẵn và
 * kiểm lại khi thực hiện); lý do không thao tác được (`lockBlocked`) do trang hiển thị. Mỗi nút mở một hộp xác nhận `<dialog>`; đóng
 * hộp → trả focus về đúng nút đã mở.
 *
 * Các hộp luôn nằm trong DOM kể cả khi cờ tắt: thao tác thành công làm cờ đổi (vd "Đăng xuất mọi thiết bị" xong thì hết phiên →
 * `canRevokeSessions=false`); nếu gỡ hộp theo cờ thì màn kết quả đang hiển thị bị mất giữa chừng. Nút biến mất → focus nhảy về nút đầu
 * tiên còn lại. Cỡ nút cùng `TenantLockButton`: 44px dưới lg, gọn từ lg.
 */

const TRIGGER_BASE =
  "inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-lg border bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none sm:w-auto lg:min-h-0";
const TRIGGER_NEUTRAL = "border-gray-300 focus-visible:outline-[color:var(--color-primary)]";
const TRIGGER_LOCK = "border-red-300 text-red-700 focus-visible:outline-red-600";
const TRIGGER_UNLOCK = "border-[color:var(--color-primary)] text-[color:var(--color-primary)] focus-visible:outline-[color:var(--color-primary)]";

export interface UserDetailActionsProps {
  user: UserLockTarget;
  actions: AdminUserDetail["actions"];
}

const CONFIRM_BUTTONS: { kind: UserConfirmKind; flag: keyof AdminUserDetail["actions"]; label: string; icon: ReactNode }[] = [
  { kind: "resend-verification", flag: "canResendVerification", label: "Gửi lại email kích hoạt…", icon: <IconMail className="h-4 w-4" /> },
  { kind: "password-reset", flag: "canRequestPasswordReset", label: "Yêu cầu đặt lại mật khẩu…", icon: <IconShield className="h-4 w-4" /> },
  { kind: "revoke-sessions", flag: "canRevokeSessions", label: "Đăng xuất mọi thiết bị…", icon: <IconMonitor className="h-4 w-4" /> },
];

function ConfirmTrigger({
  kind,
  user,
  label,
  icon,
  allowed,
  onClosedFallback,
}: {
  kind: UserConfirmKind;
  user: UserLockTarget;
  label: string;
  icon: ReactNode;
  allowed: boolean;
  onClosedFallback: () => void;
}) {
  const dialogRef = useRef<UserConfirmDialogHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {allowed ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => dialogRef.current?.open()}
          className={`${TRIGGER_BASE} ${TRIGGER_NEUTRAL}`}
          style={{ color: brandColors.ink }}
        >
          {icon}
          {label}
        </button>
      ) : null}
      <UserConfirmDialog
        ref={dialogRef}
        kind={kind}
        user={user}
        onClosed={() => (triggerRef.current ? triggerRef.current.focus() : onClosedFallback())}
      />
    </>
  );
}

function LockTrigger({ user, unlock, allowed, onClosedFallback }: { user: UserLockTarget; unlock: boolean; allowed: boolean; onClosedFallback: () => void }) {
  const dialogRef = useRef<UserLockDialogHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  return (
    <>
      {allowed ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          onClick={() => dialogRef.current?.open()}
          className={`${TRIGGER_BASE} ${unlock ? TRIGGER_UNLOCK : TRIGGER_LOCK}`}
        >
          {unlock ? <IconUnlock className="h-4 w-4" /> : <IconLock className="h-4 w-4" />}
          {unlock ? "Mở khoá tài khoản…" : "Khoá tài khoản…"}
        </button>
      ) : null}
      <UserLockDialog ref={dialogRef} user={user} onClosed={() => (triggerRef.current ? triggerRef.current.focus() : onClosedFallback())} />
    </>
  );
}

export function UserDetailActions({ user, actions }: UserDetailActionsProps) {
  const groupRef = useRef<HTMLDivElement>(null);
  const focusFirstButton = () => groupRef.current?.querySelector<HTMLButtonElement>("button")?.focus();

  return (
    <div ref={groupRef} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
      {CONFIRM_BUTTONS.map((button) => (
        <ConfirmTrigger
          key={button.kind}
          kind={button.kind}
          user={user}
          label={button.label}
          icon={button.icon}
          allowed={actions[button.flag] === true}
          onClosedFallback={focusFirstButton}
        />
      ))}
      <LockTrigger user={user} unlock={actions.canUnlock} allowed={actions.canLock || actions.canUnlock} onClosedFallback={focusFirstButton} />
    </div>
  );
}
