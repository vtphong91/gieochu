import type { Metadata } from "next";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { requireVerifiedAccess } from "../../../lib/page-guards";
import { listCustomerOrders } from "../../../lib/library";
import { AdminPageHeader, Badge, DataTable, EmptyState, Td, Tr } from "../../admin/_ui/kit";
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

/**
 * §"M9": lịch sử đơn hàng — đơn PENDING còn hạn có nút mở lại trang thanh toán. Cùng mẫu danh sách Studio
 * (`studio/[tenantSlug]/orders`): từ `xl` là bảng (`DataTable`), dưới `xl` là thẻ (2 cột từ `md`, đọc tốt cả 360px).
 */
export default async function AccountOrdersPage() {
  const user = await requireVerifiedAccess("/account/orders");
  const orders = await listCustomerOrders(user.userId);
  const caption = `Lịch sử đơn hàng, ${orders.length.toLocaleString("vi-VN")} đơn`;

  return (
    <div>
      <AdminPageHeader
        title="Đơn hàng"
        subtitle={
          <>
            Lịch sử mua tài liệu của bạn ở mọi gian hàng. Tài liệu đã thanh toán nằm trong{" "}
            <Link href="/account/library" className="font-semibold underline outline-offset-2 focus-visible:outline-2" style={{ color: BLUE, outlineColor: BLUE }}>
              Thư viện
            </Link>
            .
          </>
        }
      />

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
          <>
            {/* ≥ xl: bảng */}
            <div className="hidden xl:block">
              <DataTable
                caption={caption}
                head={[
                  "Mã đơn",
                  "Ngày tạo",
                  "Tài liệu · Gian hàng",
                  "Trạng thái",
                  "Tổng tiền",
                  <span key="actions" className="sr-only">
                    Thao tác
                  </span>,
                ]}
                headClassName={[undefined, undefined, "w-[38%]", undefined, "text-right", "text-right"]}
              >
                {orders.map((order) => {
                  const status = orderStatus(order.status);
                  return (
                    <Tr key={order.id}>
                      <Td>
                        <span className="font-semibold whitespace-nowrap tabular-nums" style={{ color: INK }}>
                          {order.code}
                        </span>
                      </Td>
                      <Td>
                        <time dateTime={order.createdAt.toISOString()} className="tabular-nums" style={{ color: INK_SOFT }}>
                          {formatVnDateTime(order.createdAt)}
                        </time>
                      </Td>
                      <Td>
                        {/* Gộp gian hàng vào cột tài liệu (dòng phụ) để bảng 6 cột vừa 1280px, không cuộn ngang. */}
                        <span className="block [overflow-wrap:anywhere]" style={{ color: INK }}>
                          {order.productTitle}
                        </span>
                        <span className="mt-0.5 block [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                          <span className="sr-only">Gian hàng: </span>
                          {order.tenantName}
                        </span>
                      </Td>
                      <Td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                      </Td>
                      <Td className="text-right">
                        <span className="font-semibold whitespace-nowrap tabular-nums" style={{ color: INK }}>
                          {formatVnd(order.totalVnd)}
                        </span>
                      </Td>
                      <Td className="text-right">{order.status === "PENDING" ? <ContinuePaymentLink order={order} /> : null}</Td>
                    </Tr>
                  );
                })}
              </DataTable>
            </div>

            {/* < xl: thẻ */}
            <ul aria-label={caption} className="grid gap-3 md:grid-cols-2 xl:hidden">
              {orders.map((order) => {
                const status = orderStatus(order.status);
                return (
                  <li key={order.id} className="min-w-0 rounded-2xl border bg-white p-4 sm:p-5" style={{ borderColor: LINE }}>
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
                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t pt-3" style={{ borderColor: LINE }}>
                      <p className="text-base font-semibold tabular-nums" style={{ color: INK }}>
                        {formatVnd(order.totalVnd)}
                      </p>
                      {order.status === "PENDING" ? <ContinuePaymentLink order={order} /> : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function orderStatus(status: string) {
  return STATUS[status] ?? { label: status, tone: "neutral" as const };
}

function ContinuePaymentLink({ order }: { order: { code: string; tenantSlug: string } }) {
  return (
    <Link
      href={`/${order.tenantSlug}/checkout/${order.code}`}
      className="inline-flex min-h-11 items-center justify-center rounded-lg px-4 text-sm font-semibold whitespace-nowrap text-white outline-offset-2 hover:brightness-110 focus-visible:outline-2 lg:min-h-10"
      style={{ background: BLUE, outlineColor: BLUE }}
    >
      Thanh toán tiếp
      <span className="sr-only"> đơn {order.code}</span>
    </Link>
  );
}
