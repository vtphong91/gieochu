import { z } from "zod";
import { DISPLAY_TIME_ZONE } from "../settings/system-settings";

/**
 * ADR-043 mục 5 — kỳ thống kê của dashboard Tổng quan gian hàng (`/studio/{slug}?ky=`). Hàm thuần, không I/O.
 *
 * - Mọi ranh giới theo ngày giờ hiển thị (`DISPLAY_TIME_ZONE`, VN), quy về thời điểm UTC để so với cột TIMESTAMP lưu UTC.
 * - Kỳ hiện tại là nửa mở `[start, end)`; với kỳ "tới hiện tại" (hôm nay, 7/30 ngày, tuần/tháng/quý/năm này) `end = now`.
 * - Tuần bắt đầu **Thứ Hai**; quý theo năm dương lịch (Q1 = T1–T3).
 * - Kỳ so sánh **cùng độ dài**: bắt đầu ở đầu kỳ liền trước (hôm qua, tuần trước, tháng trước…, hoặc lùi đúng N ngày với
 *   kỳ N ngày/tuỳ chọn), kéo dài `end − start`, và không vượt quá `start` (vd tháng trước ngắn hơn phần đã trôi của tháng
 *   này → cắt ở cuối tháng trước).
 * - `?ky=` lạ, hoặc `tuy-chon` có `tu`/`den` sai (sai định dạng, `tu > den`, `den` sau hôm nay, dài hơn
 *   {@link DASHBOARD_CUSTOM_MAX_DAYS} ngày) → về mặc định {@link DEFAULT_DASHBOARD_PRESET} và `invalid = true`. Không ném lỗi.
 */

export const DASHBOARD_PRESETS = [
  "hom-nay",
  "hom-qua",
  "7-ngay",
  "30-ngay",
  "tuan-nay",
  "thang-nay",
  "quy-nay",
  "nam-nay",
  "tuy-chon",
] as const;
export type DashboardPreset = (typeof DASHBOARD_PRESETS)[number];
export type DashboardGranularity = "hour" | "day" | "week" | "month";

export const DEFAULT_DASHBOARD_PRESET: DashboardPreset = "30-ngay";
/** Độ dài tối đa của khoảng ngày tuỳ chọn, tính cả hai đầu (ADR-043 mục 5). */
export const DASHBOARD_CUSTOM_MAX_DAYS = 366;

export const DASHBOARD_PRESET_LABELS: Record<DashboardPreset, string> = {
  "hom-nay": "Hôm nay",
  "hom-qua": "Hôm qua",
  "7-ngay": "7 ngày qua",
  "30-ngay": "30 ngày qua",
  "tuan-nay": "Tuần này",
  "thang-nay": "Tháng này",
  "quy-nay": "Quý này",
  "nam-nay": "Năm nay",
  "tuy-chon": "Tuỳ chọn",
};

const PREV_LABELS: Record<Exclude<DashboardPreset, "tuy-chon">, string> = {
  "hom-nay": "hôm qua",
  "hom-qua": "hôm kia",
  "7-ngay": "7 ngày trước đó",
  "30-ngay": "30 ngày trước đó",
  "tuan-nay": "tuần trước",
  "thang-nay": "tháng trước",
  "quy-nay": "quý trước",
  "nam-nay": "năm trước",
};

export interface DashboardRangeInput {
  /** Giá trị thô `?ky=` (string | string[] | undefined từ searchParams). */
  ky?: unknown;
  /** `?tu=YYYY-MM-DD` — chỉ dùng khi `ky = tuy-chon`. */
  tu?: unknown;
  /** `?den=YYYY-MM-DD` — chỉ dùng khi `ky = tuy-chon`. */
  den?: unknown;
  now?: Date;
}

export interface DashboardRange {
  key: DashboardPreset;
  /** "30 ngày qua", "Tuần này", "01/10/2026 – 10/10/2026"… */
  label: string;
  /** Nhãn kỳ so sánh, dùng sau "so với …": "hôm qua", "tháng trước", "10 ngày trước đó"… */
  prevLabel: string;
  /** UTC, kỳ hiện tại `[start, end)`. */
  start: Date;
  end: Date;
  /** UTC, kỳ so sánh `[prevStart, prevEnd)`, `prevEnd − prevStart ≤ end − start`. */
  prevStart: Date;
  prevEnd: Date;
  /** UTC, cuối danh nghĩa của kỳ (vd 00:00 ngày mai với "hôm nay", Thứ Hai tuần sau với "tuần này") — để dựng trục biểu đồ đủ điểm. */
  periodEnd: Date;
  granularity: DashboardGranularity;
  /** `YYYY-MM-DD` của khoảng tuỳ chọn hợp lệ (để điền lại form); null với preset. */
  customFrom: string | null;
  customTo: string | null;
  /** true khi đầu vào không hợp lệ và đã về mặc định. */
  invalid: boolean;
}

