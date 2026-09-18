import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listTenantCustomers } from "../../../../lib/order";

function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default async function StudioCustomersPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/customers`);

  const customers = await listTenantCustomers(tenant.id);

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Khách hàng</h1>

      <ul className="mt-6 divide-y rounded border">
        {customers.length === 0 ? <li className="p-4 text-sm text-gray-500">Chưa có khách hàng nào.</li> : null}
        {customers.map((customer) => (
          <li key={customer.userId} className="flex items-center justify-between p-4 text-sm">
            <div>
              <p className="font-medium">{customer.user.email}</p>
              <p className="text-gray-500">
                {customer.ordersCount} đơn · mua lần đầu{" "}
                {customer.firstOrderAt ? formatVnDate(customer.firstOrderAt) : "—"}
              </p>
            </div>
            <span className="font-medium">{customer.totalSpentVnd.toLocaleString("vi-VN")}đ</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
