import Link from "next/link";
import {
  SUBSCRIPTION_REFUND_STATUS_LABELS,
  SUBSCRIPTION_REFUND_STATUSES,
  SUBSCRIPTION_REFUND_WINDOW_DAYS,
  type SubscriptionRefundStatusValue,
} from "@gieochu/core/subscription-refund";
import { brandColors } from "@gieochu/config/theme";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { formatRefundDate, listRefundRequestsForAdmin, type AdminRefundListItem } from "../../../../lib/subscription-refund";
import { AdminPageHeader, Badge, EmptyState, Notice } from "../../_ui/kit";
import { IconAlertTriangle, IconReceipt } from "../../_ui/icons";
import { RefundDecision, RevealPayout } from "./refund-actions";

const STATUS_TONE: Record<SubscriptionRefundStatusValue, "warning" | "success" | "danger"> = {
  REQUESTED: "warning",
  APPROVED_REFUNDED: "success",
  REJECTED: "danger",
};

const INK = brandColors.ink;
const INK_SOFT = "#4B5563";
const LINE = "#E5E7EB";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
/** Khớp `ADMIN_LIST_LIMIT` của `listRefundRequestsForAdmin` — chạm mốc thì báo đang cắt bớt. */
const LIST_LIMIT = 100;

function vnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

/**
 * ADR-041 B — System Center duyệt hoàn tiền gói. Mỗi yêu cầu là một thẻ (`article`) ở mọi độ rộng: thông tin hoá đơn, thông tin
 * nhận tiền (che, "Xem đầy đủ"), quyết định. Chỉ dữ liệu billing L1 của tenant (tên gian hàng, hoá đơn gói) — không đơn
 * hàng/khách hàng của tenant (§7.9). Wrapper <div>: layout admin đã có <main>.
 */
