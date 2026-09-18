import Link from "next/link";
import { requireTenantMemberPage } from "../../../lib/page-guards";
import { getOrderDashboardStats } from "../../../lib/order";

export default async function StudioDashboardPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}`);
  const stats = await getOrderDashboardStats(tenant.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">{tenant.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        /{tenant.slug} · trạng thái: {tenant.status}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Doanh thu 30 ngày" value={`${stats.revenue30dVnd.toLocaleString("vi-VN")}đ`} />
        <StatCard label="Đơn chờ xác nhận" value={String(stats.pendingOrdersCount)} />
        <StatCard label="Sản phẩm bán chạy" note="Cần M5/M6 — Sản phẩm, Giá" />
        <StatCard label="Đánh giá mới" note="Cần M10 — Social Feed" />
      </div>

      <nav className="mt-10 flex flex-wrap gap-4 text-sm">
        <Link href={`/studio/${tenant.slug}/orders`} className="text-[var(--color-primary)]">
          Đơn hàng
        </Link>
        <Link href={`/studio/${tenant.slug}/customers`} className="text-[var(--color-primary)]">
          Khách hàng
        </Link>
        <Link href={`/studio/${tenant.slug}/products`} className="text-[var(--color-primary)]">
          Sản phẩm
        </Link>
        <Link href={`/studio/${tenant.slug}/coupons`} className="text-[var(--color-primary)]">
          Mã giảm giá
        </Link>
        <Link href={`/studio/${tenant.slug}/settings`} className="text-[var(--color-primary)]">
          Cài đặt trang
        </Link>
        <Link href={`/${tenant.slug}`} className="text-[var(--color-primary)]" target="_blank" rel="noreferrer">
          Xem trang công khai
        </Link>
      </nav>
    </main>
  );
}

function StatCard({ label, value, note }: { label: string; value?: string; note?: string }) {
  return (
    <div className="rounded border p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ?? "—"}</p>
      {note ? <p className="mt-1 text-xs text-gray-400">{note}</p> : null}
    </div>
  );
}
