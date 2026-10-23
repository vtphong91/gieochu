import type { ReactNode } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { DASHBOARD_CUSTOM_MAX_DAYS } from "@gieochu/core/dashboard-range";
import { REMEDY_REFUND_SLA_DAYS } from "@gieochu/core/entitlement-remedy";
import type { TenantDashboard } from "../../../../../lib/tenant-dashboard";
import { AdminPageHeader, DataTable, Notice, Td, Tr } from "../../../../admin/_ui/kit";
import {
  IconAlertTriangle,
  IconCheckCircle,
  IconChevronDown,
  IconExternalLink,
  IconGift,
  IconLock,
  IconPackage,
  IconPlus,
  IconReceipt,
  IconShoppingBag,
  IconStarOutline,
  IconStarSolid,
  IconTag,
  IconUsers,
  IconWallet,
  IconXCircle,
} from "../../../../admin/_ui/icons";
import {
  ChangeLine,
  KpiCard,
  RatioBar,
  STAT_CARD_CLASS,
  STAT_INK,
  STAT_INK_SOFT,
  StatIcon,
  statValueSizeClass,
  TrendChart,
  computeChange,
  formatCount,
  formatVndFull,
  type TrendPoint,
} from "../../../../admin/_ui/stats-chart";
import {
  CHART_SECTION_ID,
  GRANULARITY_UNIT,
  bucketFullLabel,
  formatPercent,
  formatRating,
  formatVnDateTime,
  vnDateInputValue,
  type StudioChartMetric,
} from "./dashboard-format";
import { StudioDashboardRangePicker } from "./dashboard-range-picker";
import { RevenueChartSwitcher, type RevenueChartPoint } from "./revenue-chart-switcher";

/**
 * ADR-043 — giao diện dashboard Tổng quan gian hàng (`/studio/{slug}`). Chỉ trình bày: nhận `TenantDashboard` đã tính
 * sẵn (`getTenantDashboard`) qua prop. Không lộ email khách (bảng 10 đơn chỉ có họ tên). Thứ tự khối: việc cần xử lý →
 * KPI bán hàng → biểu đồ + bán chạy → 10 đơn mới nhất → khách / đánh giá / tài liệu.
 */

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]";
const INK = STAT_INK;
const INK_SOFT = STAT_INK_SOFT;

const TEXT_LINK = `inline-flex min-h-11 items-center gap-1 text-sm font-semibold underline-offset-2 hover:underline lg:min-h-0 ${FOCUS}`;

export interface StudioDashboardTenant {
  name: string;
  slug: string;
  status: string;
}

