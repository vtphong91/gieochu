"use client";

import { MetricToggle, useUrlMetric } from "./metric-toggle";
import { parseSalesChartMetric, type SalesChartMetric } from "./sales-chart-metric";
import { STAT_INK, STAT_INK_SOFT, TrendChart, formatCount, formatVndFull, toBigIntSafe } from "./stats-chart";

/** Một ngày của biểu đồ — nhãn tính sẵn ở server; GMV là chuỗi BigInt (không qua float). */
export interface SalesDailyPoint {
  key: string;
  tick: string;
  label: string;
  gmvVnd: string;
  ordersPaid: number;
}

const METRIC_OPTIONS: ReadonlyArray<{ key: SalesChartMetric; label: string }> = [
  { key: "gmv", label: "GMV" },
  { key: "don", label: "Đơn" },
];

/**
 * M12b — đầu thẻ + biểu đồ theo ngày của khối "Hoạt động bán tài liệu". Nút "GMV / Đơn" đổi biểu đồ + tiêu đề ngay ở
 * client (cả 2 chuỗi số đã có trong props) và ghi `?chi-so=` bằng `replaceState` — không render lại `/admin` ở server.
 */
export function SalesDailyChart({ initialMetric, points }: { initialMetric: SalesChartMetric; points: SalesDailyPoint[] }) {
  const [metric, setMetric] = useUrlMetric<SalesChartMetric>({
    param: "chi-so",
    initial: initialMetric,
    defaultValue: "gmv",
    parse: parseSalesChartMetric,
  });
  const isGmv = metric === "gmv";
  const lastIndex = points.length - 1;
  const formatOrders = (v: bigint) => `${formatCount(v)} đơn`;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-[family-name:var(--font-heading)] text-base font-bold" style={{ color: STAT_INK }}>
            {isGmv ? "GMV theo ngày" : "Đơn đã thanh toán theo ngày"}
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: STAT_INK_SOFT }}>
            {isGmv ? "Đơn vị: đồng (VND)" : "Đơn vị: đơn"} · mỗi cột là 1 ngày (giờ Việt Nam)
          </p>
        </div>
        <MetricToggle label="Chọn chỉ số biểu đồ" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
      </div>
      <TrendChart
        points={points.map((p) => ({
          key: p.key,
          tick: p.tick,
          label: p.label,
          value: isGmv ? toBigIntSafe(p.gmvVnd) : BigInt(p.ordersPaid),
        }))}
        metricName={isGmv ? "GMV theo ngày" : "Đơn đã thanh toán theo ngày"}
        formatAxis={isGmv ? formatVndFull : formatOrders}
        formatFull={isGmv ? formatVndFull : formatOrders}
        emptyText={`Không có ${isGmv ? "doanh thu" : "đơn đã thanh toán"} nào trong 30 ngày.`}
        integerScale={!isGmv}
        // Nhãn trục X thưa: neo vào ngày cuối, lùi mỗi 7 ngày — không chồng chữ ở 360px.
        showTick={(i) => (lastIndex - i) % 7 === 0}
      />
    </>
  );
}
