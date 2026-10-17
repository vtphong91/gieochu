"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { IconExternalLink } from "../../admin/_ui/icons";
import { activeAccountHref, type AccountNavGroup } from "./account-nav";
import { ACCOUNT_NAV_ICONS } from "./nav-icons";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
/** Chữ cảnh báo trên nền trắng — 7:1 (cùng giá trị `Notice` tone warning). */
const WARN_FG = "#92400E";

/**
 * Sidebar khu vực tài khoản (desktop ≥ lg). Mục hiện tại: `aria-current="page"` + nền + vạch trái + chữ đậm (không chỉ
 * màu — skill `nav-state-active`, `color-not-only`). Mục sang Studio có icon "khu vực khác" + chữ ẩn "(trong Studio)",
 * mở cùng tab. Nhãn nhóm là `<p>` (không phải heading) — sidebar đứng trước H1 của trang trong DOM.
 */
export function AccountSidebarNav({ groups }: { groups: AccountNavGroup[] }) {
  const pathname = usePathname();
  const current = activeAccountHref(pathname, groups);

  return (
    <nav aria-label="Khu vực tài khoản" className="flex flex-col gap-6 px-3 py-5">
      {groups.map((group) => (
        <div key={group.id}>
          <p id={`account-nav-${group.id}`} className="px-3 text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
            {group.label}
          </p>
          <ul aria-labelledby={`account-nav-${group.id}`} className="mt-2 space-y-0.5">
            {group.items.map((item) => {
              const active = item.href === current;
              const Icon = ACCOUNT_NAV_ICONS[item.icon];
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={`relative flex min-h-10 items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors outline-offset-[-2px] hover:bg-gray-50 focus-visible:outline-2 motion-reduce:transition-none ${
                      active ? "font-semibold" : "font-medium"
                    }`}
                    style={{ color: active ? BLUE : INK, background: active ? brandColors.surface : undefined, outlineColor: BLUE }}
                  >
                    <span
                      aria-hidden="true"
                      className="absolute top-2 bottom-2 left-0 w-1 rounded-full"
                      style={{ background: active ? BLUE : "transparent" }}
                    />
                    <Icon className="h-[18px] w-[18px] shrink-0" />
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      {item.label}
                      {item.otherArea ? <span className="sr-only"> (trong {item.otherArea})</span> : null}
                      {item.meta ? (
                        <span className="block text-xs font-medium" style={{ color: item.metaTone === "warning" ? WARN_FG : INK_SOFT }}>
                          {item.meta}
                        </span>
                      ) : null}
                    </span>
                    {item.otherArea ? <IconExternalLink className="h-3.5 w-3.5 shrink-0 opacity-70" /> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
