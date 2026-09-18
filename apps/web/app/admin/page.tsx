import Link from "next/link";
import { requireAdminAccess } from "../../lib/page-guards";
import { getAdminDashboardSummary } from "../../lib/admin-dashboard";

export default async function AdminDashboardPage() {
  await requireAdminAccess("/admin");
  const summary = await getAdminDashboardSummary();

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tổng quan hệ thống</h1>

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
        <StatCard label="Tổng user" value={summary.totalUsers} />
        <StatCard label="User đang hoạt động" value={summary.usersByStatus.ACTIVE} />
        <StatCard label="User bị khoá" value={summary.usersByStatus.LOCKED} />
        <StatCard label="Tổng tenant" value={summary.totalTenants} />
        <StatCard label="Tenant hoạt động" value={summary.tenantsByStatus.ACTIVE} />
        <StatCard label="Tổng subscription" value={summary.totalSubscriptions} />
      </div>

      <p className="mt-6 text-sm text-gray-500">
        Doanh thu subscription và GMV tổng hợp theo tenant sẽ hiển thị khi có M3 (Subscription Billing) và
        M12 (thống kê tổng hợp).
      </p>

      <nav className="mt-8 flex flex-wrap gap-4 text-sm">
        <Link href="/admin/users" className="text-[var(--color-primary)]">
          Quản lý user
        </Link>
        <Link href="/admin/tenants" className="text-[var(--color-primary)]">
          Quản lý tenant
        </Link>
        <Link href="/admin/plans" className="text-[var(--color-primary)]">
          Gói dịch vụ
        </Link>
        <Link href="/admin/cms" className="text-[var(--color-primary)]">
          Trang CMS
        </Link>
        <Link href="/admin/settings" className="text-[var(--color-primary)]">
          Cấu hình hệ thống
        </Link>
      </nav>
    </main>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded border p-4">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}
