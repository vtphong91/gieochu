import Link from "next/link";
import type { OrderStatus } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listOrders, type OrderListFilters } from "../../../../lib/order";
import { AdminPageHeader, Badge, DataTable, EmptyState, Td, Tr } from "../../../admin/_ui/kit";
import { IconReceipt } from "../../../admin/_ui/icons";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FULFILLED: "Hoàn tất",
  EXPIRED: "Đã hết hạn",
  CANCELED: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
};

const STATUS_TONE: Record<string, "success" | "warning" | "danger" | "neutral" | "info"> = {
  PENDING: "warning",
  PAID: "info",
  FULFILLED: "success",
  EXPIRED: "neutral",
  CANCELED: "danger",
  REFUNDED: "neutral",
};

const VALID_STATUSES: OrderStatus[] = ["PENDING", "PAID", "FULFILLED", "EXPIRED", "CANCELED", "REFUNDED"];

export default async function StudioOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ status?: string }>;
}) {
  const { tenantSlug } = await params;
  const { status } = await searchParams;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/orders`);

  const filters: OrderListFilters = {};
  if (status && VALID_STATUSES.includes(status as OrderStatus)) filters.status = status as OrderStatus;

  const orders = await listOrders(tenant.id, filters);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Đơn hàng" subtitle="Danh sách đơn hàng — lọc theo trạng thái." />

      <div className="mt-6 flex flex-wrap gap-2">
        <Link
          href={`/studio/${tenantSlug}/orders`}
          className="rounded-full px-4 py-1.5 text-sm font-semibold transition"
          style={!status ? { background: "#D97706", color: "white" } : { background: "white", color: "#4B5563", border: "1px solid #E5E7EB" }}
        >
          Tất cả
        </Link>
        {VALID_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/studio/${tenantSlug}/orders?status=${s}`}
            className="rounded-full px-4 py-1.5 text-sm font-semibold transition"
            style={status === s ? { background: "#D97706", color: "white" } : { background: "white", color: "#4B5563", border: "1px solid #E5E7EB" }}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <div className="mt-4">
        {orders.length === 0 ? (
          <EmptyState icon={<IconReceipt className="h-6 w-6" />} title="Chưa có đơn hàng nào" />
        ) : (
          <DataTable head={["Mã đơn", "Khách hàng", "Sản phẩm", "Tổng tiền", "Trạng thái"]}>
            {orders.map((order) => (
              <Tr key={order.id}>
                <Td>
                  <Link href={`/studio/${tenantSlug}/orders/${order.id}`} className="font-mono text-xs font-semibold hover:underline">
                    {order.code}
                  </Link>
                </Td>
                <Td className="text-gray-500">{order.customer.email}</Td>
                <Td className="max-w-[220px] truncate text-gray-500">{order.items.map((item) => item.titleSnapshot).join(", ")}</Td>
                <Td className="font-medium">{order.totalVnd.toLocaleString("vi-VN")}đ</Td>
                <Td>
                  <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
                </Td>
              </Tr>
            ))}
          </DataTable>
        )}
      </div>
    </main>
  );
}
