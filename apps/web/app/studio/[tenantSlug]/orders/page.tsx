import { requireTenantMemberPage } from "../../../../lib/page-guards";
import Link from "next/link";
import { listOrdersPage, type OrderListSearchParams } from "../../../../lib/order";
import { countTenantTransactionsNeedingAction } from "../../../../lib/tenant-payment-transactions";
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

  const [data, txnNeedingAction] = await Promise.all([listOrdersPage(tenant.id, sp), countTenantTransactionsNeedingAction(tenant.id)]);
  const basePath = `/studio/${tenantSlug}/orders`;

  // Nằm trong app shell Studio (layout đã có <main>) → dùng <div>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Đơn hàng" subtitle="Tìm, lọc và xử lý đơn hàng của gian hàng — xác nhận thanh toán, huỷ đơn, hoàn tiền." />
      {/* ADR-059 bổ sung lần 2 (d): markup tối thiểu — Phong rà lại. */}
      {txnNeedingAction > 0 ? (
        <p className="mb-4 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-sm text-amber-900">
          Có {txnNeedingAction.toLocaleString("vi-VN")} giao dịch thanh toán cần xử lý (không tìm thấy đơn hoặc sai số tiền).{" "}
          <Link href={`${basePath}/giao-dich`} className="font-semibold underline">
            Xem giao dịch cần xử lý
          </Link>
        </p>
      ) : null}
      <RefundRequestNotice basePath={basePath} data={data} />
      <OrderFilterBar basePath={basePath} data={data} today={todayIsoVn()} />
      <OrderList basePath={basePath} tenantSlug={tenantSlug} data={data} />
    </div>
  );
}
