import Link from "next/link";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { brandColors } from "@gieochu/config/theme";
import { getAccountHeaderData } from "../../../lib/account-profile";
import { requireTenantMemberPage } from "../../../lib/page-guards";
import { getEffectiveBrand, getEffectiveLogos } from "../../../lib/branding";
import { countNewStorefrontMessages } from "../../../lib/storefront-messages";
import { countReviewsNeedingAttention } from "../../../lib/review";
import { countPendingRefundRequests } from "../../../lib/entitlement-remedy";
import { AccountMenu } from "../../_ui/account-menu";
import { BrandMark } from "../../_ui/brand-mark";
import { IconExternalLink } from "../../admin/_ui/icons";
import { TenantSidebarNav, type TenantNavItem } from "./_ui/sidebar-nav";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});
const inter = Inter({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

export default async function StudioLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ tenantSlug: string }>;
}) {
  const { tenantSlug } = await params;
  const { user, tenant, role } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}`);
  const [brand, logos] = await Promise.all([getEffectiveBrand(), getEffectiveLogos()]);
  // ADR-041 C7: `member` (email, fullName, avatarUrl) cho menu tài khoản ở header Studio.
  const member = await getAccountHeaderData(user.userId);
  const [newMessages, reviewsNeedingAttention, refundRequests] = await Promise.all([
    countNewStorefrontMessages(tenant.id),
    countReviewsNeedingAttention(tenant.id),
    // ADR-039: yêu cầu hoàn tiền của khách (tài liệu bị gỡ do vi phạm) đang chờ gian hàng xử lý.
    countPendingRefundRequests(tenant.id),
  ]);

  // Icon truyền dạng KEY (chuỗi) — không truyền component (hàm) từ Server sang Client Component.
  const NAV: TenantNavItem[] = [
    { href: `/studio/${tenant.slug}`, label: "Tổng quan", icon: "grid" },
    {
      href: `/studio/${tenant.slug}/orders`,
      label: "Đơn hàng",
      icon: "receipt",
      ...(refundRequests.pending > 0
        ? {
            badge: {
              text: refundRequests.pending > 99 ? "99+" : String(refundRequests.pending),
              srText: `${refundRequests.pending} yêu cầu hoàn tiền chờ xử lý${refundRequests.overdue > 0 ? `, ${refundRequests.overdue} quá hạn` : ""}`,
              urgent: refundRequests.overdue > 0,
            },
          }
        : {}),
    },
    { href: `/studio/${tenant.slug}/customers`, label: "Khách hàng", icon: "users" },
    { href: `/studio/${tenant.slug}/products`, label: "Sản phẩm", icon: "package" },
    { href: `/studio/${tenant.slug}/posts`, label: "Bài viết", icon: "posts" },
    { href: `/studio/${tenant.slug}/coupons`, label: "Mã giảm giá", icon: "tag" },
    { href: `/studio/${tenant.slug}/storefront`, label: "Trang bán hàng", icon: "store" },
    { href: `/studio/${tenant.slug}/reviews`, label: reviewsNeedingAttention > 0 ? `Đánh giá (${reviewsNeedingAttention > 99 ? "99+" : reviewsNeedingAttention})` : "Đánh giá", icon: "star" },
    { href: `/studio/${tenant.slug}/messages`, label: newMessages > 0 ? `Hộp thư (${newMessages > 99 ? "99+" : newMessages})` : "Hộp thư", icon: "mail" },
    { href: `/studio/${tenant.slug}/billing`, label: "Gói dịch vụ", icon: "card" },
    // ADR-037: nhật ký chỉ OWNER xem (listTenantAuditLogs) — ẩn mục với vai trò khác.
    ...(role === "OWNER" ? [{ href: `/studio/${tenant.slug}/activity`, label: "Hoạt động", icon: "activity" } as const] : []),
    { href: `/studio/${tenant.slug}/settings`, label: "Cài đặt", icon: "gear" },
  ];

  return (
    <div className={`${beVietnamPro.variable} ${inter.variable} flex min-h-screen font-[family-name:var(--font-body)]`} style={{ background: "#F5F6F8" }}>
      <aside className="hidden w-[288px] shrink-0 flex-col text-white lg:flex" style={{ background: brandColors.primary }}>
        <div className="flex h-16 items-center gap-2.5 px-5">
          <BrandMark url={logos.logoSidebarUrl} brandName={brand.name} size={42} fallbackBg="rgba(255,255,255,0.15)" />
          <div className="min-w-0">
            <div className="font-[family-name:var(--font-heading)] truncate text-sm leading-tight font-bold">{tenant.name}</div>
            <div className="text-xs leading-tight text-white/60">Studio · {brand.name}</div>
          </div>
        </div>
        <TenantSidebarNav items={NAV} rootHref={`/studio/${tenant.slug}`} />
        <div className="border-t border-white/10 px-4 py-4">
          <Link
            href={`/${tenant.slug}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 text-xs font-medium text-white/60 hover:text-white"
          >
            <IconExternalLink className="h-3.5 w-3.5" /> Xem trang công khai
          </Link>
          <Link href="/" className="mt-2 block text-xs font-medium text-white/60 hover:text-white">
            ← Về trang chủ
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white px-5 lg:px-8" style={{ borderColor: "#E5E7EB" }}>
          <span className="text-sm font-semibold text-gray-500 lg:hidden">{tenant.name} · Studio</span>
          <span className="hidden text-sm text-gray-500 lg:block">Quản lý gian hàng</span>
          {/* ADR-041 C7: menu tài khoản (ảnh đại diện + họ tên) — Hồ sơ cá nhân, Bảo mật, Thư viện, Về trang chủ, Đăng xuất. */}
          <AccountMenu
            variant="app"
            displayName={member?.fullName || member?.email || "Tài khoản"}
            email={member?.email ?? null}
            avatarUrl={member?.avatarUrl ?? null}
            primaryHref={null}
            primaryLabel={null}
          />
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-white px-5 py-4 text-xs text-gray-400 lg:px-8" style={{ borderColor: "#E5E7EB" }}>
          © {new Date().getFullYear()} {brand.name} · Studio dành cho {tenant.name}
        </footer>
      </div>
    </div>
  );
}