export function StudioDashboardView({ tenant, data, metric }: { tenant: StudioDashboardTenant; data: TenantDashboard; metric: StudioChartMetric }) {
  const neverSold = data.latestOrders.length === 0;
  return (
    <div className="space-y-8 px-5 py-8 lg:px-8">
      <AdminPageHeader
        title={tenant.name}
        subtitle={`/${tenant.slug} · trạng thái: ${tenant.status}`}
        action={
          <p className="text-xs sm:text-right" style={{ color: INK_SOFT }}>
            Cập nhật lúc <span className="font-semibold tabular-nums">{formatVnDateTime(data.generatedAt)}</span>
            <br className="hidden sm:block" /> <span className="sm:hidden">·</span> giờ Việt Nam
          </p>
        }
      />

      <AlertsSection slug={tenant.slug} data={data} />

      {neverSold ? (
        <Onboarding slug={tenant.slug} products={data.products} />
      ) : (
        <>
          <RangeBar slug={tenant.slug} data={data} />
          <SalesSection data={data} />
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
            <SalesChartCard data={data} metric={metric} />
            <TopSellingCard slug={tenant.slug} data={data} />
          </div>
          <LatestOrdersSection slug={tenant.slug} orders={data.latestOrders} />
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            <CustomersCard slug={tenant.slug} data={data} />
            <ReviewsCard slug={tenant.slug} data={data} />
            <ProductsCard slug={tenant.slug} data={data} />
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ Thanh chọn kỳ */

/** ADR-043 lần 3: tiêu đề kỳ + ô `dd/mm/yyyy - dd/mm/yyyy` mở date range picker (client `dashboard-range-picker.tsx` bọc `admin/_ui/date-range-picker.tsx`). */
function RangeBar({ slug, data }: { slug: string; data: TenantDashboard }) {
  const { range } = data;
  return (
    <section aria-labelledby="ky-thong-ke-title" className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
        <div className="min-w-0">
          <h2 id="ky-thong-ke-title" className="font-[family-name:var(--font-heading)] text-lg font-bold" style={{ color: INK }}>
            Kỳ thống kê: {range.label}
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: INK_SOFT }}>
            So với {range.prevLabel}
          </p>
        </div>
        <StudioDashboardRangePicker
          slug={slug}
          activeKey={range.key}
          displayFrom={range.displayFrom}
          displayTo={range.displayTo}
          today={vnDateInputValue(data.generatedAt)}
        />
      </div>

      {range.invalid ? (
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <p>
            Khoảng thời gian trên địa chỉ không hợp lệ (ngày bắt đầu phải trước ngày kết thúc, không sau hôm nay, tối đa{" "}
            {DASHBOARD_CUSTOM_MAX_DAYS} ngày) — đang hiển thị <strong>{range.label}</strong>.
          </p>
        </Notice>
      ) : null}
    </section>
  );
}

/* ------------------------------------------------------------------ Việc cần xử lý */

function AlertsSection({ slug, data }: { slug: string; data: TenantDashboard }) {
  const { refundRequests, pendingOrders } = data.sales;
  const items: Array<{ key: string; icon: ReactNode; text: string; href: string; cta: string }> = [];
  if (data.reviews.unanswered > 0) {
    items.push({
      key: "reviews",
      icon: <IconStarOutline className="h-4 w-4" />,
      text: `${formatCount(data.reviews.unanswered)} đánh giá đang hiển thị chưa được trả lời`,
      href: `/studio/${slug}/reviews?status=VISIBLE`,
      cta: "Trả lời đánh giá",
    });
  }
  if (data.products.moderationLocked > 0) {
    items.push({
      key: "locked",
      icon: <IconLock className="h-4 w-4" />,
      text: `${formatCount(data.products.moderationLocked)} tài liệu đang bị khoá kiểm duyệt`,
      href: `/studio/${slug}/products`,
      cta: "Xem tài liệu",
    });
  }
  if (pendingOrders > 0) {
    items.push({
      key: "pending",
      icon: <IconReceipt className="h-4 w-4" />,
      text: `${formatCount(pendingOrders)} đơn đang chờ khách thanh toán`,
      href: `/studio/${slug}/orders?trang-thai=PENDING`,
      cta: "Xem đơn chờ",
    });
  }
  if (refundRequests.pending === 0 && items.length === 0) return null;

  return (
    <section aria-labelledby="viec-can-xu-ly-title" className="space-y-3">
      <h2 id="viec-can-xu-ly-title" className="font-[family-name:var(--font-heading)] text-lg font-bold" style={{ color: INK }}>
        Việc cần xử lý
      </h2>
      {refundRequests.pending > 0 ? <RefundRequestsAlert tenantSlug={slug} pending={refundRequests.pending} overdue={refundRequests.overdue} /> : null}
      {items.length > 0 ? (
        <ul className={`${STAT_CARD_CLASS} divide-y divide-gray-200`}>
          {items.map((it) => (
            <li key={it.key} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <span className="flex items-start gap-2.5 text-sm" style={{ color: INK }}>
                <span aria-hidden="true" className="mt-0.5 shrink-0" style={{ color: brandColors.accent }}>
                  {it.icon}
                </span>
                {it.text}
              </span>
              <Link href={it.href} className={`${TEXT_LINK} shrink-0 sm:ml-4`} style={{ color: brandColors.primary }}>
                {it.cta}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** ADR-039: khối nhắc yêu cầu hoàn tiền đang chờ (tint + viền trái, chữ `ink`; quá hạn → viền đỏ + câu chữ nói rõ). */
function RefundRequestsAlert({ tenantSlug, pending, overdue }: { tenantSlug: string; pending: number; overdue: number }) {
  const urgent = overdue > 0;
  return (
    <div
      className="flex flex-col gap-3 rounded-xl border border-l-4 p-4 text-sm leading-relaxed sm:flex-row sm:items-center sm:justify-between"
      style={{ borderColor: urgent ? "#B91C1C" : brandColors.accent, background: urgent ? "#FEF2F2" : brandColors.accentSoft, color: INK }}
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
        className={`inline-flex min-h-11 shrink-0 items-center justify-center rounded-full px-5 text-sm font-semibold text-white hover:brightness-110 ${FOCUS}`}
        style={{ background: brandColors.primary }}
      >
        Xem yêu cầu hoàn tiền
      </Link>
    </div>
  );
}

/* ------------------------------------------------------------------ KPI bán hàng */

function SalesSection({ data }: { data: TenantDashboard }) {
  const s = data.sales;
  const cmp = data.range.prevLabel;
  return (
    <section aria-labelledby="ban-hang-title" className="space-y-4">
      <div>
        <h2 id="ban-hang-title" className="font-[family-name:var(--font-heading)] text-lg font-bold" style={{ color: INK }}>
          Bán hàng
        </h2>
        <p className="mt-1 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
          Đơn có thời điểm khách trả tiền trong kỳ. Không tính tài liệu miễn phí (đơn 0 đ) — xem riêng ở thẻ “Lượt nhận tài liệu miễn phí”.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="Doanh thu (gộp)"
          icon={<IconWallet className="h-5 w-5" />}
          value={formatVndFull(s.grossRevenueVnd.current)}
          note="Tính cả đơn sau này hoàn tiền — cùng cách tính của System Center."
          change={computeChange(s.grossRevenueVnd.current, s.grossRevenueVnd.previous)}
          compareLabel={cmp}
        />
        <KpiCard
          label="Doanh thu thực nhận"
          icon={<IconCheckCircle className="h-5 w-5" />}
          iconTone="secondary"
          value={formatVndFull(s.netRevenueVnd.current)}
          note={`Đã trừ ${formatCount(s.refundedOrders.current)} đơn hoàn tiền (theo ngày khách trả tiền).`}
          change={computeChange(s.netRevenueVnd.current, s.netRevenueVnd.previous)}
          compareLabel={cmp}
        />
        <KpiCard
          label="Đơn đã thanh toán"
          icon={<IconReceipt className="h-5 w-5" />}
          value={formatCount(s.paidOrders.current)}
          note="Gồm cả đơn sau này hoàn tiền."
          change={computeChange(s.paidOrders.current, s.paidOrders.previous)}
          compareLabel={cmp}
        />
        <KpiCard
          label="Giá trị đơn trung bình"
          icon={<IconTag className="h-5 w-5" />}
          iconTone="accent"
          value={s.avgOrderVnd.current === null ? "—" : formatVndFull(s.avgOrderVnd.current)}
          detail={s.avgOrderVnd.current === null ? "Chưa có đơn trong kỳ" : undefined}
          note="Doanh thu gộp ÷ số đơn đã thanh toán."
          change={computeChange(s.avgOrderVnd.current, s.avgOrderVnd.previous)}
          compareLabel={cmp}
        />
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <SecondaryStat
          icon={<IconXCircle className="h-4 w-4" />}
          label="Đã hoàn tiền"
          value={formatVndFull(s.refundedVnd.current)}
          detail={`${formatCount(s.refundedOrders.current)} đơn`}
          change={
            <ChangeLine change={computeChange(s.refundedVnd.current, s.refundedVnd.previous)} compareLabel={cmp} higherIsBetter={false} />
          }
        />
        <SecondaryStat
          icon={<IconPackage className="h-4 w-4" />}
          label="Tài liệu khác nhau đã bán"
          value={formatCount(s.distinctProductsSold.current)}
          change={<ChangeLine change={computeChange(s.distinctProductsSold.current, s.distinctProductsSold.previous)} compareLabel={cmp} />}
        />
        <SecondaryStat
          icon={<IconGift className="h-4 w-4" />}
          label="Lượt nhận tài liệu miễn phí"
          value={formatCount(s.freeClaims.current)}
          detail="Đơn 0 đ — không tính vào doanh thu và số đơn."
          change={<ChangeLine change={computeChange(s.freeClaims.current, s.freeClaims.previous)} compareLabel={cmp} />}
        />
      </div>
    </section>
  );
}

function SecondaryStat({ icon, label, value, detail, change }: { icon: ReactNode; label: string; value: string; detail?: string; change: ReactNode }) {
  return (
    <div className={`${STAT_CARD_CLASS} flex items-start gap-3 p-4`}>
      <StatIcon icon={icon} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium" style={{ color: INK_SOFT }}>
          {label}
        </p>
        <p className={`${statValueSizeClass(value, "secondary")} font-bold tabular-nums [overflow-wrap:anywhere]`} style={{ color: INK }}>
          {value}
        </p>
        {detail ? (
          <p className="text-xs tabular-nums [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
            {detail}
          </p>
        ) : null}
        {change}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ Biểu đồ */

function SalesChartCard({ data, metric }: { data: TenantDashboard; metric: StudioChartMetric }) {
  const { range, series } = data;
  const unit = GRANULARITY_UNIT[range.granularity];
  const labels = series.map((p) => bucketFullLabel(p.start, range.granularity));
  const revenuePoints: RevenueChartPoint[] = series.map((p, i) => ({
    key: p.key,
    tick: p.label,
    label: labels[i] ?? p.label,
    future: p.future,
    grossVnd: p.grossRevenueVnd,
    netVnd: p.netRevenueVnd,
  }));
  const orderPoints: TrendPoint[] = series.map((p, i) => ({
    key: p.key,
    tick: p.label,
    label: labels[i] ?? p.label,
    future: p.future,
    value: BigInt(p.paidOrders),
  }));
  const hasFuture = series.some((p) => p.future);

  return (
    <section id={CHART_SECTION_ID} aria-labelledby={`${CHART_SECTION_ID}-title`} className={`${STAT_CARD_CLASS} scroll-mt-20 p-5 sm:p-6 xl:col-span-2`}>
      {/* Gộp / Thực nhận đổi tức thì ở client (`replaceState` giữ `?chi-so=`) — không render lại trang ở server. */}
      <RevenueChartSwitcher
        titleId={`${CHART_SECTION_ID}-title`}
        unit={unit}
        hasFuture={hasFuture}
        initialMetric={metric}
        points={revenuePoints}
      />

      <h3 className="mt-8 font-[family-name:var(--font-heading)] text-sm font-bold" style={{ color: INK }}>
        Đơn đã thanh toán theo {unit}
      </h3>
      <p className="mt-0.5 mb-4 text-xs" style={{ color: INK_SOFT }}>
        Đơn vị: đơn · đường màu cam
      </p>
      <TrendChart
        points={orderPoints}
        variant="line"
        heightClass="h-28"
        color={brandColors.accent}
        integerScale
        metricName={`Đơn đã thanh toán theo ${unit}`}
        formatAxis={(v) => `${formatCount(v)} đơn`}
        formatFull={(v) => `${formatCount(v)} đơn`}
        emptyText="Không có đơn đã thanh toán trong kỳ này."
      />

      <details className="group mt-5 rounded-xl border border-gray-200">
        <summary
          className={`flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 text-sm font-semibold [&::-webkit-details-marker]:hidden ${FOCUS}`}
          style={{ color: brandColors.primary }}
        >
          Xem bảng số liệu theo {unit}
          <IconChevronDown className="h-4 w-4 shrink-0 group-open:rotate-180 motion-safe:transition-transform" />
        </summary>
        {/* Bảng 4 cột có thể rộng hơn 360px → cuộn trong khung riêng (relative để thead sticky đúng chỗ), trang không cuộn ngang. */}
        <div className="relative max-h-96 overflow-auto border-t border-gray-200">
          <table className="w-full min-w-[28rem] text-left text-sm tabular-nums">
            <caption className="sr-only">
              Doanh thu và số đơn đã thanh toán theo từng {unit}, {range.label}
            </caption>
            <thead className="sticky top-0 bg-white">
              <tr className="border-b border-gray-200" style={{ color: INK_SOFT }}>
                <th scope="col" className="px-4 py-2.5 font-medium">
                  Thời gian
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Doanh thu gộp
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Thực nhận
                </th>
                <th scope="col" className="px-4 py-2.5 text-right font-medium">
                  Đơn
                </th>
              </tr>
            </thead>
            <tbody>
              {series
                .map((p, i) => ({ p, label: labels[i] ?? p.label }))
                .filter(({ p }) => !p.future)
                .reverse()
                .map(({ p, label }) => (
                  <tr key={p.key} className="border-b border-gray-200 last:border-0" style={{ color: INK }}>
                    <th scope="row" className="px-4 py-2 font-normal first-letter:uppercase">
                      {label}
                    </th>
                    <td className="px-4 py-2 text-right">{formatVndFull(p.grossRevenueVnd)}</td>
                    <td className="px-4 py-2 text-right">{formatVndFull(p.netRevenueVnd)}</td>
                    <td className="px-4 py-2 text-right">{formatCount(p.paidOrders)}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </details>
    </section>
  );
}

/* ------------------------------------------------------------------ Bán chạy */

function TopSellingCard({ slug, data }: { slug: string; data: TenantDashboard }) {
  const items = data.products.topSelling;
  const maxOrders = items.reduce((m, t) => Math.max(m, t.orders), 0);
  return (
    <section aria-labelledby="ban-chay-title" className={`${STAT_CARD_CLASS} p-5 sm:p-6`}>
      <h2 id="ban-chay-title" className="font-[family-name:var(--font-heading)] text-base font-bold" style={{ color: INK }}>
        Top 5 tài liệu bán chạy
      </h2>
      <p className="mt-0.5 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
        {data.range.label} · theo số đơn, không tính đơn đã hoàn tiền, gồm lượt nhận miễn phí
      </p>
      {items.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: INK_SOFT }}>
          Chưa có tài liệu nào được mua trong kỳ này.
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {items.map((t, i) => (
            <li key={t.productId} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                style={{ background: brandColors.surface, color: brandColors.primary }}
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <Link
                  href={`/studio/${slug}/products/${t.productId}`}
                  className={`${TEXT_LINK} max-w-full [overflow-wrap:anywhere]`}
                  style={{ color: INK }}
                >
                  <span className="sr-only">Hạng {i + 1}: </span>
                  <span className="line-clamp-2">{t.title}</span>
                </Link>
                <div className="mt-1.5">
                  <RatioBar ratio={maxOrders > 0 ? t.orders / maxOrders : 0} />
                </div>
                <p className="mt-1 text-xs tabular-nums" style={{ color: INK_SOFT }}>
                  <span className="font-semibold" style={{ color: INK }}>
                    {formatCount(t.orders)} đơn
                  </span>{" "}
                  · <span className="whitespace-nowrap">{formatVndFull(t.revenueVnd)}</span> · đã bán từ trước tới nay {formatCount(t.soldAllTime)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ 10 đơn mới nhất */

function LatestOrdersSection({ slug, orders }: { slug: string; orders: TenantDashboard["latestOrders"] }) {
  return (
    <section aria-labelledby="don-moi-title" className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 id="don-moi-title" className="font-[family-name:var(--font-heading)] text-lg font-bold" style={{ color: INK }}>
            10 đơn hàng mới nhất
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: INK_SOFT }}>
            Mọi trạng thái, không phụ thuộc kỳ đã chọn.
          </p>
        </div>
        <Link href={`/studio/${slug}/orders`} className={TEXT_LINK} style={{ color: brandColors.primary }}>
          Xem tất cả đơn hàng
        </Link>
      </div>
      <DataTable
        caption="10 đơn hàng mới nhất của gian hàng"
        head={["Mã đơn", "Khách hàng", "Đơn giá", "Thành tiền"]}
        headClassName={[undefined, undefined, "hidden text-right sm:table-cell", "text-right"]}
      >
        {orders.map((o) => (
          <Tr key={o.id}>
            <Td>
              <Link
                href={`/studio/${slug}/orders/${o.id}`}
                className={`${TEXT_LINK} font-mono whitespace-nowrap`}
                style={{ color: brandColors.primary }}
              >
                {o.code}
              </Link>
            </Td>
            <Td className="[overflow-wrap:anywhere]">
              <span className="inline-flex min-h-11 items-center lg:min-h-0" style={{ color: INK }}>
                {o.customerFullName}
              </span>
            </Td>
            <Td className="hidden text-right tabular-nums sm:table-cell">
              <span className="inline-flex min-h-11 items-center lg:min-h-0" style={{ color: INK }}>
                {formatVndFull(o.unitPriceVnd)}
              </span>
            </Td>
            <Td className="text-right tabular-nums">
              <span className="inline-flex min-h-11 items-center font-semibold whitespace-nowrap lg:min-h-0" style={{ color: INK }}>
                {formatVndFull(o.totalVnd)}
              </span>
            </Td>
          </Tr>
        ))}
      </DataTable>
    </section>
  );
}

/* ------------------------------------------------------------------ Thẻ nhóm */

function GroupCard({ id, title, icon, children, link }: { id: string; title: string; icon: ReactNode; children: ReactNode; link: { href: string; label: string } }) {
  return (
    <section aria-labelledby={`${id}-title`} className={`${STAT_CARD_CLASS} flex flex-col p-5 sm:p-6`}>
      <div className="flex items-center gap-3">
        <StatIcon icon={icon} size="sm" />
        <h2 id={`${id}-title`} className="font-[family-name:var(--font-heading)] text-base font-bold" style={{ color: INK }}>
          {title}
        </h2>
      </div>
      <div className="mt-4 flex-1">{children}</div>
      <div className="mt-4 border-t border-gray-200 pt-2">
        <Link href={link.href} className={TEXT_LINK} style={{ color: brandColors.primary }}>
          {link.label}
        </Link>
      </div>
    </section>
  );
}

/** Một dòng chỉ số trong thẻ nhóm: nhãn trái, số phải; `hint` (vd "hiện tại") và xu hướng ở dưới. */
function MetricRow({ label, value, hint, change }: { label: string; value: string; hint?: string; change?: ReactNode }) {
  return (
    <div className="border-b border-gray-200 py-2.5 last:border-0">
      <div className="flex items-baseline justify-between gap-3">
        <dt className="text-sm" style={{ color: INK_SOFT }}>
          {label}
          {hint ? <span className="ml-1 text-xs">({hint})</span> : null}
        </dt>
        <dd className="text-base font-semibold tabular-nums" style={{ color: INK }}>
          {value}
        </dd>
      </div>
      {change ? <div className="-mt-1">{change}</div> : null}
    </div>
  );
}

function CustomersCard({ slug, data }: { slug: string; data: TenantDashboard }) {
  const c = data.customers;
  const cmp = data.range.prevLabel;
  const rate = c.returningCustomerRate.current;
  return (
    <GroupCard id="khach" title="Khách hàng" icon={<IconUsers className="h-4 w-4" />} link={{ href: `/studio/${slug}/customers`, label: "Xem khách hàng" }}>
      <dl>
        <MetricRow
          label="Khách mới"
          value={formatCount(c.newCustomers.current)}
          change={<ChangeLine change={computeChange(c.newCustomers.current, c.newCustomers.previous)} compareLabel={cmp} />}
        />
        <MetricRow
          label="Người mua trong kỳ"
          value={formatCount(c.buyers.current)}
          change={<ChangeLine change={computeChange(c.buyers.current, c.buyers.previous)} compareLabel={cmp} />}
        />
        <MetricRow label="Tỷ lệ khách quay lại" value={rate === null ? "—" : formatPercent(rate)} />
      </dl>
      <p className="mt-2 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
        {rate === null
          ? "Chưa có người mua trong kỳ."
          : `${formatCount(c.returningCustomers.current)}/${formatCount(c.buyers.current)} người mua đã thanh toán từ 2 đơn trở lên tại gian hàng.`}{" "}
        Khách mới gồm cả khách chỉ nhận tài liệu miễn phí.
      </p>
    </GroupCard>
  );
}

function ReviewsCard({ slug, data }: { slug: string; data: TenantDashboard }) {
  const r = data.reviews;
  const cmp = data.range.prevLabel;
  const total = r.distribution.reduce((a, b) => a + b, 0);
  const avg = r.avgRating.current;
  return (
    <GroupCard id="danh-gia" title="Đánh giá" icon={<IconStarOutline className="h-4 w-4" />} link={{ href: `/studio/${slug}/reviews`, label: "Quản lý đánh giá" }}>
      <div className="flex items-center gap-3">
        <p className="flex shrink-0 items-baseline gap-1 whitespace-nowrap" style={{ color: INK }}>
          <span className="text-3xl font-bold tabular-nums">{avg === null ? "—" : formatRating(avg)}</span>
          <span className="text-sm" style={{ color: INK_SOFT }}>
            / 5
          </span>
        </p>
        <span style={{ color: brandColors.accent }}>
          <IconStarSolid className="h-6 w-6" />
        </span>
        <p className="text-xs leading-snug" style={{ color: INK_SOFT }}>
          {total > 0 ? `Điểm trung bình của ${formatCount(total)} đánh giá đang hiển thị, viết trong kỳ` : "Chưa có đánh giá đang hiển thị trong kỳ"}
        </p>
      </div>
      {total > 0 ? (
        <ul className="mt-4 space-y-1.5" aria-label="Phân bố số sao của đánh giá trong kỳ">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = r.distribution[star - 1] ?? 0;
            const ratio = count / total;
            return (
              <li key={star} className="grid grid-cols-[3rem_minmax(0,1fr)_5.5rem] items-center gap-2 text-xs tabular-nums" style={{ color: INK }}>
                <span>{star} sao</span>
                <RatioBar ratio={ratio} color={brandColors.accent} />
                <span className="text-right" style={{ color: INK_SOFT }}>
                  {formatCount(count)} · {formatPercent(ratio)}
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
      <dl className="mt-3">
        <MetricRow
          label="Đánh giá mới"
          value={formatCount(r.newReviews.current)}
          change={<ChangeLine change={computeChange(r.newReviews.current, r.newReviews.previous)} compareLabel={cmp} />}
        />
        <MetricRow label="Chưa trả lời" hint="hiện tại" value={formatCount(r.unanswered)} />
        <MetricRow label="Bị ẩn trong kỳ" value={formatCount(r.hiddenInPeriod.current)} />
        <MetricRow label="Đang ẩn" hint="hiện tại" value={formatCount(r.hiddenTotal)} />
        {r.moderationLocked > 0 ? <MetricRow label="Bị khoá kiểm duyệt" hint="hiện tại" value={formatCount(r.moderationLocked)} /> : null}
      </dl>
    </GroupCard>
  );
}

function ProductsCard({ slug, data }: { slug: string; data: TenantDashboard }) {
  const p = data.products;
  const cmp = data.range.prevLabel;
  return (
    <GroupCard id="tai-lieu" title="Tài liệu" icon={<IconPackage className="h-4 w-4" />} link={{ href: `/studio/${slug}/products`, label: "Quản lý tài liệu" }}>
      <dl className="grid grid-cols-2 gap-2">
        <StatusTile label="Công khai" value={p.published} />
        <StatusTile label="Nháp" value={p.draft} />
        <StatusTile label="Lưu trữ" value={p.archived} />
        <StatusTile label="Bị khoá kiểm duyệt" value={p.moderationLocked} warn={p.moderationLocked > 0} />
      </dl>
      <p className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
        Số tài liệu hiện tại theo trạng thái.
      </p>
      <dl className="mt-2">
        <MetricRow
          label="Lượt tải trong kỳ"
          value={formatCount(p.downloads.current)}
          change={<ChangeLine change={computeChange(p.downloads.current, p.downloads.previous)} compareLabel={cmp} />}
        />
      </dl>
      <h3 className="mt-4 text-sm font-bold" style={{ color: INK }}>
        Đánh giá cao nhất
      </h3>
      <p className="text-xs" style={{ color: INK_SOFT }}>
        Từ trước tới nay · tối thiểu 3 đánh giá đang hiển thị
      </p>
      {p.topRated.length === 0 ? (
        <p className="mt-2 text-sm" style={{ color: INK_SOFT }}>
          Chưa có tài liệu nào đủ 3 đánh giá.
        </p>
      ) : (
        <ol className="mt-2 space-y-1">
          {p.topRated.map((t) => (
            <li key={t.productId} className="flex items-center justify-between gap-3">
              <Link
                href={`/studio/${slug}/products/${t.productId}`}
                className={`${TEXT_LINK} min-w-0 font-medium [overflow-wrap:anywhere]`}
                style={{ color: INK }}
              >
                <span className="line-clamp-1">{t.title}</span>
              </Link>
              <span className="inline-flex shrink-0 items-center gap-1 text-xs tabular-nums" style={{ color: INK_SOFT }}>
                <span style={{ color: brandColors.accent }}>
                  <IconStarSolid className="h-3.5 w-3.5" />
                </span>
                <span className="font-semibold" style={{ color: INK }}>
                  {formatRating(t.avgRating)}
                </span>
                · {formatCount(t.reviewCount)} đánh giá
              </span>
            </li>
          ))}
        </ol>
      )}
    </GroupCard>
  );
}

function StatusTile({ label, value, warn = false }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="rounded-xl px-3 py-2" style={{ background: warn ? brandColors.accentSoft : brandColors.surface }}>
      <dt className="flex items-center gap-1 text-xs" style={{ color: INK_SOFT }}>
        {warn ? (
          <span style={{ color: "#92400E" }}>
            <IconLock className="h-3.5 w-3.5" />
          </span>
        ) : null}
        {label}
      </dt>
      <dd className="text-lg font-bold tabular-nums" style={{ color: INK }}>
        {formatCount(value)}
      </dd>
    </div>
  );
}

/* ------------------------------------------------------------------ Gian hàng chưa có đơn */

function Onboarding({ slug, products }: { slug: string; products: TenantDashboard["products"] }) {
  const totalProducts = products.published + products.draft + products.archived;
  const steps: Array<{ title: string; description: string; done: boolean | null; action: ReactNode }> = [
    {
      title: "Thêm tài liệu đầu tiên",
      description: "Tải tệp lên, đặt tên, mô tả và giá (có thể để miễn phí).",
      done: totalProducts > 0,
      action: (
        <Link href={`/studio/${slug}/products/new`} className={TEXT_LINK} style={{ color: brandColors.primary }}>
          <IconPlus className="h-4 w-4" /> Thêm tài liệu
        </Link>
      ),
    },
    {
      title: "Xuất bản tài liệu",
      description: "Chỉ tài liệu ở trạng thái Công khai mới hiện trên trang bán hàng.",
      done: products.published > 0,
      action: (
        <Link href={`/studio/${slug}/products`} className={TEXT_LINK} style={{ color: brandColors.primary }}>
          Xem danh sách tài liệu
        </Link>
      ),
    },
    {
      title: "Chia sẻ trang bán hàng",
      description: "Gửi đường dẫn gian hàng cho học viên, đăng lên mạng xã hội hoặc nhóm lớp.",
      done: null,
      action: (
        <a href={`/${slug}`} target="_blank" rel="noopener noreferrer" className={TEXT_LINK} style={{ color: brandColors.primary }}>
          Mở trang bán hàng <IconExternalLink className="h-3.5 w-3.5" />
          <span className="sr-only">(mở tab mới)</span>
        </a>
      ),
    },
  ];
  return (
    <section aria-labelledby="bat-dau-title" className="rounded-2xl border border-dashed border-gray-300 bg-white p-5 sm:p-8">
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <StatIcon icon={<IconShoppingBag className="h-5 w-5" />} />
        <div>
          <h2 id="bat-dau-title" className="font-[family-name:var(--font-heading)] text-lg font-bold" style={{ color: INK }}>
            Gian hàng chưa có đơn hàng nào
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: INK_SOFT }}>
            Số liệu bán hàng, biểu đồ và đơn mới nhất sẽ hiện ở đây sau đơn đầu tiên. Ba bước để bắt đầu:
          </p>
        </div>
      </div>
      <ol className="mt-6 grid gap-4 md:grid-cols-3">
        {steps.map((s, i) => (
          <li key={s.title} className="flex flex-col rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold" style={{ color: INK_SOFT }}>
                Bước {i + 1}
              </span>
              {s.done === null ? null : s.done ? (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700">
                  <IconCheckCircle className="h-4 w-4" /> Đã xong
                </span>
              ) : (
                <span className="text-xs font-semibold" style={{ color: INK_SOFT }}>
                  Chưa xong
                </span>
              )}
            </div>
            <h3 className="mt-1 font-semibold" style={{ color: INK }}>
              {s.title}
            </h3>
            <p className="mt-1 flex-1 text-sm" style={{ color: INK_SOFT }}>
              {s.description}
            </p>
            <div className="mt-2">{s.action}</div>
          </li>
        ))}
      </ol>
    </section>
  );
}
