import Link from "next/link";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { getAccountHeaderData } from "../../../lib/account-profile";
import { requireTenantMemberPage } from "../../../lib/page-guards";
import { getEffectiveBrand, getEffectiveLogos } from "../../../lib/branding";
import { countNewStorefrontMessages } from "../../../lib/storefront-messages";
import { countReviewsNeedingAttention } from "../../../lib/review";
import { countPendingRefundRequests } from "../../../lib/entitlement-remedy";
import { AccountMenu } from "../../_ui/account-menu";
import { BrandMark } from "../../_ui/brand-mark";
import { AppSidebarPanel, SIDEBAR_FOOTER_LINK_CLASS } from "../../admin/_ui/app-sidebar";
import { IconChevronLeft, IconExternalLink } from "../../admin/_ui/icons";
import { SidebarDrawer } from "../../admin/_ui/sidebar-drawer";
import { SidebarNav, type SidebarNavGroup, type SidebarNavLeaf } from "../../admin/_ui/sidebar-nav";
import { GuardedLink, UnsavedChangesProvider } from "../../admin/_ui/unsaved-changes";

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
  const base = `/studio/${tenant.slug}`;
  const NAV_STANDALONE: SidebarNavLeaf[] = [{ href: base, label: "Tổng quan", icon: "grid" }];
  const NAV_GROUPS: SidebarNavGroup[] = [
    {
      id: "sales",
      label: "Bán hàng",
      icon: "shoppingBag",
      items: [
        {
          href: `${base}/orders`,
          label: "Đơn hàng",
          icon: "receipt",
          // ADR-039: yêu cầu hoàn tiền của khách đang chờ gian hàng xử lý; có mục quá hạn → badge khẩn.
          badge: {
            count: refundRequests.pending,
            srText: `${refundRequests.pending} yêu cầu hoàn tiền chờ xử lý${refundRequests.overdue > 0 ? `, ${refundRequests.overdue} quá hạn` : ""}`,
            urgent: refundRequests.overdue > 0,
          },
        },
        { href: `${base}/customers`, label: "Khách hàng", icon: "users" },
        { href: `${base}/coupons`, label: "Mã giảm giá", icon: "tag" },
      ],
    },
    {
      id: "content",
      label: "Nội dung",
      icon: "doc",
      items: [
        { href: `${base}/products`, label: "Sản phẩm", icon: "package" },
        { href: `${base}/posts`, label: "Bài viết", icon: "posts" },
        { href: `${base}/storefront`, label: "Trang bán hàng", icon: "layers" },
        {
          href: `${base}/reviews`,
          label: "Đánh giá",
          icon: "star",
          badge: { count: reviewsNeedingAttention, srText: `${reviewsNeedingAttention} đánh giá chưa trả lời` },
        },
      ],
    },
    {
      id: "shop",
      label: "Gian hàng",
      icon: "store",
      items: [
        { href: `${base}/messages`, label: "Hộp thư", icon: "mail", badge: { count: newMessages, srText: `${newMessages} tin nhắn mới` } },
        { href: `${base}/billing`, label: "Gói dịch vụ", icon: "card" },
        // ADR-037: nhật ký chỉ OWNER xem (listTenantAuditLogs) — ẩn mục với vai trò khác.
        ...(role === "OWNER" ? [{ href: `${base}/activity`, label: "Hoạt động", icon: "eye" } satisfies SidebarNavLeaf] : []),
        { href: `${base}/settings`, label: "Cài đặt", icon: "gear" },
      ],
    },
  ];

  const panel = (
    <AppSidebarPanel
      brand={
        <>
          <BrandMark url={logos.logoSidebarUrl} brandName={brand.name} size={42} fallbackBg="rgba(255,255,255,0.15)" />
          <div className="min-w-0">
            <div className="truncate font-[family-name:var(--font-heading)] text-sm leading-tight font-bold">{tenant.name}</div>
            <div className="truncate text-xs leading-tight text-white/70">Studio · {brand.name}</div>
          </div>
        </>
      }
      nav={
        <SidebarNav standalone={NAV_STANDALONE} groups={NAV_GROUPS} rootHref={base} storageKey="studio:nav:expanded" ariaLabel="Điều hướng Studio" />
      }
      footer={
        <>
          <Link href={`/${tenant.slug}`} target="_blank" rel="noreferrer" className={SIDEBAR_FOOTER_LINK_CLASS}>
            <IconExternalLink className="h-3.5 w-3.5 shrink-0" /> Xem trang công khai
            <span className="sr-only">(mở tab mới)</span>
          </Link>
          <GuardedLink href="/" className={SIDEBAR_FOOTER_LINK_CLASS}>
            <IconChevronLeft className="h-3.5 w-3.5 shrink-0" /> Về trang chủ
          </GuardedLink>
        </>
      }
    />
  );

  // ADR-058 mục 5: cảnh báo rời trang khi editor còn thay đổi chưa lưu (sidebar, tab, link "Về trang chủ").
  return (
    <UnsavedChangesProvider>
    <div className={`${beVietnamPro.variable} ${inter.variable} flex min-h-screen font-[family-name:var(--font-body)]`} style={{ background: "#F5F6F8" }}>
      <aside className="sticky top-0 hidden h-dvh w-[288px] shrink-0 lg:block">{panel}</aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between gap-3 border-b bg-white px-4 sm:px-5 lg:px-8" style={{ borderColor: "#E5E7EB" }}>
          <div className="flex min-w-0 items-center gap-3">
            <SidebarDrawer label="Menu Studio">{panel}</SidebarDrawer>
            <span className="truncate text-sm font-semibold text-gray-600 lg:hidden">{tenant.name} · Studio</span>
            <span className="hidden text-sm text-gray-600 lg:block">Quản lý gian hàng</span>
          </div>
          {/* ADR-041 C7: menu tài khoản (ảnh đại diện + họ tên) — Hồ sơ cá nhân, Bảo mật, Thư viện, Về trang chủ, Đăng xuất. */}
          <AccountMenu
            variant="app"
            displayName={member?.fullName || member?.email || "Tài khoản"}
            email={member?.email ?? null}
            avatarUrl={member?.avatarUrl ?? null}
            primaryHref={null}
            primaryLabel={null}
            logoutRedirect="/login"
          />
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-white px-5 py-4 text-xs text-gray-500 lg:px-8" style={{ borderColor: "#E5E7EB" }}>
          © {new Date().getFullYear()} {brand.name} · Studio dành cho {tenant.name}
        </footer>
      </div>
    </div>
    </UnsavedChangesProvider>
  );
}
