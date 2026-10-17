import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { EmptyState, Notice } from "./kit";
import { IconAlertTriangle, IconExternalLink, IconShoppingBag } from "./icons";
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
const INK = brandColors.ink;
const INK_SOFT = "#6B7280";
const BAR_EMPTY = "#E5E7EB";
const SECTION_ID = "hoat-dong-ban-tai-lieu";

const vnInt = new Intl.NumberFormat("vi-VN");

/** Chuỗi BigInt → "1.234.567 đ" (không qua float). */
function formatVndFull(raw: string): string {
  return `${vnInt.format(toBigInt(raw))} đ`;
}

function toBigInt(raw: string): bigint {
  try {
    return BigInt(raw);
  } catch {
    return BigInt(0);
  }
}

/**
 * Rút gọn tiền cho thẻ KPI/trục: "12,5 triệu đ", "1,2 tỷ đ". Phần nguyên + 1 chữ số thập phân tính bằng BigInt rồi
 * mới đổi sang number (giá trị đã nhỏ, an toàn) — không mất chính xác với số rất lớn.
 */
function formatVndCompact(raw: string): string {
  const v = toBigInt(raw);
  const units: Array<[bigint, string]> = [
    [BigInt(1_000_000_000), "tỷ"],
    [BigInt(1_000_000), "triệu"],
    [BigInt(1_000), "nghìn"],
  ];
  for (const [base, label] of units) {
    if (v >= base) {
      const tenths = Number((v * BigInt(10)) / base) / 10;
      return `${tenths.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${label} đ`;
    }
  }
  return `${vnInt.format(v)} đ`;
}

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

type Change = { kind: "none" } | { kind: "up" | "down" | "flat"; pctText: string };

