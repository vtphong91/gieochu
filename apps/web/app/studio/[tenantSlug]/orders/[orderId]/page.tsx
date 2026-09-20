import { notFound } from "next/navigation";
import { AppError, canManuallyConfirmOrder, type OrderStatus } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { getOrderDetail } from "../../../../../lib/order";
import { ConfirmForm } from "./confirm-form";
import { CancelOrderButton, MarkRefundedButton } from "./order-status-actions";
import { GrantExtraDownloadsForm, RevokeEntitlementButton } from "./entitlement-actions";
import { AdminPageHeader, Badge } from "../../../../admin/_ui/kit";

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

const MATCH_STATUS_LABEL: Record<string, string> = {
  MATCHED: "Khớp",
  UNMATCHED: "Không tìm thấy đơn",
  MISMATCH_AMOUNT: "Sai số tiền",
};

function formatVnDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

export default async function StudioOrderDetailPage({
  params,
}: {
  params: Promise<{ tenantSlug: string; orderId: string }>;
}) {
  const { tenantSlug, orderId } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/orders/${orderId}`);

  let order;
  try {
    order = await getOrderDetail(tenant.id, orderId);
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }

  const now = new Date();
  const canConfirm = canManuallyConfirmOrder(order.status as OrderStatus, order.expiresAt, now);
  const canCancel = order.status === "PENDING";
  const canRefund = order.status === "FULFILLED";

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title={`Đơn hàng ${order.code}`}
        subtitle={order.customer.email}
        action={<Badge tone={STATUS_TONE[order.status] ?? "neutral"}>{STATUS_LABEL[order.status] ?? order.status}</Badge>}
      />

      <section className="mt-6 max-w-[960px] rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
        <ul className="space-y-2 text-sm">
          {order.items.map((item) => (
            <li key={item.id}>
              <div className="flex justify-between">
                <span>{item.titleSnapshot}</span>
                <span>{item.finalPriceVnd.toLocaleString("vi-VN")}đ</span>
              </div>
              {item.entitlement ? (
                <div className="mt-1 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    {item.entitlement.revokedAt
                      ? "Quyền tải đã bị thu hồi"
                      : `Đã tải ${item.entitlement.downloadsUsed}${item.entitlement.downloadLimit === 0 ? "" : `/${item.entitlement.downloadLimit}`} lượt`}
                  </span>
                  {item.entitlement.revokedAt ? null : (
                    <div className="flex items-center gap-3">
                      <GrantExtraDownloadsForm tenantSlug={tenantSlug} orderId={orderId} entitlementId={item.entitlement.id} />
                      <RevokeEntitlementButton tenantSlug={tenantSlug} orderId={orderId} entitlementId={item.entitlement.id} />
                    </div>
                  )}
                </div>
              ) : null}
            </li>
          ))}
        </ul>
        <div className="mt-3 space-y-1 border-t pt-3 text-sm">
          <div className="flex justify-between text-gray-500">
            <span>Tạm tính</span>
            <span>{order.subtotalVnd.toLocaleString("vi-VN")}đ</span>
          </div>
          {order.discountVnd > 0 ? (
            <div className="flex justify-between text-gray-500">
              <span>Giảm giá {order.couponCode ? `(${order.couponCode})` : ""}</span>
              <span>-{order.discountVnd.toLocaleString("vi-VN")}đ</span>
            </div>
          ) : null}
          <div className="flex justify-between text-base font-semibold">
            <span>Tổng cộng</span>
            <span>{order.totalVnd.toLocaleString("vi-VN")}đ</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-gray-400">Hết hạn lúc {formatVnDateTime(order.expiresAt)}</p>
        {order.paidAt ? <p className="text-xs text-gray-400">Thanh toán lúc {formatVnDateTime(order.paidAt)}</p> : null}
        {order.confirmNote ? <p className="mt-2 text-sm text-gray-600">Ghi chú xác nhận: {order.confirmNote}</p> : null}
      </section>

      {order.transactions.length > 0 ? (
        <section className="mt-6 max-w-[960px]">
          <h2 className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: "#12213A" }}>
            Giao dịch
          </h2>
          <ul className="mt-2 divide-y rounded-2xl border bg-white" style={{ borderColor: "#E5E7EB" }}>
            {order.transactions.map((txn) => (
              <li key={txn.id} className="flex items-center justify-between p-3.5 text-sm" style={{ borderColor: "#E5E7EB" }}>
                <span>
                  {txn.provider} · {txn.providerTxnId}
                </span>
                <span>{txn.amountVnd.toLocaleString("vi-VN")}đ</span>
                <span className="text-gray-500">{MATCH_STATUS_LABEL[txn.matchStatus] ?? txn.matchStatus}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-6 flex max-w-[960px] flex-wrap items-start gap-3">
        {canConfirm ? (
          <div className="w-full rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
            <h2 className="font-[family-name:var(--font-heading)] text-sm font-semibold" style={{ color: "#12213A" }}>
              Xác nhận thanh toán thủ công
            </h2>
            <div className="mt-3">
              <ConfirmForm tenantSlug={tenantSlug} orderId={orderId} />
            </div>
          </div>
        ) : null}
        {canCancel ? <CancelOrderButton tenantSlug={tenantSlug} orderId={orderId} /> : null}
        {canRefund ? <MarkRefundedButton tenantSlug={tenantSlug} orderId={orderId} /> : null}
      </section>
    </main>
  );
}
