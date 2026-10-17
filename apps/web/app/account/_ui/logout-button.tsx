"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconLock } from "../../admin/_ui/icons";

/** Đỏ đạt 6.5:1 trên nền trắng. */
const RED = "#B91C1C";

/** Nút "Đăng xuất" (phiên hiện tại) — cùng route `/api/auth/logout` với `AccountMenu`. */
export function LogoutButton({ className = "" }: { className?: string }) {
  const [pending, setPending] = useState(false);
  const router = useRouter();

  async function handleLogout() {
    setPending(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
      router.push("/");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={pending}
      className={`flex cursor-pointer items-center gap-2.5 font-semibold transition-colors outline-offset-[-2px] hover:bg-red-50 focus-visible:outline-2 disabled:cursor-wait disabled:opacity-60 motion-reduce:transition-none ${className}`}
      style={{ color: RED, outlineColor: RED }}
    >
      <IconLock className="h-4 w-4 shrink-0" />
      {pending ? "Đang đăng xuất…" : "Đăng xuất"}
    </button>
  );
}
