"use client";

import type { ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCard,
  IconEye,
  IconGear,
  IconGrid,
  IconMail,
  IconNewspaper,
  IconPackage,
  IconReceipt,
  IconStarOutline,
  IconStore,
  IconTag,
  IconUsers,
} from "../../../admin/_ui/icons";

type IconComponent = ComponentType<{ className?: string }>;

/**
 * Layout (Server Component) chỉ được truyền dữ liệu serializable sang đây —
 * truyền thẳng component icon (hàm) gây lỗi "Functions cannot be passed directly
 * to Client Components" (mọi /studio/* 500). Vì vậy layout gửi KEY, map sang icon ở client.
 */
const NAV_ICONS = {
  grid: IconGrid,
  receipt: IconReceipt,
  users: IconUsers,
  package: IconPackage,
  tag: IconTag,
  posts: IconNewspaper,
  store: IconStore,
  mail: IconMail,
  star: IconStarOutline,
  card: IconCard,
  gear: IconGear,
  activity: IconEye,
} satisfies Record<string, IconComponent>;

export type TenantNavIcon = keyof typeof NAV_ICONS;
/**
 * `badge` (tuỳ chọn): số việc chờ xử lý cạnh nhãn — `text` hiển thị (ẩn với trình đọc màn hình), `srText` là cụm đầy
 * đủ ngữ cảnh đọc thay (vd. "2 yêu cầu hoàn tiền chờ xử lý"); `urgent` = có việc quá hạn (nền đỏ + chữ trong srText).
 */
export type TenantNavBadge = { text: string; srText: string; urgent?: boolean };
export type TenantNavItem = { href: string; label: string; icon: TenantNavIcon; badge?: TenantNavBadge };
type NavItem = TenantNavItem;

// `/studio/{slug}` là tiền tố của mọi mục con khác (`/orders`, `/products`...),
// nên không thể chỉ dùng startsWith cho từng mục riêng lẻ — phải chọn href khớp
// DÀI NHẤT trong toàn bộ menu, giống hệt cơ chế activeHref của AdminSidebarNav.
function isMatch(pathname: string, href: string, rootHref: string) {
  return href === rootHref ? pathname === rootHref : pathname === href || pathname.startsWith(`${href}/`);
}

function activeHref(pathname: string, items: NavItem[], rootHref: string): string | null {
  const candidates = items.filter((item) => isMatch(pathname, item.href, rootHref));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, item) => (item.href.length > best.href.length ? item : best)).href;
}

const ACTIVE_BG = "rgba(217,119,6,0.18)";
const ACTIVE_FG = "#FDBA74";

export function TenantSidebarNav({ items, rootHref }: { items: NavItem[]; rootHref: string }) {
  const pathname = usePathname();
  const currentActiveHref = activeHref(pathname, items, rootHref);

  return (
    <nav className="flex flex-1 flex-col gap-1 px-3 py-3">
      {items.map(({ href, label, icon, badge }) => {
        const active = href === currentActiveHref;
        const Icon = NAV_ICONS[icon];
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            style={active ? { background: ACTIVE_BG, color: ACTIVE_FG } : { color: "rgba(255,255,255,0.8)" }}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            <span className="min-w-0 flex-1">{label}</span>
            {badge ? (
              <>
                <span
                  aria-hidden="true"
                  className="inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold"
                  style={badge.urgent ? { background: "#B91C1C", color: "white" } : { background: "white", color: "#12213A" }}
                >
                  {badge.text}
                </span>
                <span className="sr-only">, {badge.srText}</span>
              </>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
