import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { IconChevronRight, IconExternalLink } from "../../admin/_ui/icons";
import type { AccountNavGroup } from "./account-nav";
import { ACCOUNT_NAV_ICONS } from "./nav-icons";
import { LogoutButton } from "./logout-button";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";
const WARN_FG = "#92400E";

/**
 * Danh sách mục kiểu màn hình cài đặt điện thoại — thay sidebar dưới `lg` (chỉ hiện ở trang Tổng quan `/account`).
 * Mỗi dòng ≥ 52px, icon + chữ + mũi tên; không dùng dải tab cuộn ngang (skill `horizontal-scroll`,
 * `adaptive-navigation`). "Đăng xuất" tách khối riêng cuối danh sách (`destructive-nav-separation`).
 */
export function AccountNavList({ groups }: { groups: AccountNavGroup[] }) {
  return (
    <nav aria-label="Khu vực tài khoản" className="space-y-6">
      {groups.map((group) => (
        <section key={group.id} aria-labelledby={`account-list-${group.id}`}>
          <h2 id={`account-list-${group.id}`} className="px-1 text-xs font-semibold tracking-wide uppercase" style={{ color: INK_SOFT }}>
            {group.label}
          </h2>
          <ul className="mt-2 divide-y overflow-hidden rounded-2xl border bg-white" style={{ borderColor: LINE }}>
            {group.items.map((item) => {
              const Icon = ACCOUNT_NAV_ICONS[item.icon];
              return (
                <li key={item.href} style={{ borderColor: LINE }}>
                  <Link
                    href={item.href}
                    className="flex min-h-13 items-center gap-3 px-4 py-3 text-[15px] font-medium outline-offset-[-2px] focus-visible:outline-2 active:bg-gray-50 [touch-action:manipulation]"
                    style={{ color: INK, outlineColor: BLUE }}
                  >
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                      style={{ background: brandColors.surface, color: BLUE }}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                      {item.label}
                      {item.otherArea ? <span className="sr-only"> (trong {item.otherArea})</span> : null}
                      {item.meta ? (
                        <span className="block text-[13px] font-normal" style={{ color: item.metaTone === "warning" ? WARN_FG : INK_SOFT }}>
                          {item.meta}
                        </span>
                      ) : null}
                    </span>
                    {item.otherArea ? (
                      <IconExternalLink className="h-4 w-4 shrink-0 opacity-70" />
                    ) : (
                      <IconChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <div className="overflow-hidden rounded-2xl border bg-white" style={{ borderColor: LINE }}>
        <LogoutButton className="min-h-13 w-full justify-center px-4 py-3 text-[15px]" />
      </div>
    </nav>
  );
}
