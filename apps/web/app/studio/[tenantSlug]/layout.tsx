import Link from "next/link";
import { Be_Vietnam_Pro, Inter } from "next/font/google";
import { brandColors } from "@gieochu/config/theme";
import { getPrismaClient } from "@gieochu/db";
import { requireTenantMemberPage } from "../../../lib/page-guards";
import { getEffectiveBrand, getEffectiveLogos } from "../../../lib/branding";
import { BrandMark } from "../../_ui/brand-mark";
import {
  IconCard,
  IconExternalLink,
  IconGear,
  IconGrid,
  IconPackage,
  IconReceipt,
  IconTag,
  IconUsers,
} from "../../admin/_ui/icons";
import { TenantSidebarNav } from "./_ui/sidebar-nav";

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
  const { user, tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}`);
  const [brand, logos] = await Promise.all([getEffectiveBrand(), getEffectiveLogos()]);
  const member = await getPrismaClient().user.findUnique({ where: { id: user.userId }, select: { email: true } });

  const NAV = [
    { href: `/studio/${tenant.slug}`, label: "Tổng quan", Icon: IconGrid },
    { href: `/studio/${tenant.slug}/orders`, label: "Đơn hàng", Icon: IconReceipt },
    { href: `/studio/${tenant.slug}/customers`, label: "Khách hàng", Icon: IconUsers },
    { href: `/studio/${tenant.slug}/products`, label: "Sản phẩm", Icon: IconPackage },
    { href: `/studio/${tenant.slug}/coupons`, label: "Mã giảm giá", Icon: IconTag },
    { href: `/studio/${tenant.slug}/billing`, label: "Gói dịch vụ", Icon: IconCard },
    { href: `/studio/${tenant.slug}/settings`, label: "Cài đặt", Icon: IconGear },
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
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold text-white" style={{ background: brandColors.primary }}>
              {(member?.email ?? "U").slice(0, 1).toUpperCase()}
            </div>
            <span className="hidden text-sm font-medium text-gray-700 sm:inline">{member?.email}</span>
          </div>
        </header>
        <main className="flex-1">{children}</main>
        <footer className="border-t bg-white px-5 py-4 text-xs text-gray-400 lg:px-8" style={{ borderColor: "#E5E7EB" }}>
          © {new Date().getFullYear()} {brand.name} · Studio dành cho {tenant.name}
        </footer>
      </div>
    </div>
  );
}
