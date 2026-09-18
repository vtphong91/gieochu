import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { lockTenantAction, unlockTenantAction } from "./actions";

const STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Hoạt động",
  READ_ONLY: "Tạm ngưng bán",
  LOCKED: "Đã khoá",
};

export default async function AdminTenantsPage() {
  await requireAdminAccess("/admin/tenants");

  const prisma = getPrismaClient();
  const tenants = await prisma.tenant.findMany({
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      subscription: { include: { plan: true } },
      _count: { select: { products: true } },
    },
  });

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tenant</h1>
      <p className="mt-1 text-sm text-gray-500">
        Không có màn hình đơn hàng/khách hàng của tenant (§4.2) — chỉ số liệu tổng hợp.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2">Trang</th>
            <th className="py-2">Gói hiện tại</th>
            <th className="py-2">Trạng thái</th>
            <th className="py-2">Dung lượng đã dùng</th>
            <th className="py-2">Số sản phẩm</th>
            <th className="py-2">GMV</th>
            <th className="py-2">Hành động</th>
          </tr>
        </thead>
        <tbody>
          {tenants.map((tenant) => (
            <tr key={tenant.id} className="border-b">
              <td className="py-2">
                {tenant.name} <span className="text-gray-400">/{tenant.slug}</span>
              </td>
              <td className="py-2">{tenant.subscription?.plan.name ?? "—"}</td>
              <td className="py-2">{STATUS_LABEL[tenant.status] ?? tenant.status}</td>
              <td className="py-2">{Math.round(tenant.storageUsedBytes / 1024 / 1024)} MB</td>
              <td className="py-2">{tenant._count.products}</td>
              <td className="py-2 text-gray-400">Cần M12</td>
              <td className="py-2">
                {tenant.status === "LOCKED" ? (
                  <form action={unlockTenantAction.bind(null, tenant.id)}>
                    <button type="submit" className="text-[var(--color-primary)]">
                      Mở khoá
                    </button>
                  </form>
                ) : (
                  <form action={lockTenantAction.bind(null, tenant.id)}>
                    <button type="submit" className="text-red-600">
                      Khoá
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
