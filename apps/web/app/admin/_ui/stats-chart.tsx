import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconArrowDown, IconArrowUp } from "./icons";

/**
 * Khối trình bày thống kê dùng chung cho dashboard System Center (`/admin`, M12b — ADR-037) và Studio Tổng quan
 * (`/studio/{slug}`, ADR-043). Không hook — dùng được ở Server lẫn Client Component (biểu đồ có nút chuyển chỉ số): định dạng tiền VND bằng BigInt, % so kỳ trước,
 * thẻ KPI, biểu đồ cột/đường HTML có `role="img"` + tóm tắt. Không tự truy vấn — nơi gọi chuẩn hoá dữ liệu.
 *
 * Màu: token `brandColors` (primary/accent/ink/inkSoft/surface) + thang xám Tailwind (`gray-200/300`) cho viền/lưới;
 * xu hướng `text-green-700`/`text-red-700` luôn kèm mũi tên + chữ "Tăng/Giảm" (không chỉ dựa vào màu).
 */

export const STAT_INK = brandColors.ink;
export const STAT_INK_SOFT = brandColors.inkSoft;
/** Khung thẻ thống kê: nền trắng, viền xám nhạt — cùng ngôn ngữ app shell `/admin`, `/studio`. */
export const STAT_CARD_CLASS = "min-w-0 rounded-2xl border border-gray-200 bg-white";

const vnInt = new Intl.NumberFormat("vi-VN");

export type MoneyLike = bigint | number | string;

/** Số tiền/số đếm (bigint | số nguyên an toàn | chuỗi BigInt) → bigint; giá trị hỏng → 0. */
export function toBigIntSafe(raw: MoneyLike): bigint {
  if (typeof raw === "bigint") return raw;
  if (typeof raw === "number") return Number.isFinite(raw) ? BigInt(Math.trunc(raw)) : BigInt(0);
  try {
    return BigInt(raw);
  } catch {
    return BigInt(0);
  }
}

/** Số nguyên → "1.234" (vi-VN). */
export function formatCount(raw: MoneyLike): string {
  return vnInt.format(toBigIntSafe(raw));
}

/**
 * "1.234.567 đ" — không qua float. Dùng cho **mọi** số tiền trên dashboard System Center + Studio, kể cả nhãn trục Y
 * biểu đồ (không rút gọn "nghìn/triệu/tỷ").
 */
export function formatVndFull(raw: MoneyLike): string {
  return `${vnInt.format(toBigIntSafe(raw))} đ`;
}

export type Change = { kind: "none" } | { kind: "up" | "down" | "flat"; pctText: string };

/**
 * % thay đổi so với kỳ trước, 1 chữ số thập phân (làm tròn về 0), tính bằng BigInt. Kỳ trước = 0 hoặc thiếu số liệu
 * (null) → không so sánh được ("—").
 */
export function computeChange(current: MoneyLike | null, previous: MoneyLike | null): Change {
  if (current === null || previous === null) return { kind: "none" };
  const cur = toBigIntSafe(current);
  const prev = toBigIntSafe(previous);
  if (prev === BigInt(0)) return { kind: "none" };
  const diff = cur - prev;
  const permille = Number((diff * BigInt(1000)) / prev);
  const pct = permille / 10;
  if (permille === 0) return { kind: "flat", pctText: "0%" };
  const pctText = `${Math.abs(pct).toLocaleString("vi-VN", { maximumFractionDigits: 1 })}%`;
  return { kind: diff > BigInt(0) ? "up" : "down", pctText };
}

/**
 * Dòng xu hướng dưới số KPI. `compareLabel` là cụm sau "so với" ("30 ngày trước", "tháng trước"…). `higherIsBetter =
 * false` (vd tiền hoàn) đảo màu: tăng = đỏ, giảm = xanh — chữ "Tăng/Giảm" + mũi tên vẫn nói đúng chiều.
 */