export default async function AdminRefundsPage({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requireAdminAccess("/admin/billing/refunds");
  const { status: statusParam } = await searchParams;
  const status = (SUBSCRIPTION_REFUND_STATUSES as readonly string[]).includes(statusParam ?? "") ? (statusParam as SubscriptionRefundStatusValue) : undefined;
  const list = await listRefundRequestsForAdmin({ status });
  const filters: { href: string; label: string; active: boolean }[] = [
    { href: "/admin/billing/refunds", label: "Tất cả", active: !status },
    ...SUBSCRIPTION_REFUND_STATUSES.map((value) => ({
      href: `/admin/billing/refunds?status=${value}`,
      label: SUBSCRIPTION_REFUND_STATUS_LABELS[value],
      active: status === value,
    })),
  ];

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Hoàn tiền gói dịch vụ"
        subtitle={`Yêu cầu hoàn 100% lần thanh toán gói đầu tiên (trong ${SUBSCRIPTION_REFUND_WINDOW_DAYS} ngày). Chuyển khoản tay cho chủ gian hàng rồi bấm “Đã hoàn tiền” — gian hàng tự về gói Miễn phí. Cổng thanh toán không tự hoàn.`}
      />

      <nav aria-label="Lọc theo trạng thái" className="mt-6">
        <ul className="flex flex-wrap gap-2">
          {filters.map((filter) => (
            <li key={filter.href}>
              <Link
                href={filter.href}
                aria-current={filter.active ? "page" : undefined}
                className={`inline-flex min-h-11 items-center rounded-full border px-4 text-sm font-semibold transition-colors lg:min-h-9 ${FOCUS}`}
                style={filter.active ? { background: brandColors.primary, borderColor: brandColors.primary, color: "#FFFFFF" } : { borderColor: LINE, color: INK, background: "#FFFFFF" }}
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <div className="mt-6">
        {!list.available ? (
          <Notice tone="warning">Chức năng hoàn tiền gói chưa sẵn sàng (cơ sở dữ liệu chưa được cập nhật).</Notice>
        ) : list.items.length === 0 ? (
          <EmptyState
            icon={<IconReceipt className="h-6 w-6" />}
            title={status ? `Không có yêu cầu nào ở trạng thái “${SUBSCRIPTION_REFUND_STATUS_LABELS[status]}”` : "Chưa có yêu cầu hoàn tiền nào"}
            description="Yêu cầu mới do chủ gian hàng gửi từ Studio → Gói dịch vụ sẽ hiện ở đây."
          />
        ) : (
          <>
            <p className="mb-3 text-sm" style={{ color: INK_SOFT }}>
              {list.items.length} yêu cầu{list.items.length >= LIST_LIMIT ? ` — đang hiển thị ${LIST_LIMIT} yêu cầu gần nhất` : ""}. Yêu cầu đang chờ xếp trước.
            </p>
            <ul className="space-y-4">
              {list.items.map((item) => (
                <li key={item.id}>
                  <RefundCard item={item} />
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </div>
  );
}

function RefundCard({ item }: { item: AdminRefundListItem }) {
  const pending = item.status === "REQUESTED";
  const titleId = `refund-${item.id}-title`;
  const facts: [string, string][] = [
    ["Hoá đơn", item.invoice.code],
    ["Gói", item.invoice.planName],
    ...(item.invoice.paidAt ? ([["Thanh toán lúc", formatRefundDate(item.invoice.paidAt)]] as [string, string][]) : []),
    ["Gửi yêu cầu lúc", formatRefundDate(item.createdAt)],
    ...(item.decidedAt ? ([["Xử lý lúc", formatRefundDate(item.decidedAt)]] as [string, string][]) : []),
  ];

  return (
    <article aria-labelledby={titleId} className="rounded-2xl border bg-white" style={{ borderColor: pending ? "#FDE68A" : LINE }}>
      <header className="flex flex-wrap items-start justify-between gap-3 border-b px-4 py-3 sm:px-5" style={{ borderColor: LINE }}>
        <div className="min-w-0">
          <h2 id={titleId} className="font-[family-name:var(--font-heading)] font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
            {item.tenant.name}
          </h2>
          <p className="text-xs [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
            /{item.tenant.slug}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-[family-name:var(--font-heading)] text-lg font-bold tabular-nums" style={{ color: INK }}>
            {vnd(item.amountVnd)}
          </span>
          <Badge tone={STATUS_TONE[item.status]}>{SUBSCRIPTION_REFUND_STATUS_LABELS[item.status]}</Badge>
        </div>
      </header>

      <div className="grid gap-5 px-4 py-4 sm:px-5 lg:grid-cols-2 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 space-y-3">
          <dl className="grid grid-cols-[max-content_minmax(0,1fr)] gap-x-3 gap-y-1 text-sm">
            {facts.map(([label, value]) => (
              <div key={label} className="contents">
                <dt style={{ color: INK_SOFT }}>{label}</dt>
                <dd className={`[overflow-wrap:anywhere] ${label === "Hoá đơn" ? "font-mono" : "font-medium"}`} style={{ color: INK }}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {item.reason ? (
            <div className="text-sm">
              <p className="font-medium" style={{ color: INK }}>
                Lý do của chủ gian hàng
              </p>
              <p className="mt-0.5 whitespace-pre-line [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                {item.reason}
              </p>
            </div>
          ) : null}
          {item.adminNote ? (
            <div className="text-sm">
              <p className="font-medium" style={{ color: INK }}>
                {item.status === "REJECTED" ? "Lý do từ chối" : "Ghi chú của quản trị viên"}
              </p>
              <p className="mt-0.5 whitespace-pre-line [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
                {item.adminNote}
              </p>
            </div>
          ) : null}
        </div>

        <section aria-label={`Thông tin nhận tiền — ${item.tenant.name}`} className="min-w-0">
          <p className="mb-1.5 text-sm font-medium" style={{ color: INK }}>
            Thông tin nhận tiền
          </p>
          {pending ? (
            item.payoutMasked ? (
              <RevealPayout requestId={item.id} bankName={item.payoutMasked.bankName} accountNoMasked={item.payoutMasked.accountNoMasked} />
            ) : (
              <p className="flex items-start gap-1.5 text-sm" style={{ color: "#B91C1C" }}>
                <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> Không đọc được thông tin nhận tiền — liên hệ chủ gian hàng trước khi chuyển khoản.
              </p>
            )
          ) : (
            <p className="text-sm" style={{ color: INK_SOFT }}>
              Đã xoá sau khi xử lý.
            </p>
          )}
        </section>

        {pending ? (
          <section aria-label={`Xử lý yêu cầu — ${item.tenant.name}`} className="min-w-0 lg:col-span-2 2xl:col-span-1">
            {item.approveBlocked ? (
              <div className="mb-3">
                <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
                  <strong>Không thể đánh dấu “Đã hoàn tiền”.</strong> Gian hàng đã thanh toán thêm hoá đơn gói sau lần đầu nên mất quyền hoàn tiền — chỉ có thể từ chối (liên
                  hệ chủ gian hàng nếu cần xử lý riêng).
                </Notice>
              </div>
            ) : null}
            <RefundDecision requestId={item.id} amountLabel={vnd(item.amountVnd)} canApprove={!item.approveBlocked} />
          </section>
        ) : null}
      </div>
    </article>
  );
}
