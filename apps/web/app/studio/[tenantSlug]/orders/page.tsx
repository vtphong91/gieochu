import Link from "next/link";
import type { OrderStatus } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listOrders, type OrderListFilters } from "../../../../lib/order";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FULFILLED: "Hoàn tất",
  EXPIRED: "Đã hết hạn",
  CANCELED: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
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
    <main className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="text-2xl font-bold">Đơn hàng</h1>

      <div className="mt-4 flex flex-wrap gap-2 text-sm">
        <Link href={`/studio/${tenantSlug}/orders`} className={!status ? "font-semibold underline" : "text-gray-500"}>
          Tất cả
        </Link>
        {VALID_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/studio/${tenantSlug}/orders?status=${s}`}
            className={status === s ? "font-semibold underline" : "text-gray-500"}
          >
            {STATUS_LABEL[s]}
          </Link>
        ))}
      </div>

      <ul className="mt-6 divide-y rounded border">
        {orders.length === 0 ? <li className="p-4 text-sm text-gray-500">Chưa có đơn hàng nào.</li> : null}
        {orders.map((order) => (
          <li key={order.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <Link href={`/studio/${tenantSlug}/orders/${order.id}`} className="font-medium hover:underline">
                {order.code}
              </Link>
              <p className="text-gray-500">
                {order.customer.email} · {order.items.map((item) => item.titleSnapshot).join(", ")}
              </p>
            </div>
            <div className="text-right">
              <p>{order.totalVnd.toLocaleString("vi-VN")}đ</p>
              <p className="text-gray-500">{STATUS_LABEL[order.status] ?? order.status}</p>
            </div>
          </li>
        ))}
      </ul>
    </main>
  );
}
