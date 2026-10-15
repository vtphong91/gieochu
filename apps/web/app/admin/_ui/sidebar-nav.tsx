"use client";

import { useState, useSyncExternalStore, type ComponentType } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  IconCard,
  IconChevronDown,
  IconDatabase,
  IconDoc,
  IconGear,
  IconGrid,
  IconLayers,
  IconMail,
  IconPackage,
  IconReceipt,
  IconShield,
  IconStore,
  IconTag,
  IconUsers,
} from "./icons";

type IconComponent = ComponentType<{ className?: string }>;
type NavLeaf = { href: string; label: string; Icon: IconComponent };
type NavGroup = { id: string; label: string; Icon: IconComponent; items: NavLeaf[] };

const STANDALONE: NavLeaf[] = [{ href: "/admin", label: "Tổng quan", Icon: IconGrid }];

const GROUPS: NavGroup[] = [
  {
    id: "users",
    label: "Người dùng",
    Icon: IconUsers,
    items: [
      { href: "/admin/users", label: "Danh sách người dùng", Icon: IconUsers },
      { href: "/admin/roles", label: "Phân quyền", Icon: IconShield },
    ],
  },
  {
    id: "business",
    label: "Kinh doanh",
    Icon: IconStore,
    items: [
      { href: "/admin/tenants", label: "Tenant", Icon: IconStore },
      { href: "/admin/plans", label: "Gói dịch vụ", Icon: IconPackage },
    ],
  },
  {
    id: "content",
    label: "Nội dung",
    Icon: IconDoc,
    items: [
      { href: "/admin/cms", label: "Trang CMS", Icon: IconDoc },
      { href: "/admin/categories", label: "Danh mục tài liệu", Icon: IconTag },
    ],
  },
  {
    id: "billing",
    label: "Tài chính",
    Icon: IconCard,
    items: [
      { href: "/admin/billing/payment", label: "Thanh toán nền tảng", Icon: IconCard },
      { href: "/admin/billing/invoices", label: "Hoá đơn", Icon: IconReceipt },
    ],
  },
  {
    id: "config",
    label: "Cấu hình hệ thống",
    Icon: IconGear,
    items: [
      { href: "/admin/settings/general", label: "Cấu hình chung", Icon: IconGear },
      { href: "/admin/settings", label: "Email hỗ trợ", Icon: IconMail },
      { href: "/admin/settings/branding", label: "Nhận diện thương hiệu", Icon: IconLayers },
      { href: "/admin/settings/storage", label: "Lưu trữ file", Icon: IconDatabase },
      { href: "/admin/settings/cloudinary", label: "Cloudinary Upload", Icon: IconDatabase },
      { href: "/admin/settings/smtp", label: "Cấu hình Mail", Icon: IconMail },
    ],
  },
];

const STORAGE_KEY = "admin:nav:expanded";

function isMatch(pathname: string, href: string) {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(`${href}/`);
}

// `/admin/settings` là tiền tố của chính các mục con của nó (`/admin/settings/branding`...),
// nên không thể chỉ dùng isMatch cho từng mục riêng lẻ — phải chọn href khớp DÀI NHẤT trong
// toàn bộ menu, nếu không cả mục cha lẫn mục con cùng sáng đèn active một lúc.
function activeHref(pathname: string): string | null {
  const all = [...STANDALONE, ...GROUPS.flatMap((g) => g.items)];
  const candidates = all.filter((item) => isMatch(pathname, item.href));
  if (candidates.length === 0) return null;
  return candidates.reduce((best, item) => (item.href.length > best.href.length ? item : best)).href;
}

function groupContainingActive(currentActiveHref: string | null): string | null {
  const group = GROUPS.find((g) => g.items.some((item) => item.href === currentActiveHref));
  return group?.id ?? null;
}

// Đọc nhóm đang mở từ localStorage qua useSyncExternalStore thay vì
// useEffect+setState (React hooks lint cấm setState đồng bộ trong effect).
// Kiểu accordion — chỉ 1 nhóm mở tại một thời điểm — nên trạng thái lưu chỉ
// là 1 chuỗi (hoặc null), string nguyên thuỷ tự ổn định qua Object.is, không
// cần lớp cache/tham chiếu cố định như khi từng lưu mảng.
function getSnapshot(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  return () => window.removeEventListener("storage", callback);
}

function persistExpanded(id: string | null) {
  try {
    if (id) window.localStorage.setItem(STORAGE_KEY, id);
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage không khả dụng (private mode...) — chỉ mất tiện ích nhớ trạng thái.
  }
}

export function AdminSidebarNav() {
  const pathname = usePathname();
  const currentActiveHref = activeHref(pathname);
  const activeGroupId = groupContainingActive(currentActiveHref);
  const savedExpandedId = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  // undefined = chưa bấm gì trong phiên này. Thứ tự ưu tiên nhóm đang mở:
  // 1) đã bấm trong phiên này (kể cả bấm đóng) — tôn trọng thao tác tay gần nhất
  // 2) nhóm chứa trang đang xem (vào thẳng URL/tải lại trang)
  // 3) nhóm đã lưu ở lần trước (localStorage)
  // 4) mặc định nhóm ĐẦU TIÊN khi chưa từng có gì được mở.
  const [sessionExpandedId, setSessionExpandedId] = useState<string | null | undefined>(undefined);
  const expandedId = sessionExpandedId !== undefined ? sessionExpandedId : (activeGroupId ?? savedExpandedId ?? GROUPS[0]?.id ?? null);

  function toggleGroup(id: string) {
    const next = expandedId === id ? null : id;
    setSessionExpandedId(next);
    persistExpanded(next);
  }

  const activeBg = "rgba(217,119,6,0.18)";
  const activeFg = "#FDBA74";

  return (
    <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-3">
      {STANDALONE.map(({ href, label, Icon }) => {
        const active = href === currentActiveHref;
        return (
          <Link
            key={href}
            href={href}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
            style={active ? { background: activeBg, color: activeFg } : { color: "rgba(255,255,255,0.8)" }}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {label}
          </Link>
        );
      })}

      {GROUPS.map((group) => {
        const isOpen = expandedId === group.id;
        const groupActive = group.id === activeGroupId;
        return (
          <div key={group.id}>
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
              style={{ color: groupActive ? "white" : "rgba(255,255,255,0.8)" }}
            >
              <group.Icon className="h-[18px] w-[18px] shrink-0" />
              <span className="flex-1 text-left">{group.label}</span>
              <IconChevronDown className={`h-4 w-4 shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen ? (
              <div className="mt-0.5 ml-[27px] flex flex-col gap-0.5 border-l pl-3" style={{ borderColor: "rgba(255,255,255,0.15)" }}>
                {group.items.map(({ href, label, Icon }) => {
                  const active = href === currentActiveHref;
                  return (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13.5px] font-medium transition-colors"
                      style={active ? { background: activeBg, color: activeFg } : { color: "rgba(255,255,255,0.7)" }}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {label}
                    </Link>
                  );
                })}
              </div>
            ) : null}
          </div>
        );
      })}
    </nav>
  );
}
