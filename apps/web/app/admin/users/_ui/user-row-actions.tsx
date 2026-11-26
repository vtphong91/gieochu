"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { IconEye, IconLock, IconMail, IconMoreHorizontal, IconUnlock } from "../../_ui/icons";
import { MenuItemButton, MenuItemLink, MenuSeparator } from "../../_ui/row-menu";
import { UserConfirmDialog, type UserConfirmDialogHandle } from "./user-confirm-dialog";
import { UserLockDialog, type UserLockDialogHandle, type UserLockTarget } from "./user-lock-dialog";

const MENU_GAP = 4;
const VIEWPORT_EDGE = 8;

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
 * KHÔNG dùng `RowMenu` (position:absolute) của kit: menu popover của `InvoiceRowMenu` (ADR-069) không bị khung bảng cắt / không làm khung
 * hiện thanh cuộn dọc, và đặt đúng chỗ ở dòng cuối bảng. Popover `popover="auto"` (top layer) đặt `position:fixed` theo toạ độ nút "⋯": căn
 * mép phải nút, kẹp trong viewport, thiếu chỗ phía dưới thì mở lên trên. Bấm ra ngoài đóng (light dismiss), Esc đóng + trả focus về nút,
 * Tab rời menu thì đóng, cuộn/resize thì đóng. Mở menu → focus mục đầu; ↑/↓/Home/End di chuyển giữa các mục. Hộp xác nhận nằm NGOÀI menu;
 * đóng hộp → focus về nút "⋯".
 */
export function UserRowActions({ user, canLock, canUnlock, canResendVerification }: UserRowActionsProps) {
  const lockRef = useRef<UserLockDialogHandle>(null);
  const resendRef = useRef<UserConfirmDialogHandle>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pointerPress = useRef<{ wasOpen: boolean } | null>(null);
  const lastClosedAt = useRef(0);
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const canChangeLock = canLock || canUnlock;
  const hasActions = canChangeLock || canResendVerification;
  const label = `Chức năng cho ${user.name}`;

  function menuItems(): HTMLElement[] {
    return Array.from(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  }

  function isMenuOpen(): boolean {
    const menu = menuRef.current;
    // Trình duyệt chưa hỗ trợ Popover API: `:popover-open` làm `matches()` ném lỗi.
    if (!menu || typeof menu.showPopover !== "function") return false;
    return menu.matches(":popover-open");
  }

  function placeMenu() {
    const trigger = triggerRef.current;
    const menu = menuRef.current;
    if (!trigger || !menu) return;
    const anchor = trigger.getBoundingClientRect();
    const box = menu.getBoundingClientRect();
    let top = anchor.bottom + MENU_GAP;
    // Dòng sát đáy viewport: mở lên trên nếu phía trên đủ chỗ.
    if (top + box.height > window.innerHeight - VIEWPORT_EDGE && anchor.top - MENU_GAP - box.height >= VIEWPORT_EDGE) {
      top = anchor.top - MENU_GAP - box.height;
    }
    const left = Math.min(Math.max(VIEWPORT_EDGE, anchor.right - box.width), window.innerWidth - box.width - VIEWPORT_EDGE);
    menu.style.top = `${Math.max(VIEWPORT_EDGE, top)}px`;
    menu.style.left = `${Math.max(VIEWPORT_EDGE, left)}px`;
  }

  function openMenu(focus: "first" | "last") {
    const menu = menuRef.current;
    if (!menu || typeof menu.showPopover !== "function" || isMenuOpen()) return;
    menu.showPopover();
    placeMenu();
    const items = menuItems();
    (focus === "first" ? items[0] : items[items.length - 1])?.focus();
  }

  function closeMenu(returnFocus: boolean) {
    if (isMenuOpen()) menuRef.current?.hidePopover();
    if (returnFocus) triggerRef.current?.focus();
  }

  // Đồng bộ `aria-expanded` với trạng thái popover (kể cả khi đóng bằng light dismiss / khi hộp modal mở).
  useEffect(() => {
    const menu = menuRef.current;
    if (!menu) return;
    function onToggle(event: Event) {
      const isOpen = (event as ToggleEvent).newState === "open";
      if (!isOpen) lastClosedAt.current = performance.now();
      setOpen(isOpen);
    }
    menu.addEventListener("toggle", onToggle);
    return () => menu.removeEventListener("toggle", onToggle);
  }, []);

  // Đang mở: cuộn (trang hoặc khung bảng) / đổi kích thước → đóng, tránh menu lệch khỏi dòng của nó.
  useEffect(() => {
    if (!open) return;
    function close() {
      const menu = menuRef.current;
      if (menu && typeof menu.showPopover === "function" && menu.matches(":popover-open")) menu.hidePopover();
    }
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      openMenu(event.key === "ArrowDown" ? "first" : "last");
    }
  }

  function handleMenuKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const items = menuItems();
    const index = items.indexOf(document.activeElement as HTMLElement);
    switch (event.key) {
      case "Escape":
        event.preventDefault();
        closeMenu(true);
        break;
      case "Tab":
        closeMenu(false);
        break;
      case "ArrowDown":
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
        break;
      case "Home":
        event.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        event.preventDefault();
        items[items.length - 1]?.focus();
        break;
    }
  }

  const returnFocus = () => triggerRef.current?.focus();

  return (
    <div className="inline-flex">
      <button
        ref={triggerRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        aria-label={label}
        onPointerDown={() => {
          // Bấm chuột vào chính nút "⋯" khi menu đang mở: light dismiss của popover đóng menu TRƯỚC sự kiện click → nhớ trạng
          // thái lúc nhấn (và mốc vừa đóng) để click không mở lại ngay menu vừa đóng.
          pointerPress.current = { wasOpen: isMenuOpen() };
        }}
        onClick={() => {
          const press = pointerPress.current;
          pointerPress.current = null;
          const justDismissed = press !== null && performance.now() - lastClosedAt.current < 500;
          if (isMenuOpen()) closeMenu(false);
          else if (!(press?.wasOpen || justDismissed)) openMenu("first");
        }}
        onKeyDown={handleTriggerKeyDown}
        className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500 motion-reduce:transition-none lg:h-8 lg:w-8"
      >
        <IconMoreHorizontal className="h-[18px] w-[18px]" />
      </button>
      <div
        ref={menuRef}
        id={menuId}
        popover="auto"
        role="menu"
        aria-label={label}
        onKeyDown={handleMenuKeyDown}
        onClick={(event) => {
          // Bấm một mục → đóng menu (Link vẫn điều hướng; mục mở hộp đã gọi `open()` trước — hộp tự nhận focus).
          if ((event.target as HTMLElement).closest('[role="menuitem"]')) closeMenu(false);
        }}
        // Ghi đè style mặc định của popover (inset:0 + margin:auto = giữa màn hình); toạ độ đặt bằng `placeMenu()`.
        className="fixed inset-auto m-0 w-60 overflow-hidden rounded-lg border bg-white px-0 py-1 text-left shadow-lg"
        style={{ borderColor: "#E5E7EB" }}
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
      </div>
      {canChangeLock ? <UserLockDialog ref={lockRef} user={user} onClosed={returnFocus} /> : null}
      {canResendVerification ? <UserConfirmDialog ref={resendRef} kind="resend-verification" user={user} onClosed={returnFocus} /> : null}
    </div>
  );
}
