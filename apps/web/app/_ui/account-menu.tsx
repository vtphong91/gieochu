"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconChevronDown, IconLock, IconPackage, IconReceipt, IconUsers } from "../admin/_ui/icons";

const INK = "#12213A";
const LINE = "#E5E7EB";
const RED = "#DC2626";

/** Menu tài khoản ở header trang chủ — click "Xin chào, {tên}" mở dropdown, đóng khi click ra ngoài/Esc. */
export function AccountMenu({
  displayName,
  primaryHref,
  primaryLabel,
}: {
  displayName: string;
  /** Điểm đến chính theo vai trò (System Center/Studio) — null nếu chỉ là khách hàng thường (đã có sẵn 3 mục /account/* bên dưới, không cần lặp lại). */
  primaryHref: string | null;
  primaryLabel: string | null;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

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

  async function handleLogout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex items-center gap-2 rounded-full py-1 pr-1 pl-1"
      >
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
          style={{ background: "#0F3B82" }}
        >
          {displayName.slice(0, 1).toUpperCase()}
        </span>
        <span className="hidden max-w-[140px] truncate text-[15px] font-semibold sm:inline" style={{ color: INK }}>
          Xin chào, {displayName}
        </span>
        <IconChevronDown className={`hidden h-4 w-4 shrink-0 text-[#12213A] transition-transform sm:block ${open ? "rotate-180" : ""}`} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute top-full right-0 z-30 mt-2 w-60 overflow-hidden rounded-xl border bg-white py-1.5 shadow-lg"
          style={{ borderColor: LINE }}
        >
          {primaryHref && primaryLabel ? (
            <>
              <MenuLink href={primaryHref} icon={<IconUsers className="h-4 w-4" />} onNavigate={() => setOpen(false)}>
                {primaryLabel}
              </MenuLink>
              <div className="my-1 h-px" style={{ background: LINE }} />
            </>
          ) : null}
          <MenuLink href="/account/profile" icon={<IconUsers className="h-4 w-4" />} onNavigate={() => setOpen(false)}>
            Hồ sơ của tôi
          </MenuLink>
          <MenuLink href="/account/library" icon={<IconPackage className="h-4 w-4" />} onNavigate={() => setOpen(false)}>
            Tài liệu đã mua
          </MenuLink>
          <MenuLink href="/account/orders" icon={<IconReceipt className="h-4 w-4" />} onNavigate={() => setOpen(false)}>
            Đơn hàng của tôi
          </MenuLink>
          <div className="my-1 h-px" style={{ background: LINE }} />
          <button
            type="button"
            role="menuitem"
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-gray-50"
            style={{ color: RED }}
          >
            <IconLock className="h-4 w-4" />
            Đăng xuất
          </button>
        </div>
      ) : null}
    </div>
  );
}

function MenuLink({ href, icon, children, onNavigate }: { href: string; icon: ReactNode; children: ReactNode; onNavigate: () => void }) {
  return (
    <Link
      href={href}
      role="menuitem"
      onClick={onNavigate}
      className="flex items-center gap-2.5 px-3.5 py-2 text-left text-sm transition hover:bg-gray-50"
      style={{ color: INK }}
    >
      <span className="shrink-0">{icon}</span>
      {children}
    </Link>
  );
}
