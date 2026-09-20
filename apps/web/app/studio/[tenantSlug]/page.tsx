import { requireTenantMemberPage } from "../../../lib/page-guards";
import { getOrderDashboardStats } from "../../../lib/order";
import { AdminPageHeader } from "../../admin/_ui/kit";

export default async function StudioDashboardPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}`);
  const stats = await getOrderDashboardStats(tenant.id);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title={tenant.name} subtitle={`/${tenant.slug} · trạng thái: ${tenant.status}`} />

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Doanh thu 30 ngày" value={`${stats.revenue30dVnd.toLocaleString("vi-VN")}đ`} />
        <StatCard label="Đơn chờ xác nhận" value={String(stats.pendingOrdersCount)} />
        <StatCard label="Sản phẩm bán chạy" note="Cần M5/M6 — Sản phẩm, Giá" />
        <StatCard label="Đánh giá mới" note="Cần M10 — Social Feed" />
      </div>
    </main>
  );
}

function StatCard({ label, value, note }: { label: string; value?: string; note?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ?? "—"}</p>
      {note ? <p className="mt-1 text-xs text-gray-400">{note}</p> : null}
    </div>
  );
}
