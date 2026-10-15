import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listTenantCustomers } from "../../../../lib/order";
import { AdminPageHeader, DataTable, EmptyState, Td, Tr } from "../../../admin/_ui/kit";
import { IconUsers } from "../../../admin/_ui/icons";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE });
}

export default async function StudioCustomersPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/customers`);

  const customers = await listTenantCustomers(tenant.id);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Khách hàng" subtitle="Danh sách khách hàng đã từng mua tài liệu của bạn." />

      <div className="mt-6">
        {customers.length === 0 ? (
          <EmptyState icon={<IconUsers className="h-6 w-6" />} title="Chưa có khách hàng nào" />
        ) : (
          <DataTable head={["Email", "Số đơn", "Mua lần đầu", "Tổng chi tiêu"]}>
            {customers.map((customer) => (
              <Tr key={customer.userId}>
                <Td className="font-medium">{customer.user.email}</Td>
                <Td className="text-gray-500">{customer.ordersCount}</Td>
                <Td className="text-gray-500">{customer.firstOrderAt ? formatVnDate(customer.firstOrderAt) : "—"}</Td>
                <Td className="font-medium">{customer.totalSpentVnd.toLocaleString("vi-VN")}đ</Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </div>
    </main>
  );
}
