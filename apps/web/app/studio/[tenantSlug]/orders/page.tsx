import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listOrdersPage, type OrderListSearchParams } from "../../../../lib/order";
import { AdminPageHeader } from "../../../admin/_ui/kit";
import { OrderFilterBar, OrderList, RefundRequestNotice } from "./_ui/order-list";
import { todayIsoVn } from "./_ui/order-format";

/** ADR-046 — danh sách đơn hàng Studio: lọc / tìm / sắp xếp / phân trang server, URL GET chia sẻ được. */
export default async function StudioOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<OrderListSearchParams>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/orders`);

  const data = await listOrdersPage(tenant.id, sp);
  const basePath = `/studio/${tenantSlug}/orders`;

  // Nằm trong app shell Studio (layout đã có <main>) → dùng <div>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Đơn hàng" subtitle="Tìm, lọc và xử lý đơn hàng của gian hàng — xác nhận thanh toán, huỷ đơn, hoàn tiền." />
      <RefundRequestNotice basePath={basePath} data={data} />
      <OrderFilterBar basePath={basePath} data={data} today={todayIsoVn()} />
      <OrderList basePath={basePath} tenantSlug={tenantSlug} data={data} />
    </div>
  );
}
