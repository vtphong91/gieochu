import { resolveDashboardRange } from "@gieochu/core/dashboard-range";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { getTenantDashboard } from "../../../../lib/tenant-dashboard";
import { StudioDashboardView } from "./_ui/dashboard";
import { parseStudioChartMetric } from "./_ui/dashboard-format";

/**
 * ADR-043 — Tổng quan gian hàng `/studio/{slug}` (route group `(tong-quan)` để `loading.tsx`/`error.tsx` chỉ áp cho trang
 * này, không lan sang các trang Studio con). Chỉ OWNER (`requireTenantMemberPage`); `tenantId` lấy từ guard, không từ URL.
 * Kỳ `?ky=` / `?tu=` / `?den=` và chỉ số biểu đồ `?chi-so=` đều là link/form GET — không cần JS.
 */
export default async function StudioDashboardPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ ky?: string | string[]; tu?: string | string[]; den?: string | string[]; "chi-so"?: string | string[] }>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}`);
  const range = resolveDashboardRange({ ky: sp.ky, tu: sp.tu, den: sp.den });
  const data = await getTenantDashboard({ tenantId: tenant.id, range });

  return (
    <StudioDashboardView
      tenant={{ name: tenant.name, slug: tenant.slug, status: tenant.status }}
      data={data}
      metric={parseStudioChartMetric(sp["chi-so"])}
    />
  );
}
