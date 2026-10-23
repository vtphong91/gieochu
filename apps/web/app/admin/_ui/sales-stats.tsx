import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { EmptyState, Notice } from "./kit";
import { IconAlertTriangle, IconExternalLink, IconShoppingBag } from "./icons";
import {
  KpiCard,
  STAT_INK,
  STAT_INK_SOFT,
  TrendChart,
  computeChange,
  formatVndAxis,
  formatVndFull,
  toBigIntSafe,
} from "./stats-chart";
import type { AdminStatsOverview, AdminStatsTotals } from "../../../lib/admin-stats";

/**
 * M12b (ADR-037) — khối "Hoạt động bán tài liệu (30 ngày)" trên dashboard `/admin`. Chỉ trình bày: nhận kết quả
 * `getAdminStatsOverview()` qua prop, không tự truy vấn. Số liệu chỉ là tổng hợp `tenant_daily_stats` + tên gian
 * hàng (§7.9 — không chi tiết đơn/khách). Cửa sổ 30 ngày kết thúc ở hôm qua (giờ VN).
 */
export type AdminStatsOverviewView = AdminStatsOverview;
type StatsTotals = AdminStatsTotals;

/** Chỉ số vẽ biểu đồ — đọc từ query `?chi-so=` (link GET, không cần JS). */
export type SalesChartMetric = "gmv" | "don";

export function parseSalesChartMetric(raw: string | string[] | undefined): SalesChartMetric {
  return raw === "don" ? "don" : "gmv";
}

const LINE = "#E5E7EB";
const INK = STAT_INK;
const INK_SOFT = STAT_INK_SOFT;
const SECTION_ID = "hoat-dong-ban-tai-lieu";

const vnInt = new Intl.NumberFormat("vi-VN");

/** "2026-09-17" → "17/09" (cắt chuỗi, không qua Date để khỏi lệch múi giờ). */
function shortDate(isoDate: string): string {
  const [, m, d] = isoDate.split("-");
  return `${d}/${m}`;
}

function longDate(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
  return `${d}/${m}/${y}`;
}

