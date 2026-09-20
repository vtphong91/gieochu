import Link from "next/link";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { listCustomerOrders } from "../../../lib/library";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ thanh toán",
  PAID: "Đã thanh toán",
  FULFILLED: "Hoàn tất",
  EXPIRED: "Đã hết hạn",
  CANCELED: "Đã huỷ",
  REFUNDED: "Đã hoàn tiền",
};

function formatVnDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

/** §"M9": "Lịch sử đơn hàng ... mở lại trang checkout cho đơn PENDING". */
export default async function AccountOrdersPage() {
  const user = await requireVerifiedAccess("/account/orders");
  const orders = await listCustomerOrders(user.userId);

  return (
    <main className="mx-auto max-w-2xl px-4 py-16">
      <h1 className="text-2xl font-bold">Lịch sử đơn hàng</h1>

      <ul className="mt-6 divide-y rounded border">
        {orders.length === 0 ? <li className="p-4 text-sm text-gray-500">Bạn chưa có đơn hàng nào.</li> : null}
        {orders.map((order) => (
          <li key={order.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              {order.status === "PENDING" ? (
                <Link href={`/${order.tenantSlug}/checkout/${order.code}`} className="font-medium hover:underline">
                  {order.code}
                </Link>
              ) : (
                <span className="font-medium">{order.code}</span>
              )}
              <p className="text-gray-500">
                {order.tenantName} · {order.productTitle} · {formatVnDateTime(order.createdAt)}
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