export function ChangeLine({ change, compareLabel, higherIsBetter = true }: { change: Change; compareLabel: string; higherIsBetter?: boolean }) {
  if (change.kind === "none") {
    return (
      <p className="mt-2 text-xs" style={{ color: STAT_INK_SOFT }}>
        <span aria-hidden="true">—</span>
        <span className="ml-1">chưa có số liệu kỳ trước để so sánh</span>
      </p>
    );
  }
  if (change.kind === "flat") {
    return (
      <p className="mt-2 text-xs" style={{ color: STAT_INK_SOFT }}>
        Không đổi so với {compareLabel}
      </p>
    );
  }
  const up = change.kind === "up";
  const good = up === higherIsBetter;
  return (
    <p className={`mt-2 flex flex-wrap items-center gap-x-1 text-xs ${good ? "text-green-700" : "text-red-700"}`}>
      <span className="inline-flex items-center gap-0.5 font-semibold">
        {up ? <IconArrowUp className="h-3.5 w-3.5" /> : <IconArrowDown className="h-3.5 w-3.5" />}
        {up ? "Tăng" : "Giảm"} {change.pctText}
      </span>
      <span style={{ color: STAT_INK_SOFT }}>so với {compareLabel}</span>
    </p>
  );
}

export type StatIconTone = "primary" | "accent" | "secondary";

const ICON_TONE: Record<StatIconTone, { bg: string; fg: string }> = {
  primary: { bg: brandColors.surface, fg: brandColors.primary },
  accent: { bg: brandColors.accentSoft, fg: brandColors.accent },
  secondary: { bg: brandColors.surface, fg: brandColors.secondary },
};

