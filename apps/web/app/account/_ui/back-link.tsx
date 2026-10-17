"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { IconChevronLeft } from "../../admin/_ui/icons";

/**
 * Link "Tài khoản" quay về danh sách mục (`/account`) ở đầu mỗi trang con — chỉ dưới `lg` (desktop đã có sidebar).
 * Layout không biết pathname (Next 16: layout không render lại khi điều hướng) nên tách client component.
 * Không hiện ở trang Tổng quan và trang xác nhận đổi email (dùng được khi chưa đăng nhập).
 */
export function AccountBackLink() {
  const pathname = usePathname();
  if (pathname === "/account" || pathname.startsWith("/account/email/")) return null;
  return (
    <Link
      href="/account"
      className="-ml-2 mb-4 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold outline-offset-2 focus-visible:outline-2 lg:hidden"
      style={{ color: brandColors.primary, outlineColor: brandColors.primary }}
    >
      <IconChevronLeft className="h-4 w-4" />
      Tài khoản
    </Link>
  );
}
