import { requireTenantMemberPage } from "../../../lib/page-guards";
import { getOrderDashboardStats } from "../../../lib/order";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { REMEDY_REFUND_SLA_DAYS } from "@gieochu/core/entitlement-remedy";
import { countNewTenantReviews } from "../../../lib/review";
import { countPendingRefundRequests } from "../../../lib/entitlement-remedy";
import { AdminPageHeader } from "../../admin/_ui/kit";
import { IconAlertTriangle } from "../../admin/_ui/icons";

export default async function StudioDashboardPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}`);
  const [stats, newReviews7d, refundRequests] = await Promise.all([
    getOrderDashboardStats(tenant.id),
    countNewTenantReviews(tenant.id),
    countPendingRefundRequests(tenant.id),
  ]);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title={tenant.name} subtitle={`/${tenant.slug} · trạng thái: ${tenant.status}`} />

      {refundRequests.pending > 0 ? (
        <RefundRequestsAlert tenantSlug={tenant.slug} pending={refundRequests.pending} overdue={refundRequests.overdue} />
      ) : null}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatCard label="Doanh thu 30 ngày" value={`${stats.revenue30dVnd.toLocaleString("vi-VN")}đ`} />
        <StatCard label="Đơn chờ xác nhận" value={String(stats.pendingOrdersCount)} />
        <StatCard label="Sản phẩm bán chạy" note="Cần M5/M6 — Sản phẩm, Giá" />
        <StatCard label="Đánh giá mới" value={String(newReviews7d)} note="7 ngày gần nhất" />
      </div>
    </main>
  );
}

function StatCard({ label, value, note }: { label: string; value?: string; note?: string }) {
  return (
    <div className="rounded-2xl border bg-white p-5" style={{ borderColor: "#E5E7EB" }}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value ?? "—"}</p>
      {note ? <p className="mt-1 text-xs text-gray-400">{note}</p> : null}
    </div>
  );
}

/** ADR-039: khối nhắc yêu cầu hoàn tiền đang chờ (tint + viền trái, chữ `ink`; quá hạn → viền đỏ + câu chữ nói rõ). */
function RefundRequestsAlert({ tenantSlug, pending, overdue }: { tenantSlug: string; pending: number; overdue: number }) {
  const urgent = overdue > 0;
  return (
    <div
      className="mt-6 flex flex-col gap-3 rounded-xl border border-l-4 p-4 text-sm leading-relaxed sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: urgent ? "#B91C1C" : brandColors.accent, background: urgent ? "#FEF2F2" : brandColors.accentSoft, color: brandColors.ink }}
    >
      <div className="flex items-start gap-2.5">
        <span aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: urgent ? "#B91C1C" : "#92400E" }}>
          <IconAlertTriangle className="h-5 w-5" />
        </span>
        <div className="min-w-0">
          <p className="font-semibold">
            {pending} yêu cầu hoàn tiền đang chờ xử lý{urgent ? ` — ${overdue} đã quá hạn ${REMEDY_REFUND_SLA_DAYS} ngày` : ""}.
          </p>
          <p className="mt-0.5">
            Khách đã chọn hoàn tiền cho tài liệu bị gỡ do vi phạm chính sách. Hãy hoàn tiền trong {REMEDY_REFUND_SLA_DAYS} ngày rồi đánh dấu đã hoàn
            tiền trên đơn hàng.
          </p>
        </div>
      </div>
      <Link
        href={`/studio/${tenantSlug}/orders?remedy=REFUND_REQUESTED`}
        className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold text-white hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]"
        style={{ background: brandColors.primary }}
      >
        Xem yêu cầu hoàn tiền
      </Link>
    </div>
  );
}
