"use client";

import { useEffect, useId, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { IconClose, IconMenu } from "./icons";

const INK = brandColors.ink;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";

/**
 * Menu điều hướng app shell dưới `lg` (System Center, Studio): nút 44×44 (`aria-expanded`, `aria-controls`) mở drawer
 * trái chứa đúng `AppSidebarPanel` của desktop. Drawer là `<dialog>` mở bằng `showModal()` → trình duyệt tự bẫy focus
 * (phần còn lại của trang `inert`) và đóng bằng Esc. Đóng thêm khi: bấm nút đóng, bấm nền mờ, bấm một link trong drawer,
 * đổi trang, hoặc màn hình rộng lên `lg`. Đóng xong trả focus về nút mở. Nội dung chỉ render khi mở (tránh trùng `nav`).
 */
export function SidebarDrawer({ label, children }: { label: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const dialogId = useId();
  const pathname = usePathname();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  // Đổi trang → đóng (layout dùng chung nên drawer không tự unmount khi điều hướng).
  useEffect(() => {
    dialogRef.current?.close();
  }, [pathname]);

  // Màn hình rộng lên `lg` (xoay ngang/kéo cửa sổ) → sidebar desktop hiện, đóng drawer.
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 64rem)");
    const onChange = (e: MediaQueryListEvent) => {
      if (e.matches) dialogRef.current?.close();
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [open]);

  function handleClose() {
    setOpen(false);
    buttonRef.current?.focus();
  }

  function handleDialogClick(e: MouseEvent<HTMLDialogElement>) {
    // Bấm vùng trống/nền mờ: target là chính <dialog>. Bấm link trong drawer: đóng ngay (kể cả link tới trang đang xem).
    const target = e.target as Element;
    if (target === e.currentTarget || target.hasAttribute("data-drawer-scrim") || target.closest("a")) e.currentTarget.close();
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={open}
        aria-controls={dialogId}
        aria-label="Mở menu điều hướng"
        onClick={() => setOpen(true)}
        className="inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-lg border bg-white outline-offset-2 transition-colors hover:bg-gray-50 focus-visible:outline-2 motion-reduce:transition-none [touch-action:manipulation] lg:hidden"
        style={{ borderColor: LINE, color: INK, outlineColor: BLUE }}
      >
        <IconMenu className="h-5 w-5" />
      </button>
      <dialog
        ref={dialogRef}
        id={dialogId}
        aria-label={label}
        onClose={handleClose}
        onClick={handleDialogClick}
        className="app-drawer fixed inset-0 m-0 h-dvh max-h-none w-full max-w-none bg-transparent p-0 backdrop:bg-[rgba(18,33,58,0.55)]"
      >
        {open ? (
          <div data-drawer-scrim="" className="flex h-full items-start">
            <div className="app-drawer-panel h-full w-[288px] max-w-[calc(100vw-4rem)] shadow-2xl">{children}</div>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="m-2 inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-white outline-offset-2 focus-visible:outline-2 focus-visible:outline-white [touch-action:manipulation]"
              style={{ color: INK }}
            >
              <IconClose className="h-5 w-5" />
              <span className="sr-only">Đóng menu điều hướng</span>
            </button>
          </div>
        ) : null}
      </dialog>
    </>
  );
}