/** Icon tròn trang trí cạnh nhãn KPI (aria-hidden — nhãn chữ đã nói đủ). */
export function StatIcon({ icon, tone = "primary", size = "md" }: { icon: ReactNode; tone?: StatIconTone; size?: "sm" | "md" }) {
  const s = ICON_TONE[tone];
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full ${size === "md" ? "h-10 w-10" : "h-9 w-9"}`}
      style={{ background: s.bg, color: s.fg }}
    >
      {icon}
    </span>
  );
}

/**
 * Cỡ chữ của số thống kê theo độ dài chuỗi (ADR-043 lần 3 — số đầy đủ, không rút gọn): số dài thu nhỏ một bậc để vẫn
 * nằm gọn trong thẻ hẹp (4 cột cạnh sidebar, 360px). Vẫn kèm `[overflow-wrap:anywhere]` ở nơi gọi làm lưới an toàn —
 * khoảng trắng trước "đ" là chỗ xuống dòng ưu tiên.
 */
export function statValueSizeClass(value: string, level: "primary" | "secondary" = "primary"): string {
  const n = value.length;
  if (level === "secondary") return n <= 13 ? "text-lg" : "text-base";
  if (n <= 12) return "text-2xl";
  if (n <= 15) return "text-xl";
  return "text-lg";
}

/**
 * Thẻ KPI: nhãn (+ icon tròn tuỳ chọn) · giá trị lớn (số đầy đủ) · dòng phụ · chú thích định nghĩa · xu hướng.
 * `change` bỏ trống → không hiện dòng xu hướng (chỉ số ảnh chụp).
 */
export function KpiCard({
  label,
  value,
  detail,
  note,
  change,
  compareLabel = "30 ngày trước",
  higherIsBetter,
  icon,
  iconTone,
}: {
  label: string;
  value: string;
  detail?: string;
  note?: string;
  change?: Change;
  compareLabel?: string;
  higherIsBetter?: boolean;
  icon?: ReactNode;
  iconTone?: StatIconTone;
}) {
  return (
    <div className={`${STAT_CARD_CLASS} p-5`}>
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm font-medium" style={{ color: STAT_INK_SOFT }}>
          {label}
        </p>
        {icon ? <StatIcon icon={icon} tone={iconTone} /> : null}
      </div>
      <p
        className={`mt-1 ${statValueSizeClass(value)} leading-tight font-bold tabular-nums [overflow-wrap:anywhere]`}
        style={{ color: STAT_INK }}
      >
        {value}
      </p>
      {detail ? (
        <p className="mt-0.5 text-xs tabular-nums [overflow-wrap:anywhere]" style={{ color: STAT_INK_SOFT }}>
          {detail}
        </p>
      ) : null}
      {note ? (
        <p className="mt-1.5 text-xs leading-relaxed" style={{ color: STAT_INK_SOFT }}>
          {note}
        </p>
      ) : null}
      {change ? <ChangeLine change={change} compareLabel={compareLabel} higherIsBetter={higherIsBetter} /> : null}
    </div>
  );
}

/** Một điểm trên trục thời gian của biểu đồ. */
export interface TrendPoint {
  key: string;
  /** Nhãn ngắn trên trục X ("14:00", "18/10"). */
  tick: string;
  /** Nhãn đầy đủ cho tooltip/tóm tắt ("18/10/2026", "tuần từ 13/10/2026"). */
  label: string;
  value: bigint;
  /** Điểm chưa tới (vd giờ sau hiện tại) — để trống, không vẽ. */
  future?: boolean;
}

/** Nhãn trục X thưa: mặc định neo điểm đầu, tối đa ~5 nhãn — không chồng chữ ở 360px (nhãn "dd/mm" ≈ 30px). */
function defaultShowTick(i: number, n: number): boolean {
  const step = Math.max(1, Math.ceil(n / 5));
  return i % step === 0;
}

/**
 * Biểu đồ theo thời gian bằng HTML (cột) hoặc HTML + SVG (đường), không thư viện. Khối `role="img"` có `aria-label`
 * tóm tắt (khoảng thời gian, giá trị cao nhất); cột/trục bên trong `aria-hidden`; bảng số liệu thay thế do nơi gọi
 * đặt ngay dưới (`<details>`). Mọi điểm (≤ 31) co giãn theo chiều rộng khung — trang không cuộn ngang.
 */
export function TrendChart({
  points,
  variant = "bar",
  metricName,
  formatAxis,
  formatFull,
  emptyText,
  color = brandColors.primary,
  heightClass = "h-48",
  integerScale = false,
  showTick = defaultShowTick,
}: {
  points: TrendPoint[];
  variant?: "bar" | "line";
  /** Tên chỉ số cho câu tóm tắt ("Doanh thu gộp", "Đơn đã thanh toán"). */
  metricName: string;
  formatAxis: (v: bigint) => string;
  formatFull: (v: bigint) => string;
  emptyText: string;
  color?: string;
  heightClass?: string;
  /** Chỉ số đếm (số nguyên): ẩn nhãn mốc giữa khi max lẻ để không ghi sai (vd 1,5 đơn làm tròn thành 1). */
  integerScale?: boolean;
  showTick?: (i: number, n: number) => boolean;
}) {
  const past = points.filter((p) => !p.future);
  const max = past.reduce((m, p) => (p.value > m ? p.value : m), BigInt(0));
  const first = past[0];
  const last = past[past.length - 1];
  const peak = past.find((p) => p.value === max);

  if (!first || !last || !peak || max === BigInt(0)) {
    return (
      <p
        className={`flex ${heightClass} items-center justify-center rounded-xl border border-dashed border-gray-200 px-4 text-center text-sm`}
        style={{ color: STAT_INK_SOFT }}
      >
        {emptyText}
      </p>
    );
  }

  const kind = variant === "bar" ? "cột" : "đường";
  const span = first === last ? first.label : `từ ${first.label} đến ${last.label}`;
  const summary = `Biểu đồ ${kind} ${metricName}, ${span}. Cao nhất ${formatFull(max)} vào ${peak.label}. Bảng số liệu chi tiết ở ngay dưới biểu đồ.`;
  const half = max / BigInt(2);
  const showHalf = !integerScale || max % BigInt(2) === BigInt(0);
  const n = points.length;
  const lastIndex = n - 1;
  const pctOf = (v: bigint) => Number((v * BigInt(1000)) / max) / 10;

  return (
    <div>
      <div role="img" aria-label={summary} className="flex gap-2">
        {/* Trục Y: số đầy đủ, cột co theo nhãn dài nhất. Dưới `sm` giới hạn 5.5rem — số rất lớn xuống dòng ở khoảng trắng trước "đ". */}
        <div
          className={`flex ${heightClass} max-w-[5.5rem] min-w-8 shrink-0 flex-col justify-between text-right text-[11px] leading-tight tabular-nums sm:max-w-none sm:whitespace-nowrap`}
          style={{ color: STAT_INK_SOFT }}
          aria-hidden="true"
        >
          <span className="-mt-1.5">{formatAxis(max)}</span>
          <span>{showHalf ? formatAxis(half) : ""}</span>
          <span className="-mb-1.5">0</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`relative ${heightClass}`}>
            {/* Lưới ngang mờ */}
            <div className="pointer-events-none absolute inset-0 flex flex-col justify-between" aria-hidden="true">
              <div className="border-t border-dashed border-gray-200" />
              <div className="border-t border-dashed border-gray-200" />
              <div className="border-t border-gray-300" />
            </div>
            {variant === "bar" ? (
              <div className="relative flex h-full items-end gap-px sm:gap-0.5" aria-hidden="true">
                {points.map((p) => {
                  if (p.future) return <div key={p.key} className="flex-1" />;
                  const pct = pctOf(p.value);
                  const positive = p.value > BigInt(0);
                  return (
                    <div
                      key={p.key}
                      className={`flex-1 rounded-t-sm transition-opacity hover:opacity-80 motion-reduce:transition-none ${positive ? "" : "bg-gray-200"}`}
                      style={{ height: positive ? `${Math.max(2, pct)}%` : "2px", background: positive ? color : undefined }}
                      title={`${p.label}: ${formatFull(p.value)}`}
                    />
                  );
                })}
              </div>
            ) : (
              <LinePlot points={points} pctOf={pctOf} color={color} formatFull={formatFull} />
            )}
          </div>
          {/* Trục X */}
          <div className="relative mt-1.5 flex h-4 gap-px text-[11px] tabular-nums sm:gap-0.5" style={{ color: STAT_INK_SOFT }} aria-hidden="true">
            {points.map((p, i) => (
              <div key={p.key} className="relative flex-1">
                {showTick(i, n) ? (
                  <span className={`absolute top-0 whitespace-nowrap ${i === 0 ? "left-0" : i === lastIndex ? "right-0" : "left-1/2 -translate-x-1/2"}`}>
                    {p.tick}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs" style={{ color: STAT_INK_SOFT }}>
        Cao nhất:{" "}
        <span className="font-semibold tabular-nums" style={{ color: STAT_INK }}>
          {formatFull(max)}
        </span>{" "}
        — {peak.label}
      </p>
    </div>
  );
}

/** Đường nối các điểm đã qua (SVG co giãn, nét không méo nhờ `non-scaling-stroke`); chấm tròn HTML khi ≤ 16 điểm. */
function LinePlot({
  points,
  pctOf,
  color,
  formatFull,
}: {
  points: TrendPoint[];
  pctOf: (v: bigint) => number;
  color: string;
  formatFull: (v: bigint) => string;
}) {
  const n = points.length;
  const coords = points
    .map((p, i) => ({ p, x: ((i + 0.5) / n) * 100, y: pctOf(p.value) }))
    .filter((c) => !c.p.future);
  const showDots = n <= 16;
  return (
    <div className="absolute inset-0" aria-hidden="true">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">
        <polyline
          points={coords.map((c) => `${c.x},${100 - c.y}`).join(" ")}
          fill="none"
          stroke={color}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {showDots
        ? coords.map((c) => (
            <span
              key={c.p.key}
              className="absolute h-2.5 w-2.5 -translate-x-1/2 translate-y-1/2 rounded-full border-2 bg-white"
              style={{ left: `${c.x}%`, bottom: `${c.y}%`, borderColor: color }}
              title={`${c.p.label}: ${formatFull(c.p.value)}`}
            />
          ))
        : null}
    </div>
  );
}

/** Thanh ngang tỷ lệ (top sản phẩm, phân bố sao) — chỉ trang trí, giá trị luôn có chữ số bên cạnh. */
export function RatioBar({ ratio, color = brandColors.primary, label }: { ratio: number; color?: string; label?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(ratio * 1000) / 10));
  return (
    <div className="h-2 w-full rounded-full bg-gray-100" aria-hidden="true" title={label}>
      <div className="h-2 rounded-full" style={{ width: `${pct > 0 ? Math.max(pct, 2) : 0}%`, background: color }} />
    </div>
  );
}
