"use client";

import { useId, useState, useSyncExternalStore, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import {
  IconAlertTriangle,
  IconCard,
  IconChevronDown,
  IconDatabase,
  IconDoc,
  IconEye,
  IconFlag,
  IconGear,
  IconGrid,
  IconLayers,
  IconMail,
  IconNewspaper,
  IconPackage,
  IconReceipt,
  IconShield,
  IconShoppingBag,
  IconStarOutline,
  IconStore,
  IconTag,
  IconUsers,
} from "./icons";

type IconComponent = ComponentType<{ className?: string }>;

/**
 * Icon truyền dạng KEY (chuỗi) — layout Studio là Server Component, không được truyền component (hàm) sang Client
 * Component (UI-Design-System §8.5). Một bảng key dùng chung cho System Center lẫn Studio.
 */
const NAV_ICONS = {
  grid: IconGrid,
  users: IconUsers,
  shield: IconShield,
  store: IconStore,
  package: IconPackage,
  doc: IconDoc,
  shoppingBag: IconShoppingBag,
  tag: IconTag,
  card: IconCard,
  receipt: IconReceipt,
  gear: IconGear,
  mail: IconMail,
  layers: IconLayers,
  database: IconDatabase,
  eye: IconEye,
  flag: IconFlag,
  posts: IconNewspaper,
  star: IconStarOutline,
} satisfies Record<string, IconComponent>;

export type SidebarNavIcon = keyof typeof NAV_ICONS;
/**
 * Số việc chờ xử lý cạnh nhãn. `srText` là cụm đủ ngữ cảnh cho trình đọc màn hình (vd. "2 yêu cầu hoàn tiền chờ xử lý");
 * `urgent` = có việc quá hạn → nền đỏ + icon cảnh báo (không chỉ bằng màu) — nên ghi cả "quá hạn" trong `srText`.
 */
export type SidebarNavBadge = { count: number; srText: string; urgent?: boolean };
export type SidebarNavLeaf = { href: string; label: string; icon: SidebarNavIcon; badge?: SidebarNavBadge };
export type SidebarNavGroup = { id: string; label: string; icon: SidebarNavIcon; items: SidebarNavLeaf[] };

/** Đỏ đạt 6.5:1 với chữ trắng (cùng giá trị nút nguy hiểm toàn app). */
const DANGER = "#B91C1C";
/** Trạng thái active = sắc accent trên nền primary (theo màu thương hiệu runtime, không hex cứng). */
const ACTIVE_BG = `color-mix(in srgb, ${brandColors.accent} 18%, transparent)`;
const ACTIVE_FG = `color-mix(in srgb, ${brandColors.accent} 45%, white)`;
const FOCUS_CLASS = "outline-offset-[-2px] focus-visible:outline-2 focus-visible:outline-white";

function isMatch(pathname: string, href: string, rootHref: string) {
  return href === rootHref ? pathname === rootHref : pathname === href || pathname.startsWith(`${href}/`);
}

// Gốc khu vực (`/admin`, `/studio/{slug}`) và `/admin/settings` là tiền tố của chính các mục khác, nên không thể chỉ dùng
// isMatch cho từng mục riêng lẻ — phải chọn href khớp DÀI NHẤT trong toàn bộ menu, nếu không mục cha lẫn mục con cùng
// sáng đèn active một lúc.
function activeHref(pathname: string, all: SidebarNavLeaf[], rootHref: string): string | null {
  const candidates = all.filter((item) => isMatch(pathname, item.href, rootHref));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, item) => (item.href.length > best.href.length ? item : best)).href;
}

