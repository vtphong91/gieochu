import Link from "next/link";
import type { OrderStatus } from "@gieochu/core";
import { brandColors } from "@gieochu/config/theme";
import { REMEDY_REFUND_SLA_DAYS } from "@gieochu/core/entitlement-remedy";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listOrders, parseOrderRemedyFilter, type OrderListFilters } from "../../../../lib/order";
import { countPendingRefundRequests } from "../../../../lib/entitlement-remedy";
import { AdminPageHeader, Badge, DataTable, EmptyState, Td, Tr } from "../../../admin/_ui/kit";
import { IconReceipt } from "../../../admin/_ui/icons";
import { RefundRequestBadge, isRefundOverdue } from "./_ui/remedy-parts";

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

const CHIP =
  "inline-flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors motion-reduce:transition-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)] lg:min-h-9";
// Chip đang chọn: nền primary + chữ trắng (≈10:1). Chip thường: nền trắng, chữ xám 7:1.
const CHIP_ACTIVE = { background: brandColors.primary, color: "white", borderColor: brandColors.primary };
const CHIP_IDLE = { background: "white", color: "#4B5563", borderColor: "#E5E7EB" };

export default async function StudioOrdersPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ status?: string; remedy?: string }>;
}) {
  const { tenantSlug } = await params;
  const sp = await searchParams;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/orders`);

  const status = sp.status && VALID_STATUSES.includes(sp.status as OrderStatus) ? (sp.status as OrderStatus) : undefined;
  const remedy = parseOrderRemedyFilter(sp.remedy);
  const filters: OrderListFilters = {};
  if (status) filters.status = status;
  if (remedy) filters.remedy = remedy;

  const [orders, refundCounts] = await Promise.all([listOrders(tenant.id, filters), countPendingRefundRequests(tenant.id)]);
  const now = new Date();

  const base = `/studio/${tenantSlug}/orders`;
  function hrefFor(next: { status?: OrderStatus; remedy?: OrderListFilters["remedy"] }) {
    const query = new URLSearchParams();
    if (next.status) query.set("status", next.status);
    if (next.remedy) query.set("remedy", next.remedy);
    const qs = query.toString();
    return qs ? `${base}?${qs}` : base;
  }

  const filtered = Boolean(status || remedy);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Đơn hàng" subtitle="Danh sách đơn hàng — lọc theo trạng thái hoặc yêu cầu hoàn tiền của khách." />

      <nav aria-label="Lọc đơn hàng" className="mt-6 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={hrefFor({ status, remedy: remedy ? undefined : "REFUND_REQUESTED" })}
            aria-current={remedy ? "page" : undefined}
            className={CHIP}
            style={remedy ? CHIP_ACTIVE : CHIP_IDLE}
          >
            Yêu cầu hoàn tiền
            {refundCounts.pending > 0 ? (
              <span
                className="inline-flex min-w-6 items-center justify-center rounded-full px-1.5 text-xs font-bold"
                style={remedy ? { background: "white", color: brandColors.primary } : { background: "#B91C1C", color: "white" }}
              >
                {refundCounts.pending}
                <span className="sr-only"> yêu cầu đang chờ{refundCounts.overdue > 0 ? `, ${refundCounts.overdue} quá hạn` : ""}</span>
              </span>
            ) : null}
          </Link>
          {refundCounts.overdue > 0 ? (
            <span className="text-sm font-semibold" style={{ color: "#B91C1C" }} aria-hidden="true">
              {refundCounts.overdue} quá hạn {REMEDY_REFUND_SLA_DAYS} ngày
            </span>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href={hrefFor({ remedy })} aria-current={!status ? "page" : undefined} className={CHIP} style={!status ? CHIP_ACTIVE : CHIP_IDLE}>
            Tất cả trạng thái
          </Link>
          {VALID_STATUSES.map((s) => (
            <Link key={s} href={hrefFor({ status: s, remedy })} aria-current={status === s ? "page" : undefined} className={CHIP} style={status === s ? CHIP_ACTIVE : CHIP_IDLE}>
              {STATUS_LABEL[s]}
            </Link>
          ))}
        </div>
      </nav>

      <div className="mt-4">
        {orders.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title={remedy ? "Không có yêu cầu hoàn tiền nào đang chờ" : filtered ? "Không có đơn hàng phù hợp bộ lọc" : "Chưa có đơn hàng nào"}
            description={remedy ? "Khi khách chọn hoàn tiền cho tài liệu bị gỡ do vi phạm, đơn hàng sẽ hiện ở đây." : undefined}
            action={
              filtered ? (
                <Link href={base} className={CHIP} style={CHIP_IDLE}>
                  Xem tất cả đơn hàng
                </Link>
              ) : undefined
            }
          />
        ) : (
          <DataTable
            caption={remedy ? "Đơn hàng có yêu cầu hoàn tiền" : "Danh sách đơn hàng"}
            head={["Mã đơn", "Khách hàng", "Sản phẩm", "Tổng tiền", "Trạng thái"]}
            headClassName={[undefined, "hidden md:table-cell", "hidden lg:table-cell", undefined, undefined]}
          >
            {orders.map((order) => {
              const refundItem = order.items.find((item) => item.entitlement?.remedyStatus === "REFUND_REQUESTED")?.entitlement ?? null;
              const overdue = refundItem ? isRefundOverdue("REFUND_REQUESTED", refundItem.remedyChosenAt, now) : false;
              return (
                <Tr key={order.id}>
                  <Td>
                    <Link href={`${base}/${order.id}`} className="font-mono text-xs font-semibold hover:underline">
                      {order.code}
                    </Link>
                    <span className="mt-0.5 block max-w-[160px] truncate text-xs text-gray-500 md:hidden" title={order.customer.email}>{order.customer.email}</span>
                  </Td>
                  <Td className="hidden text-gray-500 md:table-cell">{order.customer.email}</Td>
                  <Td className="hidden max-w-[220px] truncate text-gray-500 lg:table-cell">{order.items.map((item) => item.titleSnapshot).join(", ")}</Td>
                  <Td className="font-medium whitespace-nowrap">{order.totalVnd.toLocaleString("vi-VN")}đ</Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{STATUS_LABEL[order.status] ?? order.status}</Badge>
                      {order.refundRequested ? <RefundRequestBadge overdue={overdue} /> : null}
                    </div>
                  </Td>
                </Tr>
              );
            })}
          </DataTable>
        )}
      </div>
    </main>
  );
}
