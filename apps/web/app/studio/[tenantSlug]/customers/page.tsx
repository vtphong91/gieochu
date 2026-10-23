import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listCustomersPage, type CustomerListSearchParams } from "../../../../lib/customer-list";
import { AdminPageHeader } from "../../../admin/_ui/kit";
import { todayIsoVn } from "../orders/_ui/order-format";
import { CustomerFilterBar, CustomerList, CustomerStatsStrip } from "./_ui/customer-list";
import { saveCustomerNoteAction } from "./actions";

/** ADR-048 — danh sách Khách hàng Studio: thống kê + lọc / tìm / sắp xếp / phân trang server, URL GET chia sẻ được. */
export default async function StudioCustomersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<CustomerListSearchParams>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/customers`);

  const data = await listCustomersPage(tenant.id, sp);
  const basePath = `/studio/${tenantSlug}/customers`;

  // Nằm trong app shell Studio (layout đã có <main>) → dùng <div>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Khách hàng" subtitle="Ai đã mua hoặc nhận tài liệu của bạn, chi tiêu bao nhiêu và lần gần nhất quay lại khi nào." />
      <CustomerStatsStrip stats={data.stats} />
      <CustomerFilterBar basePath={basePath} data={data} today={todayIsoVn()} />
      <CustomerList
        basePath={basePath}
        tenantSlug={tenantSlug}
        data={data}
        noteAction={saveCustomerNoteAction.bind(null, tenantSlug)}
      />
    </div>
  );
}
