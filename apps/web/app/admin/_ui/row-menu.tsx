"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconMoreHorizontal } from "./icons";

/**
 * Dropdown hành động cho 1 dòng bảng — bấm icon "..." mới hiện danh sách
 * chức năng (thay vì bày hết nút ra ngoài). Đóng khi click ra ngoài hoặc bấm Esc.
 */
const TRIGGER_SIZE = {
  /** Mặc định — dòng bảng desktop của System Center. */
  compact: "h-7 w-7",
  /** Dùng được trên mobile: 44×44px dưới lg (target chạm), gọn lại 32px từ lg. */
  touch: "h-11 w-11 lg:h-8 lg:w-8",
} as const;

export function RowMenu({
  label,
  size = "compact",
  children,
}: {
  label: string;
  size?: keyof typeof TRIGGER_SIZE;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={label}
        className={`flex ${TRIGGER_SIZE[size]} items-center justify-center rounded-md text-gray-500 transition hover:bg-gray-100 hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-500`}
      >
        <IconMoreHorizontal className="h-[18px] w-[18px]" />
      </button>
      {open ? (
        <div
          role="menu"
          onClick={() => {
            // Đóng ở tick sau, KHÔNG đóng ngay trong onClick — nếu unmount div này (chứa
            // <form>/nút submit) đồng bộ ngay trong onClick, trình duyệt mất luôn action
            // mặc định (submit form / theo Link) của chính cú click vừa gây ra sự kiện này,
            // khiến mọi mục dạng form trong menu trông như "không bấm được".
            setTimeout(() => setOpen(false), 0);
          }}
          className="absolute top-full right-0 z-30 mt-1 w-56 overflow-hidden rounded-lg border bg-white py-1 shadow-lg"
          style={{ borderColor: "#E5E7EB" }}
        >
          {children}
        </div>
      ) : null}
    </div>
  );
}

type MenuItemTone = "default" | "danger" | "success";

const MENU_ITEM_CLASS =
  "flex min-h-11 w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-gray-50 focus-visible:bg-gray-100 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-9";

const MENU_ITEM_COLOR: Record<MenuItemTone, string> = {
  default: "#12213A",
  danger: "#DC2626",
  success: "#16A34A",
};

export function MenuItemButton({
  tone = "default",
  icon,
  children,
  ...rest
}: { tone?: MenuItemTone; icon?: ReactNode; children: ReactNode } & React.ComponentProps<"button">) {
  return (
    <button
      type="submit"
      role="menuitem"
      className={MENU_ITEM_CLASS}
      style={{ color: MENU_ITEM_COLOR[tone] }}
      {...rest}
    >
      {icon ? <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      {children}
    </button>
  );
}

/** Mục menu điều hướng (Link). `newTab` mở tab mới + `rel="noopener noreferrer"`. */
export function MenuItemLink({
  href,
  newTab = false,
  icon,
  children,
}: {
  href: string;
  newTab?: boolean;
  icon?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      role="menuitem"
      className={MENU_ITEM_CLASS}
      style={{ color: MENU_ITEM_COLOR.default }}
      {...(newTab ? { target: "_blank", rel: "noopener noreferrer" } : {})}
    >
      {icon ? <span className="shrink-0 [&>svg]:h-4 [&>svg]:w-4">{icon}</span> : null}
      <span className="flex-1">{children}</span>
      {newTab ? <span className="sr-only">(mở tab mới)</span> : null}
    </Link>
  );
}

/** Đường kẻ ngăn nhóm mục menu (điều hướng / đổi trạng thái). */
export function MenuSeparator() {
  return <div role="separator" className="my-1 border-t" style={{ borderColor: "#E5E7EB" }} />;
}
