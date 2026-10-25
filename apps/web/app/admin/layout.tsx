import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { requireAdminAccess } from "../../lib/page-guards";
import { getAccountHeaderData } from "../../lib/account-profile";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { countOpenAbuseReports } from "../../lib/abuse-report";
import { countPendingRefundRequests } from "../../lib/subscription-refund";
import { AccountMenu } from "../_ui/account-menu";
import { BrandMark } from "../_ui/brand-mark";
import { AppSidebarPanel, SIDEBAR_FOOTER_LINK_CLASS } from "./_ui/app-sidebar";
import { IconChevronLeft } from "./_ui/icons";
import { SidebarDrawer } from "./_ui/sidebar-drawer";
import { AdminSidebarNav } from "./_ui/sidebar-nav";
import { GuardedLink, UnsavedChangesProvider } from "./_ui/unsaved-changes";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});
const inter = Inter({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminAccess("/admin");
  // ADR-038: số báo cáo vi phạm chờ xử lý → badge menu "Báo cáo vi phạm"; ADR-041 B: yêu cầu hoàn tiền gói chờ duyệt
  // → badge "Hoàn tiền gói" (bảng chưa có → 0).
  const [brand, logos, openReports, pendingRefunds] = await Promise.all([
    getEffectiveBrand(),
    getEffectiveLogos(),
    countOpenAbuseReports(),
    countPendingRefundRequests(),
  ]);
  // ADR-042: họ tên + ảnh đại diện cho AccountMenu (cùng nguồn với Studio/SiteHeader).
  const admin = await getAccountHeaderData(user.userId);

  const panel = (
    <AppSidebarPanel
      brand={
        <>
          <BrandMark url={logos.logoSidebarUrl} brandName={brand.name} size={42} fallbackBg="rgba(255,255,255,0.15)" />
          {logos.logoSidebarUrl ? (
            <div className="text-xs leading-tight text-white/70">System Center</div>
          ) : (
            <div className="min-w-0">
              <div className="truncate font-[family-name:var(--font-heading)] text-sm leading-tight font-bold">{brand.name}</div>
              <div className="text-xs leading-tight text-white/70">System Center</div>
            </div>
          )}
        </>
      }
      nav={<AdminSidebarNav badges={{ "/admin/reports": openReports, "/admin/billing/refunds": pendingRefunds }} />}
      footer={
        <GuardedLink href="/" className={SIDEBAR_FOOTER_LINK_CLASS}>
          <IconChevronLeft className="h-3.5 w-3.5 shrink-0" /> Về trang chủ
        </GuardedLink>
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
            <SidebarDrawer label="Menu System Center">{panel}</SidebarDrawer>
            <span className="truncate text-sm font-semibold text-gray-600 lg:hidden">{brand.name} · System Center</span>
            <span className="hidden text-sm text-gray-600 lg:block">Quản trị hệ thống</span>
          </div>
          <AccountMenu
            variant="app"
            displayName={admin?.fullName || admin?.email || "Admin"}
            email={admin?.email ?? null}
            avatarUrl={admin?.avatarUrl ?? null}
            primaryHref={null}
            primaryLabel={null}
            logoutRedirect="/login"
          />
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-white px-5 py-4 text-xs text-gray-500 lg:px-8" style={{ borderColor: "#E5E7EB" }}>
          © {new Date().getFullYear()} {brand.name} · System Center
        </footer>
      </div>
    </div>
    </UnsavedChangesProvider>
  );
}
