import Link from "next/link";
import { requireTenantMember } from "../../../lib/tenant";

export default async function StudioDashboardPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">{tenant.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        /{tenant.slug} · trạng thái: {tenant.status}
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Doanh thu 30 ngày" note="Cần M8 — Checkout và Đơn hàng" />
        <StatCard label="Đơn chờ xác nhận" note="Cần M8 — Checkout và Đơn hàng" />
        <StatCard label="Sản phẩm bán chạy" note="Cần M5/M6 — Sản phẩm, Giá" />
        <StatCard label="Đánh giá mới" note="Cần M10 — Social Feed" />
      </div>

      <nav className="mt-10 flex gap-4 text-sm">
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

function StatCard({ label, note }: { label: string; note: string }) {
  return (
    <div className="rounded border p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">—</p>
      <p className="mt-1 text-xs text-gray-400">{note}</p>
    </div>
  );
}
