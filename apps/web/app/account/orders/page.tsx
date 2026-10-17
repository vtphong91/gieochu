import type { Metadata } from "next";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { listCustomerOrders } from "../../../lib/library";
import { Badge, EmptyState } from "../../admin/_ui/kit";
import { IconReceipt } from "../../admin/_ui/icons";
import { formatVnDateTime, formatVnd } from "../_ui/format";

export const metadata: Metadata = { title: "Đơn hàng", robots: { index: false, follow: false } };

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
const LINE = "#E5E7EB";

const STATUS: Record<string, { label: string; tone: "success" | "warning" | "neutral" | "info" | "danger" }> = {
  PENDING: { label: "Chờ thanh toán", tone: "warning" },
  PAID: { label: "Đã thanh toán", tone: "success" },
  FULFILLED: { label: "Hoàn tất", tone: "success" },
  EXPIRED: { label: "Đã hết hạn", tone: "neutral" },
  CANCELED: { label: "Đã huỷ", tone: "neutral" },
  REFUNDED: { label: "Đã hoàn tiền", tone: "info" },
};

/** §"M9": lịch sử đơn hàng — đơn PENDING còn hạn có nút mở lại trang thanh toán. Thẻ một cột (đọc tốt cả 360px). */
export default async function AccountOrdersPage() {
  const user = await requireVerifiedAccess("/account/orders");
  const orders = await listCustomerOrders(user.userId);

  return (
    <div className="mx-auto w-full max-w-3xl">
      <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold" style={{ color: INK }}>
        Đơn hàng
      </h1>
      <p className="mt-1.5 text-sm" style={{ color: INK_SOFT }}>
        Lịch sử mua tài liệu của bạn ở mọi gian hàng. Tài liệu đã thanh toán nằm trong{" "}
        <Link href="/account/library" className="font-semibold underline outline-offset-2 focus-visible:outline-2" style={{ color: BLUE, outlineColor: BLUE }}>
          Thư viện
        </Link>
        .
      </p>

      <div className="mt-6">
        {orders.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title="Bạn chưa có đơn hàng nào"
            description="Tài liệu bạn mua sẽ xuất hiện ở đây kèm trạng thái thanh toán."
            action={
              <Link
                href="/cua-hang"
                className="inline-flex min-h-11 items-center justify-center rounded-lg px-5 text-sm font-semibold text-white outline-offset-2 hover:brightness-110 focus-visible:outline-2"
                style={{ background: BLUE, outlineColor: BLUE }}
              >
                Khám phá tài liệu
              </Link>
            }
          />
        ) : (
          <ul className="space-y-3">
            {orders.map((order) => {
              const status = STATUS[order.status] ?? { label: order.status, tone: "neutral" as const };
              return (
                <li key={order.id} className="rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: LINE }}>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold tabular-nums" style={{ color: INK }}>
                          <span className="sr-only">Mã đơn </span>
                          {order.code}
                        </span>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </p>
                      <p className="mt-1 text-[15px] [overflow-wrap:anywhere]" style={{ color: INK }}>
                        {order.productTitle}
                      </p>
                      <p className="mt-0.5 text-sm [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                        {order.tenantName} · <time dateTime={order.createdAt.toISOString()}>{formatVnDateTime(order.createdAt)}</time>
                      </p>
                    </div>
                    <div className="flex shrink-0 flex-row items-center justify-between gap-3 sm:flex-col sm:items-end">
                      <p className="text-base font-semibold tabular-nums" style={{ color: INK }}>
                        {formatVnd(order.totalVnd)}
                      </p>
                      {order.status === "PENDING" ? (
                        <Link
                          href={`/${order.tenantSlug}/checkout/${order.code}`}
                          className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold text-white outline-offset-2 hover:brightness-110 focus-visible:outline-2 lg:min-h-10"
                          style={{ background: BLUE, outlineColor: BLUE }}
                        >
                          Thanh toán tiếp
                          <span className="sr-only"> đơn {order.code}</span>
                        </Link>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
