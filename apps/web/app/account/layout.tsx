import { logger } from "@gieochu/core";
import { getAccountHeaderData, getCachedAccountOverview } from "../../lib/account-profile";
import { getEffectiveBrand, getEffectiveLogos } from "../../lib/branding";
import { getCurrentUser } from "../../lib/session";
import { buildAccountNav, type AccountNavGroup } from "./_ui/account-nav";
import { AccountShell } from "./_ui/account-shell";
import { tenantNeedsRenewal } from "./_ui/owned-tenant-card";

/**
 * App shell khu vực tài khoản `/account/**` (ADR-041 C; ADR-024 §4.4 — fluid theo sidebar, không `container-page`).
 * Header hệ thống gọn (cao 64px, giống Studio): logo → trang chủ, nhãn "Tài khoản", menu tài khoản. Sidebar nhóm mục
 * chỉ từ `lg`; dưới `lg` trang Tổng quan là danh sách mục kiểu cài đặt và trang con có link "Tài khoản" quay lại.
 *
 * Layout KHÔNG gác quyền: trang `/account/email/xac-nhan` dùng được khi chưa đăng nhập; mọi trang khác tự
 * `requireVerifiedAccess()`. Chưa đăng nhập / chưa xác minh → chỉ header (không sidebar). Dữ liệu sidebar đọc qua
 * loader có sẵn (`getCachedAccountOverview`, cache theo request); lỗi đọc → sidebar không có nhóm "Gian hàng".
 */
export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const [brand, logos, user] = await Promise.all([getEffectiveBrand(), getEffectiveLogos(), getCurrentUser()]);

  let groups: AccountNavGroup[] | null = null;
  let header: Awaited<ReturnType<typeof getAccountHeaderData>> = null;
  if (user) {
    header = await getAccountHeaderData(user.userId);
    if (user.emailVerified) {
      try {
        const overview = await getCachedAccountOverview();
        const tenant = overview?.ownedTenant;
        groups = buildAccountNav({
          tenant: tenant ? { slug: tenant.slug, planName: tenant.plan.name, needsRenewal: tenantNeedsRenewal(tenant) } : null,
          pendingOrderCount: overview?.pendingOrderCount ?? 0,
        });
      } catch (error) {
        logger.warn({ err: error }, "account layout: không đọc được dữ liệu sidebar");
        groups = buildAccountNav({ tenant: null });
      }
    }
  }

  return (
    <AccountShell brandName={brand.name} logoUrl={logos.logoLightUrl} signedIn={Boolean(user)} header={header} groups={groups}>
      {children}
    </AccountShell>
  );
}