export interface DashboardBucket {
  /** Giờ địa phương `YYYY-MM-DDTHH:MM` của đầu bucket — khớp `to_char(date_trunc(g, local), 'YYYY-MM-DD"T"HH24:MI')`. */
  key: string;
  /** UTC đầu bucket. */
  start: Date;
  /** "14:00" (giờ) · "18/10" (ngày, tuần = Thứ Hai đầu tuần) · "10/2026" (tháng). */
  label: string;
  /** true khi bucket bắt đầu sau thời điểm `end` của kỳ (cột tương lai, giá trị luôn 0). */
  future: boolean;
}

const MS_HOUR = 3_600_000;
const MS_DAY = 86_400_000;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const firstString = (value: unknown) => (Array.isArray(value) ? value[0] : value);
const presetSchema = z.preprocess(firstString, z.enum(DASHBOARD_PRESETS));
const dateSchema = z.preprocess(firstString, z.string().regex(DATE_RE));

const PARTS_FORMAT = new Intl.DateTimeFormat("en-US", {
  timeZone: DISPLAY_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

/** Độ lệch (ms) của múi giờ hiển thị so với UTC tại thời điểm `atMs`. */
function zoneOffsetMs(atMs: number): number {
  const parts: Record<string, number> = {};
  for (const p of PARTS_FORMAT.formatToParts(new Date(atMs))) {
    if (p.type !== "literal") parts[p.type] = Number(p.value);
  }
  const asUtc = Date.UTC(parts.year!, parts.month! - 1, parts.day!, parts.hour! % 24, parts.minute!, parts.second!);
  return asUtc - Math.floor(atMs / 1000) * 1000;
}

/** Thời điểm UTC → "giờ tường" địa phương biểu diễn bằng epoch ms (đọc bằng getUTC*). */
function toLocal(atMs: number): number {
  return atMs + zoneOffsetMs(atMs);
}

/** "Giờ tường" địa phương (epoch ms, getUTC*) → thời điểm UTC. */
function fromLocal(localMs: number): number {
  const guess = localMs - zoneOffsetMs(localMs);
  return localMs - zoneOffsetMs(guess);
}

function localDayStart(localMs: number): number {
  const d = new Date(localMs);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function parseLocalDate(value: string): number | null {
  const ms = Date.parse(`${value}T00:00:00.000Z`);
  if (Number.isNaN(ms) || new Date(ms).toISOString().slice(0, 10) !== value) return null;
  return ms;
}

const pad = (n: number) => String(n).padStart(2, "0");

function formatLocalDate(localMs: number): string {
  const d = new Date(localMs);
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
}

interface LocalPlan {
  key: DashboardPreset;
  startL: number;
  periodEndL: number;
  prevStartL: number;
  /** null = `end = now`; số = `end` cố định (giờ tường). */
  fixedEndL: number | null;
  granularity: DashboardGranularity;
  label: string;
  prevLabel: string;
  customFrom: string | null;
  customTo: string | null;
}

function planPreset(key: Exclude<DashboardPreset, "tuy-chon">, nowL: number): LocalPlan {
  const today = localDayStart(nowL);
  const d = new Date(today);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth();
  const base = { key, fixedEndL: null, label: DASHBOARD_PRESET_LABELS[key], prevLabel: PREV_LABELS[key], customFrom: null, customTo: null };
  switch (key) {
    case "hom-nay":
      return { ...base, startL: today, periodEndL: today + MS_DAY, prevStartL: today - MS_DAY, granularity: "hour" };
    case "hom-qua":
      return { ...base, startL: today - MS_DAY, periodEndL: today, prevStartL: today - 2 * MS_DAY, fixedEndL: today, granularity: "hour" };
    case "7-ngay":
      return { ...base, startL: today - 6 * MS_DAY, periodEndL: today + MS_DAY, prevStartL: today - 13 * MS_DAY, granularity: "day" };
    case "30-ngay":
      return { ...base, startL: today - 29 * MS_DAY, periodEndL: today + MS_DAY, prevStartL: today - 59 * MS_DAY, granularity: "day" };
    case "tuan-nay": {
      const monday = today - ((d.getUTCDay() + 6) % 7) * MS_DAY;
      return { ...base, startL: monday, periodEndL: monday + 7 * MS_DAY, prevStartL: monday - 7 * MS_DAY, granularity: "day" };
    }
    case "thang-nay":
      return { ...base, startL: Date.UTC(y, m, 1), periodEndL: Date.UTC(y, m + 1, 1), prevStartL: Date.UTC(y, m - 1, 1), granularity: "day" };
    case "quy-nay": {
      const qm = m - (m % 3);
      return { ...base, startL: Date.UTC(y, qm, 1), periodEndL: Date.UTC(y, qm + 3, 1), prevStartL: Date.UTC(y, qm - 3, 1), granularity: "week" };
    }
    case "nam-nay":
      return { ...base, startL: Date.UTC(y, 0, 1), periodEndL: Date.UTC(y + 1, 0, 1), prevStartL: Date.UTC(y - 1, 0, 1), granularity: "month" };
  }
}

function planCustom(tu: unknown, den: unknown, nowL: number): LocalPlan | null {
  const from = dateSchema.safeParse(tu);
  const to = dateSchema.safeParse(den);
  if (!from.success || !to.success) return null;
  const startL = parseLocalDate(from.data);
  const lastDayL = parseLocalDate(to.data);
  if (startL === null || lastDayL === null) return null;
  const today = localDayStart(nowL);
  if (startL > lastDayL || lastDayL > today) return null;
  const days = Math.round((lastDayL - startL) / MS_DAY) + 1;
  if (days > DASHBOARD_CUSTOM_MAX_DAYS) return null;
  const periodEndL = lastDayL + MS_DAY;
  const granularity: DashboardGranularity = days === 1 ? "hour" : days <= 31 ? "day" : days <= 120 ? "week" : "month";
  return {
    key: "tuy-chon",
    startL,
    periodEndL,
    prevStartL: startL - days * MS_DAY,
    fixedEndL: lastDayL === today ? null : periodEndL,
    granularity,
    label: days === 1 ? formatLocalDate(startL) : `${formatLocalDate(startL)} – ${formatLocalDate(lastDayL)}`,
    prevLabel: `${days} ngày trước đó`,
    customFrom: from.data,
    customTo: to.data,
  };
}

export function resolveDashboardRange(input: DashboardRangeInput = {}): DashboardRange {
  const nowMs = (input.now ?? new Date()).getTime();
  const nowL = toLocal(nowMs);

  let invalid = false;
  let plan: LocalPlan | null = null;
  if (input.ky !== undefined && input.ky !== null && firstString(input.ky) !== "") {
    const preset = presetSchema.safeParse(input.ky);
    if (!preset.success) invalid = true;
    else if (preset.data === "tuy-chon") {
      plan = planCustom(input.tu, input.den, nowL);
      if (!plan) invalid = true;
    } else plan = planPreset(preset.data, nowL);
  }
  plan ??= planPreset(DEFAULT_DASHBOARD_PRESET as Exclude<DashboardPreset, "tuy-chon">, nowL);

  const startMs = fromLocal(plan.startL);
  const endMs = plan.fixedEndL === null ? nowMs : Math.min(fromLocal(plan.fixedEndL), nowMs);
  const prevStartMs = fromLocal(plan.prevStartL);
  const prevEndMs = Math.min(prevStartMs + (endMs - startMs), startMs);

  return {
    key: plan.key,
    label: plan.label,
    prevLabel: plan.prevLabel,
    start: new Date(startMs),
    end: new Date(endMs),
    prevStart: new Date(prevStartMs),
    prevEnd: new Date(prevEndMs),
    periodEnd: new Date(fromLocal(plan.periodEndL)),
    granularity: plan.granularity,
    customFrom: plan.customFrom,
    customTo: plan.customTo,
    invalid,
  };
}

function truncLocal(localMs: number, granularity: DashboardGranularity): number {
  const d = new Date(localMs);
  switch (granularity) {
    case "hour":
      return Math.floor(localMs / MS_HOUR) * MS_HOUR;
    case "day":
      return localDayStart(localMs);
    case "week":
      return localDayStart(localMs) - ((d.getUTCDay() + 6) % 7) * MS_DAY;
    case "month":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
  }
}

function nextLocal(localMs: number, granularity: DashboardGranularity): number {
  const d = new Date(localMs);
  switch (granularity) {
    case "hour":
      return localMs + MS_HOUR;
    case "day":
      return localMs + MS_DAY;
    case "week":
      return localMs + 7 * MS_DAY;
    case "month":
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
}

function bucketLabel(localMs: number, granularity: DashboardGranularity): string {
  const d = new Date(localMs);
  if (granularity === "hour") return `${pad(d.getUTCHours())}:00`;
  if (granularity === "month") return `${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}`;
}

/**
 * Trục thời gian đủ điểm của kỳ, cũ → mới: từ bucket chứa `start` tới trước `periodEnd`. Bucket "tuần" bắt đầu Thứ Hai
 * (khớp `date_trunc('week')` của Postgres) nên bucket đầu có thể bắt đầu trước `start` — số liệu vẫn chỉ tính trong kỳ.
 */
export function listDashboardBuckets(range: Pick<DashboardRange, "start" | "end" | "periodEnd" | "granularity">): DashboardBucket[] {
  const endMs = range.end.getTime();
  const stopL = toLocal(range.periodEnd.getTime());
  const buckets: DashboardBucket[] = [];
  for (let l = truncLocal(toLocal(range.start.getTime()), range.granularity); l < stopL; l = nextLocal(l, range.granularity)) {
    const startMs = fromLocal(l);
    buckets.push({
      key: new Date(l).toISOString().slice(0, 16),
      start: new Date(startMs),
      label: bucketLabel(l, range.granularity),
      future: startMs >= endMs,
    });
  }
  return buckets;
}
