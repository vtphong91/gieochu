/**
 * M12b (ADR-037) — chỉ số biểu đồ "Hoạt động bán tài liệu" trên `/admin`, đọc từ query `?chi-so=`. Module thuần (không
 * "use client", không I/O) để dùng được ở cả server (`page.tsx` đọc giá trị đầu) lẫn client (`sales-daily-chart.tsx`).
 */
export type SalesChartMetric = "gmv" | "don";

export function parseSalesChartMetric(raw: string | string[] | undefined): SalesChartMetric {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "don" ? "don" : "gmv";
}
