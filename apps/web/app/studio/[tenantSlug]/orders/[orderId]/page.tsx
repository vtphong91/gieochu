import Link from "next/link";
import { notFound } from "next/navigation";
import { AppError } from "@gieochu/core";
import { brandColors } from "@gieochu/config/theme";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { getOrderDetailView, type OrderDetailLine } from "../../../../../lib/order";
import { isManualConfirmProvider } from "@gieochu/payments";
import { MarkRefundedButton } from "./order-status-actions";
import { OrderStatusButton } from "../_ui/order-status-dialog";
import { GrantExtraDownloadsForm, RevokeEntitlementButton } from "./entitlement-actions";
import { AddOrderNoteForm, DeleteOrderNoteButton } from "./order-note-actions";
import { Badge, MainAsideGrid } from "../../../../admin/_ui/kit";
import { IconBank, IconChevronLeft, IconDoc, IconReceipt, IconBolt } from "../../../../admin/_ui/icons";
import { OrderItemRemedy, RefundRequestBadge } from "../_ui/remedy-parts";
import { DeclaredPaidBadge, DeclaredPaidNotice } from "../_ui/declared-paid";
import { CustomerHistoryCard, DateTimeValue, DetailCard, InfoList, OrderItemsTable, OrderNotesCard, OrderTimeline } from "../_ui/order-detail-parts";
import { formatOrderDateTime, formatOrderPrice, formatOrderVnd, orderListBackHref, orderStatusLabel, orderStatusTone, paymentChannelText } from "../_ui/order-format";

/*
 * ADR-046 mục 2 — chi tiết đơn Studio, bố cục 2 cột kiểu "Sửa đơn hàng" (từ xl; dưới xl cột phụ xếp xuống dưới).
 * Cột chính: Thông tin chung + Khách hàng (họ tên, email — ADR-041), dòng tài liệu + tổng + quyền tải (ADR-039), giao dịch.
 * Cột phụ: Thao tác đơn ("Đổi trạng thái…" theo `statusTargets` — ADR-068; hoàn tiền 2 bước theo `allowedActions`), Lịch sử khách hàng, Ghi chú nội bộ
 * (ADR-047 — form thêm; ghi chú hiện trong Lịch sử đơn, tác giả xoá được), Lịch sử đơn.
 * `?back=` giữ bộ lọc danh sách cho nút quay lại.
 */

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const PRIMARY = brandColors.primary;
const LINE = "#E5E7EB";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const ORDER_ACTIONS_ID = "order-actions";

const MATCH_STATUS: Record<string, { label: string; tone: "success" | "warning" | "danger" }> = {
  MATCHED: { label: "Khớp đơn", tone: "success" },
  UNMATCHED: { label: "Không khớp đơn", tone: "warning" },
  MISMATCH_AMOUNT: { label: "Sai số tiền", tone: "danger" },
};
const PROVIDER_SHORT: Record<string, string> = { MANUAL_QR: "QR thủ công", SEPAY: "SePay", MOMO: "MoMo", MOMO_MANUAL: "MoMo (thủ công)" };

