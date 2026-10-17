/**
 * Mô hình điều hướng khu vực tài khoản `/account` (ADR-041 C, đề xuất Phong §2.3) — dữ liệu thuần (serializable) để
 * layout (Server) truyền cho `AccountSidebarNav` (Client, desktop) và `AccountNavList` (danh sách kiểu cài đặt,
 * mobile). Icon truyền bằng KEY chuỗi (UI-Design-System §8.5).
 */

export type AccountNavIcon = "grid" | "user" | "shield" | "package" | "receipt" | "store" | "card";

export interface AccountNavItem {
  href: string;
  label: string;
  icon: AccountNavIcon;
  /** Chữ phụ bên phải (tên gói, số đơn chờ...) — luôn là chữ, không chỉ dựa vào màu. */
  meta?: string;
  /** `warning` = cần chú ý (đơn chờ thanh toán, gói quá hạn). */
  metaTone?: "neutral" | "warning";
  /** Mục dẫn sang khu vực khác (Studio) — icon "mở khu vực khác" + chữ ẩn cho trình đọc màn hình. */
  otherArea?: string;
}

export interface AccountNavGroup {
  id: string;
  label: string;
  items: AccountNavItem[];
}

export interface AccountNavTenant {
  slug: string;
  planName: string;
  /** Gói cần gia hạn (quá hạn/ân hạn/hết hạn). */
  needsRenewal: boolean;
}

export function buildAccountNav({
  tenant,
  libraryCount,
  pendingOrderCount = 0,
}: {
  tenant: AccountNavTenant | null;
  libraryCount?: number;
  pendingOrderCount?: number;
}): AccountNavGroup[] {
  const groups: AccountNavGroup[] = [
    {
      id: "tai-khoan",
      label: "Tài khoản của bạn",
      items: [
        { href: "/account", label: "Tổng quan", icon: "grid" },
        { href: "/account/profile", label: "Hồ sơ", icon: "user" },
        { href: "/account/security", label: "Bảo mật", icon: "shield" },
      ],
    },
    {
      id: "mua-sam",
      label: "Mua sắm",
      items: [
        {
          href: "/account/library",
          label: "Thư viện tài liệu",
          icon: "package",
          ...(libraryCount !== undefined && libraryCount > 0 ? { meta: `${libraryCount.toLocaleString("vi-VN")} tài liệu` } : {}),
        },
        {
          href: "/account/orders",
          label: "Đơn hàng",
          icon: "receipt",
          ...(pendingOrderCount > 0 ? { meta: `${pendingOrderCount.toLocaleString("vi-VN")} chờ thanh toán`, metaTone: "warning" as const } : {}),
        },
      ],
    },
  ];

  if (tenant) {
    groups.push({
      id: "gian-hang",
      label: "Gian hàng của bạn",
      items: [
        { href: `/studio/${tenant.slug}`, label: "Vào Studio", icon: "store", otherArea: "Studio" },
        {
          href: `/studio/${tenant.slug}/billing`,
          label: "Gói dịch vụ",
          icon: "card",
          otherArea: "Studio",
          meta: tenant.needsRenewal ? `${tenant.planName} · Quá hạn` : tenant.planName,
          metaTone: tenant.needsRenewal ? "warning" : "neutral",
        },
      ],
    });
  }

  return groups;
}

/** Mục đang xem: khớp href DÀI NHẤT (`/account` là tiền tố của mọi mục con) — cùng cơ chế `TenantSidebarNav`. */
export function activeAccountHref(pathname: string, groups: AccountNavGroup[]): string | null {
  let best: string | null = null;
  for (const group of groups) {
    for (const { href } of group.items) {
      const match = href === "/account" ? pathname === "/account" : pathname === href || pathname.startsWith(`${href}/`);
      if (match && (!best || href.length > best.length)) best = href;
    }
  }
  return best;
}
