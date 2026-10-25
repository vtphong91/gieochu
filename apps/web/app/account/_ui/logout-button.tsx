"use client";

import { useState } from "react";
import { IconLock } from "../../admin/_ui/icons";

/** Đỏ đạt 6.5:1 trên nền trắng. */
const RED = "#B91C1C";
/** Đỏ nhạt đạt ~5.6:1 trên nền `brandColors.primary` mặc định (sidebar app shell). */
const RED_ON_DARK = "#FCA5A5";

/**
 * Nút "Đăng xuất" (phiên hiện tại) — cùng route `/api/auth/logout` với `AccountMenu`. Dùng ở `/account` (nền trắng) và đáy
 * sidebar System Center/Studio (`tone="onDark"`, `redirectTo="/login"`).
 */
export function LogoutButton({
  className = "",
  redirectTo = "/",
  tone = "light",
}: {
  className?: string;
  /** Trang chuyển tới sau khi đăng xuất. */
  redirectTo?: string;
  /** `light` = nền trắng; `onDark` = nền sidebar xanh đậm. */
  tone?: "light" | "onDark";
}) {
  const [pending, setPending] = useState(false);
  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      // ADR-053: điều hướng cứng — xoá toàn bộ client cache (header/layout prefetch còn dữ liệu phiên cũ). Giữ `pending`
      // tới khi trang mới tải để không bấm lặp.
      window.location.assign(redirectTo);
    } catch {
      setPending(false);
    }
  }

  const color = tone === "onDark" ? RED_ON_DARK : RED;
  const toneClass = tone === "onDark" ? "hover:bg-white/10" : "hover:bg-red-50";

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={`flex cursor-pointer items-center gap-2.5 font-semibold transition-colors outline-offset-[-2px] focus-visible:outline-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${toneClass} ${className}`}
      style={{ color, outlineColor: color }}
    >
      <IconLock className="h-4 w-4 shrink-0" />
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
  );
}