export default async function StudioOrderDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; orderId: string }>;
  searchParams: Promise<{ back?: string | string[] }>;
}) {
  const { tenantSlug, orderId } = await params;
  const { back } = await searchParams;
  const { tenant, user } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/orders/${orderId}`);

  let order;
  try {
    order = await getOrderDetailView(tenant.id, orderId, user.userId);
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }

  const now = new Date();
  const listPath = `/studio/${tenantSlug}/orders`;
  const backHref = orderListBackHref(listPath, back);
  // ADR-068: đổi trạng thái (Đã thanh toán / mở lại / huỷ) theo `statusTargets` do server tính; hoàn tiền giữ mục riêng (ADR-046).
  const canChangeStatus = order.statusTargets.length > 0;
  const canRefund = order.allowedActions.includes("refund");
  const hasActions = canChangeStatus || canRefund;
  // Cổng khách đã chọn (đơn chưa trả: kênh UNPAID mang `provider`) — để hộp đổi trạng thái nhắc khi huỷ đơn cổng tự xác nhận.
  const orderProvider = order.paymentChannel.kind === "FREE" ? null : order.paymentChannel.provider;

  function entitlementBlock(line: OrderDetailLine) {
    const ent = line.entitlement;
    if (!ent) return null;
    return (
      <div className="rounded-xl border p-3.5 text-sm" style={{ borderColor: LINE, background: "#F9FAFB" }}>
        <p className="font-medium" style={{ color: INK }}>
          <span className="sr-only">Quyền tải: </span>
          {ent.revokedAt ? (
            <>
              Quyền tải đã bị thu hồi lúc <DateTimeValue date={ent.revokedAt} />
            </>
          ) : (
            <span className="tabular-nums">
              Đã tải {ent.downloadsUsed}
              {ent.downloadLimit === 0 ? " lượt · không giới hạn" : ` / ${ent.downloadLimit} lượt`}
            </span>
          )}
        </p>
        {ent.revokedAt ? null : (
          <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            {/* ADR-039 bổ sung (b): đã có remedy thì không đổi được downloadLimit — ẩn "Cấp thêm lượt". */}
            {ent.remedyStatus === "NONE" ? (
              <GrantExtraDownloadsForm tenantSlug={tenantSlug} orderId={orderId} entitlementId={ent.id} />
            ) : (
              <p className="text-xs" style={{ color: INK_SOFT }}>
                Không cấp thêm lượt được cho tài liệu bị gỡ do vi phạm.
              </p>
            )}
            <RevokeEntitlementButton tenantSlug={tenantSlug} orderId={orderId} entitlementId={ent.id} />
          </div>
        )}
        {ent.remedyStatus !== "NONE" ? (
          <div className="mt-3">
            <OrderItemRemedy
              status={ent.remedyStatus}
              chosenAt={ent.remedyChosenAt}
              resolvedAt={ent.remedyResolvedAt}
              now={now}
              canMarkRefunded={canRefund}
              actionsAnchorId={ORDER_ACTIONS_ID}
            />
          </div>
        ) : null}
      </div>
    );
  }

  const main = (
    <>
      <DetailCard id="order-info" title="Thông tin chung" icon={<IconReceipt className="h-4 w-4" />}>
        <div className="grid gap-6 lg:grid-cols-2">
          <InfoList
            items={[
              { label: "Mã đơn", value: <span className="font-mono">{order.code}</span> },
              ...(order.paymentRef
                ? [{ label: "Mã thanh toán SePay", value: <span className="font-mono select-all">{order.paymentRef}</span> }]
                : []),
              { label: "Ngày tạo", value: <DateTimeValue date={order.createdAt} /> },
              { label: "Ngày thanh toán", value: <DateTimeValue date={order.paidAt} empty="Chưa thanh toán" /> },
              ...(order.paidAt ? [] : [{ label: "Hạn thanh toán", value: <DateTimeValue date={order.expiresAt} /> }]),
              { label: "Kênh thanh toán", value: paymentChannelText(order.paymentChannel) },
              {
                label: "Trạng thái",
                value: (
                  <span className="flex flex-wrap gap-1.5">
                    <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
                    {order.refundRequested ? <RefundRequestBadge overdue={order.refundOverdue} /> : null}
                    <DeclaredPaidBadge order={order} />
                  </span>
                ),
              },
              ...(order.customerDeclaredPaidAt
                ? [{ label: "Khách báo đã chuyển lúc", value: <DateTimeValue date={order.customerDeclaredPaidAt} /> }]
                : []),
              ...(order.confirmNote ? [{ label: "Ghi chú xác nhận", value: <span className="font-normal">{order.confirmNote}</span> }] : []),
            ]}
          />
          <div className="border-t pt-5 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-6" style={{ borderColor: LINE }}>
            <h3 className="mb-3 text-sm font-semibold" style={{ color: INK }}>
              Khách hàng
            </h3>
            <InfoList
              items={[
                { label: "Họ tên", value: order.customer.fullName ?? <span className="font-normal italic" style={{ color: INK_SOFT }}>Chưa có họ tên</span> },
                {
                  label: "Email",
                  value: (
                    <a href={`mailto:${order.customer.email}`} className={`underline-offset-2 hover:underline ${FOCUS}`} style={{ color: PRIMARY }}>
                      {order.customer.email}
                    </a>
                  ),
                },
              ]}
            />
          </div>
        </div>
      </DetailCard>

      <DetailCard id="order-items" title="Tài liệu trong đơn" icon={<IconDoc className="h-4 w-4" />}>
        <OrderItemsTable
          items={order.lines}
          productHref={(productId) => `/studio/${tenantSlug}/products/${productId}`}
          subtotalVnd={order.subtotalVnd}
          discountVnd={order.discountVnd}
          totalVnd={order.totalVnd}
          couponCode={order.couponCode}
          renderEntitlement={(lineId) => {
            const line = order.lines.find((l) => l.id === lineId);
            return line ? entitlementBlock(line) : null;
          }}
        />
      </DetailCard>

      {order.transactions.length > 0 ? (
        <DetailCard id="order-transactions" title="Giao dịch thanh toán" icon={<IconBank className="h-4 w-4" />}>
          <ul className="divide-y divide-gray-100 text-sm">
            {order.transactions.map((txn) => {
              const match = MATCH_STATUS[txn.matchStatus] ?? { label: txn.matchStatus, tone: "warning" as const };
              return (
                <li key={txn.id} className="flex flex-col gap-1 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                  <div className="min-w-0">
                    <p className="font-medium [overflow-wrap:anywhere]" style={{ color: INK }}>
                      {PROVIDER_SHORT[txn.provider] ?? txn.provider} · <span className="font-mono text-xs">{txn.providerTxnId}</span>
                    </p>
                    <p className="text-xs tabular-nums" style={{ color: INK_SOFT }}>
                      <time dateTime={txn.createdAt.toISOString()}>{formatOrderDateTime(txn.createdAt)}</time>
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-semibold tabular-nums" style={{ color: INK }}>
                      {formatOrderVnd(txn.amountVnd)}
                    </span>
                    <Badge tone={match.tone}>{match.label}</Badge>
                  </div>
                </li>
              );
            })}
          </ul>
        </DetailCard>
      ) : null}
    </>
  );

  const aside = (
    <>
      <DetailCard id={ORDER_ACTIONS_ID} title="Thao tác đơn" icon={<IconBolt className="h-4 w-4" />}>
        {hasActions ? (
          <div className="space-y-4">
            {canChangeStatus ? (
              <div>
                <h3 className="text-sm font-semibold" style={{ color: INK }}>
                  Trạng thái đơn
                </h3>
                <p className="mt-1 mb-3 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
                  Xác nhận đã nhận tiền, mở lại hoặc huỷ đơn. Đối chiếu sao kê trước khi xác nhận thanh toán.
                </p>
                <DeclaredPaidNotice order={order} />
                <OrderStatusButton
                  tenantSlug={tenantSlug}
                  info={{
                    orderId,
                    code: order.code,
                    totalLabel: formatOrderVnd(order.totalVnd),
                    currentStatusLabel: orderStatusLabel(order.status),
                    targets: order.statusTargets,
                    expired: order.status === "EXPIRED",
                    autoProvider: orderProvider ? !isManualConfirmProvider(orderProvider) : null,
                  }}
                />
              </div>
            ) : null}
            {canRefund ? (
              <div className={canChangeStatus ? "border-t pt-4" : undefined} style={{ borderColor: LINE }}>
                <MarkRefundedButton tenantSlug={tenantSlug} orderId={orderId} />
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-sm" style={{ color: INK_SOFT }}>
            Không còn thao tác nào cho đơn ở trạng thái “{orderStatusLabel(order.status)}”.
          </p>
        )}
      </DetailCard>
      <CustomerHistoryCard history={order.customerHistory} />
      <OrderNotesCard
        available={order.notesAvailable}
        count={order.notes.length}
        form={<AddOrderNoteForm tenantSlug={tenantSlug} orderId={orderId} />}
      />
      <OrderTimeline
        events={order.timeline}
        notes={order.notes}
        renderNoteDelete={(noteId, timeText) => (
          <DeleteOrderNoteButton tenantSlug={tenantSlug} orderId={orderId} noteId={noteId} timeText={timeText} />
        )}
      />
    </>
  );

  // Nằm trong app shell Studio (layout đã có <main>) → dùng <div>.
  return (
    <div className="px-5 py-8 lg:px-8">
      <Link
        href={backHref}
        className={`-ml-2 inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm font-semibold hover:bg-gray-100 lg:min-h-9 ${FOCUS}`}
        style={{ color: INK }}
      >
        <IconChevronLeft className="h-4 w-4" />
        Danh sách đơn hàng
      </Link>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h1 className="font-[family-name:var(--font-heading)] text-2xl font-bold [overflow-wrap:anywhere]" style={{ color: INK }}>
            Đơn hàng <span className="font-mono">#{order.code}</span>
          </h1>
          <p className="mt-1 text-sm" style={{ color: INK_SOFT }}>
            Tạo lúc <DateTimeValue date={order.createdAt} /> · {formatOrderPrice(order.totalVnd)}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge tone={orderStatusTone(order.status)}>{orderStatusLabel(order.status)}</Badge>
          {order.refundRequested ? <RefundRequestBadge overdue={order.refundOverdue} /> : null}
        </div>
      </div>

      <MainAsideGrid main={main} aside={aside} asideLabel="Thao tác và lịch sử đơn" />
    </div>
  );
}