// Nhóm đang mở (chỉ là trạng thái giao diện, không phải token) đọc từ localStorage qua useSyncExternalStore thay vì
// useEffect+setState (React hooks lint cấm setState đồng bộ trong effect). Kiểu accordion — 1 nhóm mở một lúc — nên giá
// trị lưu là 1 chuỗi (hoặc null), tự ổn định qua Object.is.
function readStored(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function persistExpanded(key: string, id: string | null) {
  try {
    if (id) window.localStorage.setItem(key, id);
    else window.localStorage.removeItem(key);
  } catch {
    // localStorage không khả dụng (private mode...) — chỉ mất tiện ích nhớ trạng thái.
  }
}

function CountPill({ badge }: { badge: SidebarNavBadge }) {
  return (
    <>
      <span
        aria-hidden="true"
        className="ml-auto inline-flex min-w-6 shrink-0 items-center justify-center gap-0.5 rounded-full px-1.5 py-0.5 text-[11px] leading-none font-bold tabular-nums"
        style={badge.urgent ? { background: DANGER, color: "white" } : { background: brandColors.accentSoft, color: brandColors.ink }}
      >
        {badge.urgent ? <IconAlertTriangle className="h-3 w-3" /> : null}
        {badge.count > 99 ? "99+" : badge.count}
      </span>
      <span className="sr-only">, {badge.srText}</span>
    </>
  );
}

/**
 * Sidebar điều hướng dùng chung cho System Center (`/admin`) và Studio (`/studio/{slug}`): mục đứng riêng ở đầu + các
 * nhóm accordion có tiêu đề (1 nhóm mở một lúc). Màu đặt cho nền `brandColors.primary` của `AppSidebarPanel`.
 * Thứ tự ưu tiên nhóm đang mở: 1) thao tác tay trong phiên (kể cả đóng) 2) nhóm chứa trang đang xem 3) nhóm đã lưu
 * (`storageKey`) 4) nhóm đầu tiên.
 */
export function SidebarNav({
  standalone,
  groups,
  rootHref,
  storageKey,
  ariaLabel,
}: {
  standalone: SidebarNavLeaf[];
  groups: SidebarNavGroup[];
  rootHref: string;
  storageKey: string;
  ariaLabel: string;
}) {
  const pathname = usePathname();
  const baseId = useId();
  const all = [...standalone, ...groups.flatMap((g) => g.items)];
  const currentActiveHref = activeHref(pathname, all, rootHref);
  const activeGroupId = groups.find((g) => g.items.some((item) => item.href === currentActiveHref))?.id ?? null;
  const savedExpandedId = useSyncExternalStore(
    subscribe,
    () => readStored(storageKey),
    () => null,
  );
  const [sessionExpandedId, setSessionExpandedId] = useState<string | null | undefined>(undefined);
  const expandedId = sessionExpandedId !== undefined ? sessionExpandedId : (activeGroupId ?? savedExpandedId ?? groups[0]?.id ?? null);

  function toggleGroup(id: string) {
    const next = expandedId === id ? null : id;
    setSessionExpandedId(next);
    persistExpanded(storageKey, next);
  }

  return (
    <nav aria-label={ariaLabel} className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
      <ul className="flex flex-col gap-1">
        {standalone.map((item) => {
          const active = item.href === currentActiveHref;
          const Icon = NAV_ICONS[item.icon];
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors motion-reduce:transition-none lg:min-h-0 ${
                  active ? "font-semibold" : "font-medium hover:bg-white/10"
                } ${FOCUS_CLASS}`}
                style={active ? { background: ACTIVE_BG, color: ACTIVE_FG } : { color: "rgba(255,255,255,0.8)" }}
              >
                <Icon className="h-[18px] w-[18px] shrink-0" />
                <span className="min-w-0 flex-1">{item.label}</span>
                {item.badge && item.badge.count > 0 ? <CountPill badge={item.badge} /> : null}
              </Link>
            </li>
          );
        })}

        {groups.map((group) => {
          const isOpen = expandedId === group.id;
          const groupActive = group.id === activeGroupId;
          const panelId = `${baseId}-${group.id}`;
          const GroupIcon = NAV_ICONS[group.icon];
          const badged = group.items.filter((item) => item.badge && item.badge.count > 0);
          const groupCount = badged.reduce((sum, item) => sum + (item.badge?.count ?? 0), 0);
          const groupUrgent = badged.some((item) => item.badge?.urgent);
          return (
            <li key={group.id}>
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                aria-expanded={isOpen}
                aria-controls={panelId}
                className={`flex min-h-11 w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors hover:bg-white/10 motion-reduce:transition-none lg:min-h-0 ${FOCUS_CLASS}`}
                style={{ color: groupActive ? "white" : "rgba(255,255,255,0.8)" }}
              >
                <GroupIcon className="h-[18px] w-[18px] shrink-0" />
                <span className="flex-1 text-left">{group.label}</span>
                {!isOpen && groupCount > 0 ? (
                  <CountPill
                    badge={{
                      count: groupCount,
                      urgent: groupUrgent,
                      srText: `${groupCount} mục cần xử lý${groupUrgent ? ", có mục quá hạn" : ""}`,
                    }}
                  />
                ) : null}
                <IconChevronDown className={`h-4 w-4 shrink-0 transition-transform motion-reduce:transition-none ${isOpen ? "rotate-180" : ""}`} />
              </button>
              <ul
                id={panelId}
                hidden={!isOpen}
                className="mt-0.5 ml-[27px] flex flex-col gap-0.5 border-l pl-3"
                style={{ borderColor: "rgba(255,255,255,0.15)" }}
              >
                {group.items.map((item) => {
                  const active = item.href === currentActiveHref;
                  const Icon = NAV_ICONS[item.icon];
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        className={`flex min-h-11 items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] transition-colors motion-reduce:transition-none lg:min-h-0 ${
                          active ? "font-semibold" : "font-medium hover:bg-white/10"
                        } ${FOCUS_CLASS}`}
                        style={active ? { background: ACTIVE_BG, color: ACTIVE_FG } : { color: "rgba(255,255,255,0.75)" }}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1">{item.label}</span>
                        {item.badge && item.badge.count > 0 ? <CountPill badge={item.badge} /> : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

// --- Cấu hình menu System Center -----------------------------------------------------------------------------------

const ADMIN_STANDALONE: SidebarNavLeaf[] = [{ href: "/admin", label: "Tổng quan", icon: "grid" }];

const ADMIN_GROUPS: SidebarNavGroup[] = [
  {
    id: "users",
    label: "Người dùng",
    icon: "users",
    items: [
      { href: "/admin/users", label: "Danh sách người dùng", icon: "users" },
      { href: "/admin/roles", label: "Phân quyền", icon: "shield" },
    ],
  },
  {
    id: "business",
    label: "Kinh doanh",
    icon: "store",
    items: [
      { href: "/admin/tenants", label: "Tenant", icon: "store" },
      { href: "/admin/plans", label: "Gói dịch vụ", icon: "package" },
    ],
  },
  {
    id: "content",
    label: "Nội dung",
    icon: "doc",
    items: [
      { href: "/admin/cms", label: "Trang CMS", icon: "doc" },
      { href: "/admin/cms/shop", label: "Trang Cửa hàng", icon: "shoppingBag" },
      { href: "/admin/cms/pricing", label: "Trang Bảng giá", icon: "package" },
      { href: "/admin/cms/menu", label: "Menu & chân trang", icon: "doc" },
      { href: "/admin/cms/phap-ly", label: "Văn bản pháp lý", icon: "doc" },
      { href: "/admin/categories", label: "Danh mục tài liệu", icon: "tag" },
    ],
  },
  {
    id: "billing",
    label: "Tài chính",
    icon: "card",
    items: [
      { href: "/admin/billing/payment", label: "Thanh toán nền tảng", icon: "card" },
      { href: "/admin/billing/invoices", label: "Hoá đơn", icon: "receipt" },
      { href: "/admin/billing/refunds", label: "Hoàn tiền gói", icon: "receipt" },
    ],
  },
  {
    id: "config",
    label: "Cấu hình hệ thống",
    icon: "gear",
    items: [
      { href: "/admin/settings/general", label: "Cấu hình chung", icon: "gear" },
      { href: "/admin/settings", label: "Email hỗ trợ", icon: "mail" },
      { href: "/admin/settings/branding", label: "Nhận diện thương hiệu", icon: "layers" },
      { href: "/admin/settings/storage", label: "Lưu trữ file", icon: "database" },
      { href: "/admin/settings/cloudinary", label: "Cloudinary Upload", icon: "database" },
      { href: "/admin/settings/smtp", label: "Cấu hình Mail", icon: "mail" },
    ],
  },
  {
    id: "monitoring",
    label: "Giám sát",
    icon: "shield",
    items: [
      { href: "/admin/audit", label: "Nhật ký hệ thống", icon: "eye" },
      { href: "/admin/reports", label: "Báo cáo vi phạm", icon: "flag" },
    ],
  },
];

const ADMIN_BADGE_TEXT: Record<string, (n: number) => string> = {
  "/admin/reports": (n) => `${n} báo cáo chờ xử lý`,
  "/admin/billing/refunds": (n) => `${n} yêu cầu hoàn tiền chờ duyệt`,
};

/** Menu System Center — `badges`: số đếm theo href (ADR-038 báo cáo vi phạm, ADR-041 B hoàn tiền gói). */
export function AdminSidebarNav({ badges = {} }: { badges?: Partial<Record<string, number>> }) {
  const withBadge = (item: SidebarNavLeaf): SidebarNavLeaf => {
    const count = badges[item.href] ?? 0;
    if (count <= 0) return item;
    const srText = (ADMIN_BADGE_TEXT[item.href] ?? ((n: number) => `${n} mục mới`))(count);
    return { ...item, badge: { count, srText } };
  };
  return (
    <SidebarNav
      standalone={ADMIN_STANDALONE.map(withBadge)}
      groups={ADMIN_GROUPS.map((g) => ({ ...g, items: g.items.map(withBadge) }))}
      rootHref="/admin"
      storageKey="admin:nav:expanded"
      ariaLabel="Điều hướng System Center"
    />
  );
}
