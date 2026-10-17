"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { IconChevronDown, IconChevronLeft, IconGrid, IconLock, IconPackage, IconReceipt, IconShield, IconStore, IconUsers } from "../admin/_ui/icons";
import { AccountAvatar } from "./account-avatar";

const INK = brandColors.ink;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";
/** Đỏ đạt 6.5:1 trên nền trắng (cùng giá trị nút nguy hiểm ở Thư viện). */
const RED = "#B91C1C";

const ITEM_CLASS =
  "flex min-h-11 w-full cursor-pointer items-center gap-2.5 px-3.5 text-left text-sm transition-colors outline-offset-[-2px] hover:bg-gray-50 focus-visible:outline-2 motion-reduce:transition-none lg:min-h-10";

/**
 * Menu tài khoản ở header (ADR-041 C7) — dùng ở `SiteHeader` (trang công khai, `variant="site"`: "Xin chào, {tên}")
 * và header app shell System Center / Studio / `/account` (`variant="app"`: tên gọn + mục "Về trang chủ").
 *
 * Mẫu **disclosure** (nút `aria-expanded` + `aria-controls` mở danh sách link) thay cho `role="menu"` — `role="menu"`
 * bắt buộc điều hướng bằng phím mũi tên mà menu này không cần; link thường đi được bằng Tab. Đóng khi: bấm lại nút,
 * Esc (trả focus về nút), bấm ra ngoài, đổi trang.
 */
export function AccountMenu({
  displayName,
  email,
  avatarUrl,
  primaryHref,
  primaryLabel,
  variant = "site",
  logoutRedirect = "/",
}: {
  displayName: string;
  /** Hiện ở đầu danh sách (dòng phụ) khi khác `displayName`. */
  email?: string | null;
  avatarUrl?: string | null;
  /** Điểm đến chính theo vai trò (System Center/Studio) — null nếu chỉ là khách hàng thường. */
  primaryHref: string | null;
  primaryLabel: string | null;
  variant?: "site" | "app";
  /** Trang chuyển tới sau khi đăng xuất — app shell System Center/Studio dùng `/login`. */
  logoutRedirect?: string;
}) {
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const router = useRouter();
  const pathname = usePathname();

  // Đổi trang → đóng (điều chỉnh state trong render, không cần effect — cùng cách `MobileNav`).
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  async function handleLogout() {
    setOpen(false);
    await fetch("/api/auth/logout", { method: "POST" });
    router.push(logoutRedirect);
    router.refresh();
  }

  const close = () => setOpen(false);
  const showEmail = email && email !== displayName;

  return (
    <div className="relative inline-block" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((o) => !o);
        }}
        aria-expanded={open}
        aria-controls={panelId}
        className={`flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-full p-1 outline-offset-2 focus-visible:outline-2 [touch-action:manipulation] ${
          variant === "app" ? "border pr-2.5 transition-colors hover:bg-gray-50 motion-reduce:transition-none" : ""
        }`}
        style={{ outlineColor: BLUE, color: INK, ...(variant === "app" ? { borderColor: LINE } : {}) }}
      >
        <AccountAvatar url={avatarUrl ?? null} name={displayName} size={32} />
        <span className="sr-only sm:hidden">Tài khoản: {displayName}</span>
        <span className="hidden max-w-[160px] truncate text-[15px] font-semibold sm:inline" style={{ color: INK }}>
          {variant === "site" ? `Xin chào, ${displayName}` : displayName}
        </span>
        <IconChevronDown
          className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${variant === "app" ? "block" : "hidden sm:block"} ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        id={panelId}
        hidden={!open}
        className="absolute top-full right-0 z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border bg-white py-1.5 shadow-lg"
        style={{ borderColor: LINE }}
      >
        <div className="flex items-center gap-2.5 px-3.5 pt-1.5 pb-2.5">
          <AccountAvatar url={avatarUrl ?? null} name={displayName} size={36} />
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold" style={{ color: INK }}>
              {displayName}
            </p>
            {showEmail ? <p className="truncate text-xs text-gray-600">{email}</p> : null}
          </div>
        </div>
        <div className="mb-1 h-px" style={{ background: LINE }} />
        <nav aria-label="Tài khoản">
          <ul>
            {primaryHref && primaryLabel ? (
              <>
                <MenuLink href={primaryHref} icon={<IconStore className="h-4 w-4" />} onNavigate={close}>
                  {primaryLabel}
                </MenuLink>
                <li aria-hidden="true" className="my-1 h-px" style={{ background: LINE }} />
              </>
            ) : null}
            <MenuLink href="/account" icon={<IconGrid className="h-4 w-4" />} onNavigate={close}>
              Tài khoản của tôi
            </MenuLink>
            <MenuLink href="/account/profile" icon={<IconUsers className="h-4 w-4" />} onNavigate={close}>
              Hồ sơ cá nhân
            </MenuLink>
            <MenuLink href="/account/security" icon={<IconShield className="h-4 w-4" />} onNavigate={close}>
              Bảo mật
            </MenuLink>
            <MenuLink href="/account/library" icon={<IconPackage className="h-4 w-4" />} onNavigate={close}>
              Tài liệu đã mua
            </MenuLink>
            <MenuLink href="/account/orders" icon={<IconReceipt className="h-4 w-4" />} onNavigate={close}>
              Đơn hàng của tôi
            </MenuLink>
            {variant === "app" ? (
              <MenuLink href="/" icon={<IconChevronLeft className="h-4 w-4" />} onNavigate={close}>
                Về trang chủ
              </MenuLink>
            ) : null}
            <li aria-hidden="true" className="my-1 h-px" style={{ background: LINE }} />
            <li>
              <button type="button" onClick={handleLogout} className={ITEM_CLASS} style={{ color: RED, outlineColor: RED }}>
                <IconLock className="h-4 w-4 shrink-0" />
                Đăng xuất
              </button>
            </li>
          </ul>
        </nav>
      </div>
    </div>
  );
}

function MenuLink({ href, icon, children, onNavigate }: { href: string; icon: ReactNode; children: ReactNode; onNavigate: () => void }) {
  return (
    <li>
      <Link href={href} onClick={onNavigate} className={ITEM_CLASS} style={{ color: INK, outlineColor: BLUE }}>
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
        {children}
      </Link>
    </li>
  );
}