function formatAggregatedAt(iso: string | null): string {
  if (!iso) return "chưa có lần tổng hợp nào";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "không rõ";
  return date.toLocaleString("vi-VN", {
    timeZone: DISPLAY_TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function SectionHeader({ lastAggregatedAt }: { lastAggregatedAt?: string | null }) {
  return (
    <div>
      <h2 id={`${SECTION_ID}-title`} className="font-[family-name:var(--font-heading)] text-lg font-bold" style={{ color: INK }}>
        Hoạt động bán tài liệu (30 ngày)
      </h2>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: INK_SOFT }}>
        Số liệu tổng hợp hằng ngày lúc 03:00, tính đến hết hôm qua
        {lastAggregatedAt !== undefined ? <> — cập nhật lần cuối {formatAggregatedAt(lastAggregatedAt)}</> : null}. GMV là tổng tiền khách
        trả (gộp, chưa trừ hoàn tiền).
      </p>
    </div>
  );
}

const METRIC_OPTIONS: Array<{ key: SalesChartMetric; label: string }> = [
  { key: "gmv", label: "GMV" },
  { key: "don", label: "Đơn" },
];

function MetricSwitch({ metric }: { metric: SalesChartMetric }) {
  return (
    <nav aria-label="Chọn chỉ số biểu đồ" className="inline-flex rounded-lg border p-0.5" style={{ borderColor: LINE }}>
      {METRIC_OPTIONS.map((o) => {
        const active = o.key === metric;
        return (
          <Link
            key={o.key}
            href={o.key === "gmv" ? `/admin#${SECTION_ID}` : `/admin?chi-so=${o.key}#${SECTION_ID}`}
            scroll={false}
            aria-current={active ? "true" : undefined}
            className="inline-flex min-h-11 min-w-14 items-center justify-center rounded-md px-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)] lg:min-h-9"
            style={active ? { background: brandColors.primary, color: "#FFFFFF" } : { color: INK }}
          >
            {o.label}
          </Link>
        );
      })}
    </nav>
  );
}

type SeriesPoint = Extract<AdminStatsOverviewView, { status: "ok" }>["series"][number];

function DailyChart({ series, metric }: { series: SeriesPoint[]; metric: SalesChartMetric }) {
  const isGmv = metric === "gmv";
  const lastIndex = series.length - 1;
  return (
    <TrendChart
      points={series.map((p) => ({
        key: p.date,
        tick: shortDate(p.date),
        label: `ngày ${longDate(p.date)}`,
        value: isGmv ? toBigIntSafe(p.gmvVnd) : BigInt(p.ordersPaid),
      }))}
      metricName={isGmv ? "GMV theo ngày" : "Đơn đã thanh toán theo ngày"}
      formatAxis={(v) => (isGmv ? formatVndAxis(v) : `${vnInt.format(v)} đơn`)}
      formatFull={(v) => (isGmv ? formatVndFull(v) : `${vnInt.format(v)} đơn`)}
      emptyText={`Không có ${isGmv ? "doanh thu" : "đơn đã thanh toán"} nào trong 30 ngày.`}
      integerScale={!isGmv}
      // Nhãn trục X thưa: neo vào ngày cuối, lùi mỗi 7 ngày — không chồng chữ ở 360px.
      showTick={(i) => (lastIndex - i) % 7 === 0}
    />
  );
}

function DailyTable({ series }: { series: SeriesPoint[] }) {
  return (
    <details className="group mt-4 rounded-xl border" style={{ borderColor: LINE }}>
      <summary
        className="flex min-h-11 cursor-pointer items-center px-4 text-sm font-semibold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)]"
        style={{ color: brandColors.primary }}
      >
        Xem bảng số liệu theo ngày
      </summary>
      {/* Bảng 5 cột có thể rộng hơn 360px → cuộn ngang trong khung riêng, trang không cuộn ngang. */}
      <div className="max-h-96 overflow-auto border-t" style={{ borderColor: LINE }}>
        <table className="w-full min-w-[30rem] text-left text-sm tabular-nums">
          <caption className="sr-only">Số liệu bán tài liệu toàn nền tảng theo từng ngày, 30 ngày gần nhất</caption>
          <thead className="sticky top-0 bg-white">
            <tr className="border-b" style={{ borderColor: LINE, color: INK_SOFT }}>
              <th scope="col" className="px-4 py-2.5 font-medium">Ngày</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">GMV</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Đơn</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Khách mới</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Lượt tải</th>
            </tr>
          </thead>
          <tbody>
            {[...series].reverse().map((p) => (
              <tr key={p.date} className="border-b last:border-0" style={{ borderColor: LINE, color: INK }}>
                <th scope="row" className="px-4 py-2 font-normal">{longDate(p.date)}</th>
                <td className="px-4 py-2 text-right">{formatVndFull(p.gmvVnd)}</td>
                <td className="px-4 py-2 text-right">{vnInt.format(p.ordersPaid)}</td>
                <td className="px-4 py-2 text-right">{vnInt.format(p.newCustomers)}</td>
                <td className="px-4 py-2 text-right">{vnInt.format(p.downloads)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

type TopTenant = Extract<AdminStatsOverviewView, { status: "ok" }>["topTenants"][number];

function TopTenants({ tenants }: { tenants: TopTenant[] }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }}>
      <h3 className="font-[family-name:var(--font-heading)] text-base font-bold" style={{ color: INK }}>
        Top 5 gian hàng theo GMV
      </h3>
      <p className="mt-0.5 text-xs" style={{ color: INK_SOFT }}>
        30 ngày gần nhất
      </p>
      {tenants.length === 0 ? (
        <p className="py-8 text-center text-sm" style={{ color: INK_SOFT }}>
          Chưa có gian hàng nào phát sinh doanh thu trong 30 ngày.
        </p>
      ) : (
        <ol className="mt-4 space-y-1">
          {tenants.slice(0, 5).map((t, i) => (
            <li key={t.tenantId} className="flex items-start gap-3 border-b py-2 last:border-0" style={{ borderColor: LINE }}>
              <span
                className="mt-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums lg:mt-0"
                style={{ background: brandColors.surface, color: brandColors.primary }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              {/* Số GMV đầy đủ (không rút gọn — ADR-043 lần 3): thiếu chỗ thì cả khối số xuống dòng dưới tên, không cắt tên. */}
              <div className="flex min-w-0 flex-1 flex-wrap items-start justify-between gap-x-3">
                <div className="min-w-0 flex-1 basis-40">
                  <a
                    href={`/${t.slug}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 max-w-full items-center gap-1 text-sm font-semibold hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-primary,#0F3B82)] lg:min-h-0"
                    style={{ color: INK }}
                  >
                    <span className="sr-only">Hạng {i + 1}: </span>
                    <span className="truncate" title={t.name}>{t.name}</span>
                    <IconExternalLink className="h-3.5 w-3.5 shrink-0" />
                    <span className="sr-only">(mở gian hàng ở tab mới)</span>
                  </a>
                  <p className="text-xs" style={{ color: INK_SOFT }}>
                    /{t.slug}
                  </p>
                </div>
                <div className="ml-auto shrink-0 text-right">
                  <p className="text-sm font-semibold whitespace-nowrap tabular-nums" style={{ color: INK }}>
                    {formatVndFull(t.gmvVnd)}
                  </p>
                  <p className="text-xs tabular-nums" style={{ color: INK_SOFT }}>
                    {vnInt.format(t.ordersPaid)} đơn
                  </p>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function isAllZero(t: StatsTotals): boolean {
  return toBigIntSafe(t.gmvVnd) === BigInt(0) && t.ordersPaid === 0 && t.newCustomers === 0 && t.downloads === 0;
}

export function SalesStatsSection({ overview, metric }: { overview: AdminStatsOverviewView; metric: SalesChartMetric }) {
  if (overview.status === "unavailable") {
    return (
      <section id={SECTION_ID} aria-labelledby={`${SECTION_ID}-title`} className="scroll-mt-20 space-y-4">
        <SectionHeader />
        <Notice tone="warning" icon={<IconAlertTriangle className="h-4 w-4" />}>
          <p className="font-semibold">Thống kê chưa sẵn sàng</p>
          <p>Dữ liệu tổng hợp bán tài liệu chưa có. Số liệu sẽ hiện sau lần tổng hợp hằng ngày kế tiếp (03:00).</p>
        </Notice>
      </section>
    );
  }

  const { totals, prevTotals, series, topTenants, lastAggregatedAt } = overview;

  if (isAllZero(totals) && isAllZero(prevTotals) && topTenants.length === 0) {
    return (
      <section id={SECTION_ID} aria-labelledby={`${SECTION_ID}-title`} className="scroll-mt-20 space-y-4">
        <SectionHeader lastAggregatedAt={lastAggregatedAt} />
        <EmptyState
          icon={<IconShoppingBag className="h-5 w-5" />}
          title="Chưa có hoạt động bán tài liệu"
          description="Trong 60 ngày gần nhất chưa có đơn đã thanh toán, khách mới hay lượt tải nào trên các gian hàng."
        />
      </section>
    );
  }

  return (
    <section id={SECTION_ID} aria-labelledby={`${SECTION_ID}-title`} className="scroll-mt-20 space-y-4">
      <SectionHeader lastAggregatedAt={lastAggregatedAt} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard
          label="GMV"
          value={formatVndFull(totals.gmvVnd)}
          change={computeChange(totals.gmvVnd, prevTotals.gmvVnd)}
        />
        <KpiCard
          label="Đơn đã thanh toán"
          value={vnInt.format(totals.ordersPaid)}
          change={computeChange(totals.ordersPaid, prevTotals.ordersPaid)}
        />
        <KpiCard
          label="Khách mới"
          value={vnInt.format(totals.newCustomers)}
          change={computeChange(totals.newCustomers, prevTotals.newCustomers)}
        />
        <KpiCard
          label="Lượt tải"
          value={vnInt.format(totals.downloads)}
          change={computeChange(totals.downloads, prevTotals.downloads)}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="min-w-0 rounded-2xl border bg-white p-5 sm:p-6 xl:col-span-2" style={{ borderColor: LINE }}>
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h3 className="font-[family-name:var(--font-heading)] text-base font-bold" style={{ color: INK }}>
                {metric === "gmv" ? "GMV theo ngày" : "Đơn đã thanh toán theo ngày"}
              </h3>
              <p className="mt-0.5 text-xs" style={{ color: INK_SOFT }}>
                {metric === "gmv" ? "Đơn vị: đồng (VND)" : "Đơn vị: đơn"} · mỗi cột là 1 ngày (giờ Việt Nam)
              </p>
            </div>
            <MetricSwitch metric={metric} />
          </div>
          <DailyChart series={series} metric={metric} />
          <DailyTable series={series} />
        </div>
        <TopTenants tenants={topTenants} />
      </div>
    </section>
  );
}

/** Khung chờ (Suspense fallback) cùng kích thước khối thật để không nhảy layout. */
export function SalesStatsSkeleton() {
  const block = "rounded-lg bg-gray-200/80";
  return (
    <section aria-busy="true" className="space-y-4">
      <p className="sr-only" role="status">
        Đang tải thống kê bán tài liệu…
      </p>
      <div className="animate-pulse space-y-4 motion-reduce:animate-none" aria-hidden="true">
        <div>
          <div className={`${block} h-6 w-72 max-w-full`} />
          <div className={`${block} mt-2 h-3.5 w-[28rem] max-w-full`} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, i) => (
            <div key={i} className="rounded-2xl border bg-white p-5" style={{ borderColor: LINE }}>
              <div className={`${block} h-4 w-24`} />
              <div className={`${block} mt-2 h-7 w-32`} />
              <div className={`${block} mt-3 h-3.5 w-40 max-w-full`} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
          <div className="rounded-2xl border bg-white p-5 sm:p-6 xl:col-span-2" style={{ borderColor: LINE }}>
            <div className={`${block} h-5 w-40`} />
            <div className={`${block} mt-5 h-48 w-full`} />
            <div className={`${block} mt-4 h-11 w-full`} />
          </div>
          <div className="rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: LINE }}>
            <div className={`${block} h-5 w-48 max-w-full`} />
            {Array.from({ length: 5 }, (_, i) => (
              <div key={i} className={`${block} mt-4 h-9 w-full`} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
