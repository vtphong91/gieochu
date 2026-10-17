import Link from "next/link";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../lib/page-guards";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { countOpenAbuseReports } from "../../lib/abuse-report";
import { BrandMark } from "../_ui/brand-mark";
import { AdminSidebarNav } from "./_ui/sidebar-nav";

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["500", "600", "700", "800"],
  variable: "--font-heading",
});
const inter = Inter({ subsets: ["latin", "vietnamese"], weight: ["400", "500", "600", "700"], variable: "--font-body" });

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAdminAccess("/admin");
  // ADR-038: số báo cáo vi phạm chờ xử lý → badge menu "Báo cáo vi phạm" (bảng chưa có → 0).
  const [brand, logos, openReports] = await Promise.all([getEffectiveBrand(), getEffectiveLogos(), countOpenAbuseReports()]);
  const admin = await getPrismaClient().user.findUnique({ where: { id: user.userId }, select: { email: true } });

  return (
    <div className={`${beVietnamPro.variable} ${inter.variable} flex min-h-screen font-[family-name:var(--font-body)]`} style={{ background: "#F5F6F8" }}>
      <aside className="hidden w-[288px] shrink-0 flex-col text-white lg:flex" style={{ background: brandColors.primary }}>
        <div className="flex h-16 items-center gap-2.5 px-5">
          <BrandMark url={logos.logoSidebarUrl} brandName={brand.name} size={42} fallbackBg="rgba(255,255,255,0.15)" />
          {logos.logoSidebarUrl ? (
            <div className="text-xs leading-tight text-white/60">System Center</div>
          ) : (
            <div>
              <div className="font-[family-name:var(--font-heading)] text-sm leading-tight font-bold">{brand.name}</div>
              <div className="text-xs leading-tight text-white/60">System Center</div>
            </div>
          )}
        </div>
        <AdminSidebarNav badges={{ "/admin/reports": openReports }} />
        <div className="border-t border-white/10 px-4 py-4">
          <Link href="/" className="text-xs font-medium text-white/60 hover:text-white">
            ← Về trang chủ
          </Link>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-16 items-center justify-between border-b bg-white px-5 lg:px-8" style={{ borderColor: "#E5E7EB" }}>
          <span className="text-sm font-semibold text-gray-500 lg:hidden">{brand.name} · System Center</span>
          <span className="hidden text-sm text-gray-500 lg:block">Quản trị hệ thống</span>
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: brandColors.primary }}>
              {(admin?.email ?? "A").slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden text-sm font-medium text-gray-700 sm:inline">{admin?.email ?? "Admin"}</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-white px-5 py-4 text-xs text-gray-400 lg:px-8" style={{ borderColor: "#E5E7EB" }}>
          © {new Date().getFullYear()} {brand.name} · System Center
        </footer>
      </div>
    </div>
  );
}
