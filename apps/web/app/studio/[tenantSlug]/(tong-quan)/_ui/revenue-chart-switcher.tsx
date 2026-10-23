"use client";

import { STAT_INK, STAT_INK_SOFT, TrendChart, formatVndFull, type TrendPoint } from "../../../../admin/_ui/stats-chart";
import { MetricToggle, useUrlMetric } from "../../../../admin/_ui/metric-toggle";
import { parseStudioChartMetric, type StudioChartMetric } from "./dashboard-format";

/** Một bucket của biểu đồ doanh thu — số tiền dạng number (đã là số nguyên VND an toàn từ loader), nhãn tính sẵn ở server. */
export interface RevenueChartPoint {
  key: string;
  tick: string;
  label: string;
  future?: boolean;
  grossVnd: number;
  netVnd: number;
}

const METRIC_OPTIONS: ReadonlyArray<{ key: StudioChartMetric; label: string }> = [
  { key: "gop", label: "Gộp" },
  { key: "thuc-nhan", label: "Thực nhận" },
];

/**
 * ADR-043 — đầu thẻ + biểu đồ doanh thu của dashboard Tổng quan. Nút "Gộp / Thực nhận" đổi biểu đồ + tiêu đề ngay ở
 * client (cả 2 chuỗi số đã có trong props) và ghi `?chi-so=` bằng `replaceState` — không render lại trang ở server.
 */
export function RevenueChartSwitcher({
  titleId,
  unit,
  hasFuture,
  initialMetric,
  points,
}: {
  titleId: string;
  unit: string;
  hasFuture: boolean;
  initialMetric: StudioChartMetric;
  points: RevenueChartPoint[];
}) {
  const [metric, setMetric] = useUrlMetric<StudioChartMetric>({
    param: "chi-so",
    initial: initialMetric,
    defaultValue: "gop",
    parse: parseStudioChartMetric,
  });
  const isNet = metric === "thuc-nhan";
  const revenueName = isNet ? "Doanh thu thực nhận" : "Doanh thu gộp";
  const trend: TrendPoint[] = points.map((p) => ({
    key: p.key,
    tick: p.tick,
    label: p.label,
    future: p.future,
    value: BigInt(isNet ? p.netVnd : p.grossVnd),
  }));

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id={titleId} className="font-[family-name:var(--font-heading)] text-base font-bold" style={{ color: STAT_INK }}>
            {revenueName} theo {unit}
          </h2>
          <p className="mt-0.5 text-xs" style={{ color: STAT_INK_SOFT }}>
            Đơn vị: đồng (VND) · mỗi cột là 1 {unit} (giờ Việt Nam){hasFuture ? ` · cột trống ở cuối là thời gian chưa tới` : ""}
          </p>
        </div>
        <MetricToggle label="Chọn cách tính doanh thu trên biểu đồ" options={METRIC_OPTIONS} value={metric} onChange={setMetric} />
      </div>

      <TrendChart
        points={trend}
        metricName={`${revenueName} theo ${unit}`}
        formatAxis={formatVndFull}
        formatFull={formatVndFull}
        emptyText="Không có đơn đã thanh toán trong kỳ này."
      />
    </>
  );
}