/** % thay đổi so với kỳ trước; kỳ trước = 0 → không so sánh được ("—"). Tính bằng BigInt cho GMV. */
function computeChange(current: bigint, previous: bigint): Change {
  if (previous === BigInt(0)) return { kind: "none" };
  const diff = current - previous;
  // Phần nghìn để có 1 chữ số thập phân, làm tròn về 0 (đủ cho hiển thị).
  const permille = Number((diff * BigInt(1000)) / previous);
  const pct = permille / 10;
  const pctText = `${Math.abs(pct).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  if (permille === 0) return { kind: "flat", pctText: "0%" };
  return { kind: diff > BigInt(0) ? "up" : "down", pctText };
}

function ArrowUp({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 19V5M6 11l6-6 6 6" />
    </svg>
  );
}

function ArrowDown({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 5v14M6 13l6 6 6-6" />
    </svg>
  );
}

function ChangeLine({ change }: { change: Change }) {
  if (change.kind === "none") {
    return (
      <p className="mt-2 text-xs" style={{ color: INK_SOFT }}>
        <span aria-hidden="true">—</span>
        <span className="ml-1">chưa có số liệu kỳ trước</span>
      </p>
    );
  }
  if (change.kind === "flat") {
    return (
      <p className="mt-2 text-xs" style={{ color: INK_SOFT }}>
        Không đổi so với 30 ngày trước
      </p>
    );
  }
  const up = change.kind === "up";
  return (
    <p className={`mt-2 flex flex-wrap items-center gap-x-1 text-xs ${up ? "text-green-700" : "text-red-700"}`}>
      <span className="inline-flex items-center gap-0.5 font-semibold">
        {up ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />}
        {up ? "Tăng" : "Giảm"} {change.pctText}
      </span>
      <span style={{ color: INK_SOFT }}>so với 30 ngày trước</span>
    </p>
  );
}

function KpiCard({ label, value, detail, change }: { label: string; value: string; detail?: string; change: Change }) {
  return (
    <div className="min-w-0 rounded-2xl border bg-white p-5" style={{ borderColor: LINE }}>
      <p className="text-sm font-medium" style={{ color: INK_SOFT }}>
        {label}
      </p>
      <p className="mt-1 text-2xl font-bold tabular-nums [overflow-wrap:anywhere]" style={{ color: INK }}>
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-xs tabular-nums [overflow-wrap:anywhere]" style={{ color: INK_SOFT }}>
          {detail}
        </p>
      ) : null}
      <ChangeLine change={change} />
    </div>
  );
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
  const values = series.map((p) => (isGmv ? toBigInt(p.gmvVnd) : BigInt(p.ordersPaid)));
  const max = values.reduce((m, v) => (v > m ? v : m), BigInt(0));
  const formatValue = (v: bigint) => (isGmv ? formatVndCompact(v.toString()) : `${vnInt.format(v)} đơn`);
  const formatFull = (v: bigint) => (isGmv ? formatVndFull(v.toString()) : `${vnInt.format(v)} đơn`);
  const metricName = isGmv ? "GMV" : "Đơn đã thanh toán";

  const first = series[0];
  const last = series[series.length - 1];
  const peakIndex = values.findIndex((v) => v === max);
  const peak = series[peakIndex];

  if (!first || !last || max === BigInt(0) || !peak) {
    return (
      <p className="flex h-48 items-center justify-center rounded-xl border border-dashed text-sm" style={{ borderColor: LINE, color: INK_SOFT }}>
        Không có {isGmv ? "doanh thu" : "đơn đã thanh toán"} nào trong 30 ngày.
      </p>
    );
  }

  const summary = `Biểu đồ cột ${metricName} theo ngày, từ ${longDate(first.date)} đến ${longDate(last.date)}. Cao nhất ${formatFull(max)} vào ngày ${longDate(peak.date)}. Bảng số liệu chi tiết ở ngay dưới biểu đồ.`;
  const half = max / BigInt(2);
  // Nhãn trục X thưa: neo vào ngày cuối, lùi mỗi 7 ngày — không chồng chữ ở 360px.
  const lastIndex = series.length - 1;
  const showTick = (i: number) => (lastIndex - i) % 7 === 0;

  return (
    <div>
      <div role="img" aria-label={summary} className="flex gap-2">
        {/* Trục Y */}
        <div className="flex h-48 w-16 shrink-0 flex-col justify-between text-right text-[11px] tabular-nums sm:w-20" style={{ color: INK_SOFT }} aria-hidden="true">
          <span className="-mt-1.5">{formatValue(max)}</span>
          <span>{formatValue(half)}</span>
          <span className="-mb-1.5">0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="relative h-48">
            {/* Lưới ngang mờ */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              <div className="border-t border-dashed" style={{ borderColor: LINE }} />
              <div className="border-t border-dashed" style={{ borderColor: LINE }} />
              <div className="border-t" style={{ borderColor: "#D1D5DB" }} />
            </div>
            <div className="relative flex h-full items-end gap-px sm:gap-0.5" aria-hidden="true">
              {series.map((p, i) => {
                const v = values[i] ?? BigInt(0);
                const pct = Number((v * BigInt(1000)) / max) / 10;
                return (
                  <div
                    key={p.date}
                    className="flex-1 rounded-t-sm transition-opacity hover:opacity-80 motion-reduce:transition-none"
                    style={{ height: v > BigInt(0) ? `${Math.max(2, pct)}%` : "2px", background: v > BigInt(0) ? brandColors.primary : BAR_EMPTY }}
                    title={`${longDate(p.date)}: ${formatFull(v)}`}
                  />
                );
              })}
            </div>
          </div>
          {/* Trục X */}
          <div className="relative mt-1.5 flex h-4 gap-px sm:gap-0.5 text-[11px] tabular-nums" style={{ color: INK_SOFT }} aria-hidden="true">
            {series.map((p, i) => (
              <div key={p.date} className="relative flex-1">
                {showTick(i) ? (
                  <span
                    className={`absolute top-0 whitespace-nowrap ${i === 0 ? "left-0" : i === lastIndex ? "right-0" : "left-1/2 -translate-x-1/2"}`}
                  >
                    {shortDate(p.date)}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs" style={{ color: INK_SOFT }}>
        Cao nhất: <span className="font-semibold tabular-nums" style={{ color: INK }}>{formatFull(max)}</span> ngày {longDate(peak.date)}
      </p>
    </div>
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
            <li key={t.tenantId} className="flex items-center gap-3 border-b py-2 last:border-0" style={{ borderColor: LINE }}>
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums"
                style={{ background: brandColors.surface, color: brandColors.primary }}
                aria-hidden="true"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
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
              <div className="shrink-0 text-right">
                <p className="text-sm font-semibold tabular-nums" style={{ color: INK }}>
                  {formatVndCompact(t.gmvVnd)}
                </p>
                <p className="text-xs tabular-nums" style={{ color: INK_SOFT }}>
                  {vnInt.format(t.ordersPaid)} đơn
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function isAllZero(t: StatsTotals): boolean {
  return toBigInt(t.gmvVnd) === BigInt(0) && t.ordersPaid === 0 && t.newCustomers === 0 && t.downloads === 0;
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
          value={formatVndCompact(totals.gmvVnd)}
          detail={formatVndFull(totals.gmvVnd)}
          change={computeChange(toBigInt(totals.gmvVnd), toBigInt(prevTotals.gmvVnd))}
        />
        <KpiCard
          label="Đơn đã thanh toán"
          value={vnInt.format(totals.ordersPaid)}
          change={computeChange(BigInt(totals.ordersPaid), BigInt(prevTotals.ordersPaid))}
        />
        <KpiCard
          label="Khách mới"
          value={vnInt.format(totals.newCustomers)}
          change={computeChange(BigInt(totals.newCustomers), BigInt(prevTotals.newCustomers))}
        />
        <KpiCard
          label="Lượt tải"
          value={vnInt.format(totals.downloads)}
          change={computeChange(BigInt(totals.downloads), BigInt(prevTotals.downloads))}
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
