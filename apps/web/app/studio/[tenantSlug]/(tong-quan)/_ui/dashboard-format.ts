import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import type { DashboardGranularity, DashboardPreset } from "@gieochu/core/dashboard-range";

/** ADR-043 — tiện ích định dạng/URL thuần cho dashboard Tổng quan gian hàng (không I/O). */

/** Chỉ số biểu đồ doanh thu — `?chi-so=` (link GET, không cần JS). Mặc định: gộp. */
export type StudioChartMetric = "gop" | "thuc-nhan";

export function parseStudioChartMetric(raw: string | string[] | undefined): StudioChartMetric {
  const v = Array.isArray(raw) ? raw[0] : raw;
  return v === "thuc-nhan" ? "thuc-nhan" : "gop";
}

export const CHART_SECTION_ID = "bieu-do-doanh-thu";

/** URL dashboard giữ đủ trạng thái kỳ + chỉ số biểu đồ; giá trị mặc định (30 ngày, gộp) bỏ khỏi query cho gọn. */
export function dashboardHref(
  slug: string,
  state: { ky: DashboardPreset; tu?: string | null; den?: string | null; chiSo: StudioChartMetric },
  hash?: string,
): string {
  const q = new URLSearchParams();
  if (state.ky !== "30-ngay") q.set("ky", state.ky);
  if (state.ky === "tuy-chon") {
    if (state.tu) q.set("tu", state.tu);
    if (state.den) q.set("den", state.den);
  }
  if (state.chiSo !== "gop") q.set("chi-so", state.chiSo);
  const qs = q.toString();
  return `/studio/${slug}${qs ? `?${qs}` : ""}${hash ? `#${hash}` : ""}`;
}

const PARTS = new Intl.DateTimeFormat("en-GB", {
  timeZone: DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

type VnParts = { year: string; month: string; day: string; hour: string; minute: string };

/** Thời điểm ISO (UTC) → các phần ngày giờ theo giờ Việt Nam. */
export function vnParts(iso: string): VnParts {
  const out: Record<string, string> = {};
  for (const p of PARTS.formatToParts(new Date(iso))) {
    if (p.type !== "literal") out[p.type] = p.value;
  }
  return { year: out.year ?? "", month: out.month ?? "", day: out.day ?? "", hour: out.hour ?? "", minute: out.minute ?? "" };
}

/** "YYYY-MM-DD" của hôm nay theo giờ VN — làm `max` cho ô chọn ngày. */
export function vnDateInputValue(iso: string): string {
  const p = vnParts(iso);
  return `${p.year}-${p.month}-${p.day}`;
}

/** "14:32 · 18/10/2026". */
export function formatVnDateTime(iso: string): string {
  const p = vnParts(iso);
  return `${p.hour}:${p.minute} · ${p.day}/${p.month}/${p.year}`;
}

export const GRANULARITY_UNIT: Record<DashboardGranularity, string> = {
  hour: "giờ",
  day: "ngày",
  week: "tuần",
  month: "tháng",
};

/** Nhãn đầy đủ của một bucket (tooltip, tóm tắt biểu đồ, bảng): "14:00 ngày 18/10/2026", "tuần từ 13/10/2026"… */
export function bucketFullLabel(startIso: string, granularity: DashboardGranularity): string {
  const p = vnParts(startIso);
  const date = `${p.day}/${p.month}/${p.year}`;
  switch (granularity) {
    case "hour":
      return `${p.hour}:00 ngày ${date}`;
    case "day":
      return `ngày ${date}`;
    case "week":
      return `tuần từ ${date}`;
    case "month":
      return `tháng ${p.month}/${p.year}`;
  }
}

const oneDecimal = new Intl.NumberFormat("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** 4.6 → "4,6". */
export function formatRating(value: number): string {
  return oneDecimal.format(value);
}

/** 0.384 → "38%". */
export function formatPercent(ratio: number): string {
  return `${Math.round(ratio * 100).toLocaleString("vi-VN")}%`;
}
