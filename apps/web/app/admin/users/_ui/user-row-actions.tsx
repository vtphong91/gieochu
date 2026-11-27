"use client";

import { useRef } from "react";
import { IconEye, IconLock, IconMail, IconUnlock } from "../../_ui/icons";
import { MenuItemButton, MenuItemLink, MenuSeparator } from "../../_ui/row-menu";
import { RowPopoverMenu, type RowPopoverMenuHandle } from "../../_ui/row-popover-menu";
import { UserConfirmDialog, type UserConfirmDialogHandle } from "./user-confirm-dialog";
import { UserLockDialog, type UserLockDialogHandle, type UserLockTarget } from "./user-lock-dialog";

export interface UserRowActionsProps {
  user: UserLockTarget;
  /** Server tính sẵn (không phải chính mình / siêu quản trị, chưa bị khoá) — server vẫn kiểm lại khi thực hiện. */
  canLock: boolean;
  canUnlock: boolean;
  canResendVerification: boolean;
}

/**
 * ADR-073 — menu dòng "⋯" ở cột thao tác của `/admin/users`: "Xem chi tiết" · (đường kẻ) · "Khoá/Mở khoá tài khoản…" (hộp lý do) ·
 * "Gửi lại email kích hoạt…" (hộp xác nhận). Các thao tác khác (đăng xuất mọi thiết bị, đặt lại mật khẩu) chỉ có ở trang chi tiết, nơi
 * thấy được số phiên và trạng thái.
 *
 * Popover/bàn phím/vị trí do `RowPopoverMenu` (admin/_ui) đảm nhiệm — không dùng `RowMenu` (position:absolute) của kit vì bị khung bảng
 * cắt. Hộp xác nhận nằm NGOÀI menu; đóng hộp → focus về nút "⋯".
 */
export function UserRowActions({ user, canLock, canUnlock, canResendVerification }: UserRowActionsProps) {
  const lockRef = useRef<UserLockDialogHandle>(null);
  const resendRef = useRef<UserConfirmDialogHandle>(null);
  const menuHandle = useRef<RowPopoverMenuHandle>(null);
  const canChangeLock = canLock || canUnlock;
  const hasActions = canChangeLock || canResendVerification;
  const label = `Chức năng cho ${user.name}`;
  const returnFocus = () => menuHandle.current?.focusTrigger();

  return (
    <RowPopoverMenu
      label={label}
      width="lg"
      handleRef={menuHandle}
      dialogs={
        <>
          {canChangeLock ? <UserLockDialog ref={lockRef} user={user} onClosed={returnFocus} /> : null}
          {canResendVerification ? <UserConfirmDialog ref={resendRef} kind="resend-verification" user={user} onClosed={returnFocus} /> : null}
        </>
      }
    >
      <MenuItemLink href={`/admin/users/${user.id}`} icon={<IconEye />}>
        Xem chi tiết
      </MenuItemLink>
      {hasActions ? <MenuSeparator /> : null}
      {canChangeLock ? (
        <MenuItemButton
          type="button"
          aria-haspopup="dialog"
          tone={canUnlock ? "success" : "danger"}
          icon={canUnlock ? <IconUnlock /> : <IconLock />}
          onClick={() => lockRef.current?.open()}
        >
          {canUnlock ? "Mở khoá tài khoản…" : "Khoá tài khoản…"}
        </MenuItemButton>
      ) : null}
      {canResendVerification ? (
        <MenuItemButton type="button" aria-haspopup="dialog" icon={<IconMail />} onClick={() => resendRef.current?.open()}>
          Gửi lại email kích hoạt…
        </MenuItemButton>
      ) : null}
    </RowPopoverMenu>
  );
}
