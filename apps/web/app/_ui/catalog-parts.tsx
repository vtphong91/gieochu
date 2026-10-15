import type { CSSProperties } from "react";
import { brandColors } from "@gieochu/config/theme";

/**
 * Mảnh trình bày dùng chung cho thẻ tài liệu / gian hàng trên trang công khai hệ thống (trang chủ + Cửa hàng,
 * ADR-033/035): màu từ token, icon SVG, định dạng số vi-VN, dòng sao, class thẻ "stretched link".
 * Server-safe (không hook, không state) — client component cũng import được.
 */

export const INK = brandColors.ink;
export const INK_SOFT = brandColors.inkSoft;
export const LINE = brandColors.line;
export const PAPER_ALT = brandColors.backgroundAlt;
export const BLUE = brandColors.primary;
export const BLUE_DEEP = brandColors.primaryDeep;
export const AMBER = brandColors.accent;
export const AMBER_SOFT = brandColors.accentSoft;
export const GREEN = brandColors.secondary;

/**
 * Nền nhãn "Giảm N%" — đỏ đậm (chữ trắng 6.5:1). Chưa có token "sale/danger" trong `theme.ts`; giữ đúng giá trị
 * trang chủ đang dùng (nợ: thêm token khi Quốc duyệt đổi `theme.ts`).
 */
export const SALE_RED = "#B91C1C";

/**
 * Bảng màu trang trí cố định, xoay vòng theo chỉ số phần tử — không phải nội dung (admin không đổi), màu/bố cục do
 * code quyết định.
 */
export const ROTATING_COLORS = [BLUE, AMBER, GREEN, BLUE_DEEP] as const;

export function rotatingColor(index: number): string {
  const size = ROTATING_COLORS.length;
  return ROTATING_COLORS[((index % size) + size) % size]!;
}

/** Nền pastel suy ra từ màu token (không thêm hex mới): 10% màu trên nền trắng. */
export function pastelOf(color: string, percent = 10): string {
  return `color-mix(in srgb, ${color} ${percent}%, white)`;
}

// ───────────── Icon (SVG, trang trí — luôn aria-hidden; nghĩa nằm ở chữ bên cạnh) ─────────────

type IconProps = { className?: string; style?: CSSProperties };

export function IconArrow({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 12h15M13 6l6 6-6 6" />
    </svg>
  );
}

export function IconSearch({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="M20 20l-4.3-4.3" />
    </svg>
  );
}

export function IconChevron({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

export function IconDocs({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M8 3.5h6.5L19 8v11.5a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1v-15a1 1 0 0 1 1-1Z" />
      <path d="M14.2 3.5V8h4.6" />
      <path d="M9.5 12.5h5M9.5 15.5h5M9.5 18h3" />
    </svg>
  );
}

export function IconStar({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="currentColor" aria-hidden="true">
      <path d="M12 2.8l2.7 5.6 6.1.8-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.8Z" />
    </svg>
  );
}

/** Icon mặc định cho ô danh mục chưa có ảnh (thư mục). */
export function IconFolder({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 7.5a2 2 0 0 1 2-2h3.8l2 2.2h7.2a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
      <path d="M3.5 10.5h17" />
    </svg>
  );
}

export function IconStorefront({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5 5.4 4.5h13.2L20 9.5" />
      <path d="M4 9.5c0 1.4 1.1 2.5 2.5 2.5S9 10.9 9 9.5c0 1.4 1.1 2.5 2.5 2.5h1c1.4 0 2.5-1.1 2.5-2.5 0 1.4 1.1 2.5 2.5 2.5S20 10.9 20 9.5" />
      <path d="M5.5 12v7.5h13V12" />
      <path d="M10 19.5v-4h4v4" />
    </svg>
  );
}

// ───────────── Định dạng (vi-VN) ─────────────

const vnNumber = new Intl.NumberFormat("vi-VN");

export function formatCount(value: number): string {
  return vnNumber.format(value);
}

/** Tiền VND số nguyên: "149.000 ₫". */
export function formatVnd(amount: number): string {
  return `${vnNumber.format(amount)} ₫`;
}

/** "4,6" — 1 chữ số thập phân kiểu vi-VN (giống thẻ storefront, ADR-029). */
export function formatRating(average: number): string {
  return average.toLocaleString("vi-VN", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}

/** Chữ cái đầu cho avatar chữ (bỏ tiền tố "Cô/Thầy/Coach"). */
export function initialsOf(name: string): string {
  const cleaned = name.replace(/^(Cô|Thầy|Coach)\s+/i, "");
  const parts = cleaned.split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toLocaleUpperCase("vi");
}

/** % giảm hiển thị (≥1) khi đang khuyến mãi; 0 = không hiện nhãn. Chỉ để hiển thị — giá thật tính ở server. */
export function discountPercentOf(product: { onSale: boolean; priceVnd: number; effectivePriceVnd: number }): number {
  return product.onSale && product.priceVnd > 0 ? Math.max(1, Math.round((1 - product.effectivePriceVnd / product.priceVnd) * 100)) : 0;
}

// ───────────── Dòng sao ─────────────

/** "★ 4,6 (12 đánh giá)" — sao là ký hiệu trang trí (≥3:1), chữ số màu INK để đạt 4.5:1; trình đọc màn hình nghe câu đầy đủ. */
export function RatingInline({ average, count, long = false }: { average: number; count: number; long?: boolean }) {
  const avg = formatRating(average);
  return (
    <span className="inline-flex items-center gap-1 tabular-nums">
      <IconStar className="h-3.5 w-3.5 shrink-0" style={{ color: AMBER }} />
      <span aria-hidden="true" className="font-semibold" style={{ color: INK }}>
        {avg}
      </span>
      <span aria-hidden="true" style={{ color: INK_SOFT }}>
        ({formatCount(count)}
        {long ? " đánh giá" : ""})
      </span>
      <span className="sr-only">
        Điểm trung bình {avg} trên 5, {formatCount(count)} đánh giá
      </span>
    </span>
  );
}

// ───────────── Thẻ "stretched link" ─────────────

/**
 * Thẻ bấm được toàn bộ bằng "stretched link" trên tiêu đề (1 link/thẻ → tên truy cập = tên giáo viên/tài liệu, không
 * lặp "Xem chi tiết"); vòng focus vẽ trên cả thẻ. Nhấc nhẹ khi hover chỉ khi người dùng không giảm chuyển động.
 * Không đặt thêm link/nút nào khác bên trong thẻ (lớp `after:` phủ lên).
 */
export const CARD_CLASS =
  "group relative flex h-full flex-col overflow-hidden rounded-3xl border bg-white transition-[box-shadow,transform] duration-200 hover:shadow-[0_16px_36px_-18px_rgba(18,33,58,0.35)] motion-safe:hover:-translate-y-0.5 has-[a:focus-visible]:outline-3 has-[a:focus-visible]:outline-offset-2";

export const STRETCHED_LINK = "outline-none after:absolute after:inset-0 after:content-['']";

/** Vòng focus cho link/nút/summary đứng riêng trên trang công khai hệ thống. */
export const FOCUS_RING = "focus-visible:outline-2 focus-visible:outline-offset-2";

export type CardHeadingLevel = "h2" | "h3" | "h4";
