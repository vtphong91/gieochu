import type { CSSProperties, ReactNode } from "react";
import { floorStatValue, isStatRounded } from "@gieochu/core/home-sections";
import type { HeroStatBadgeItem } from "../../lib/home";
import { AMBER, BLUE, GREEN, INK, INK_SOFT, IconDocs, IconStar, IconStorefront, formatCount } from "./catalog-parts";

type IconProps = { className?: string; style?: CSSProperties };

/** Lượt mua — túi mua hàng (cùng nét 1.7 với bộ icon catalog-parts). */
function IconBag({ className, style }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5.5 8h13l-1 11.5a1 1 0 0 1-1 .9h-9a1 1 0 0 1-1-.9Z" />
      <path d="M9 10.5V7a3 3 0 0 1 6 0v3.5" />
    </svg>
  );
}

/** Icon + sắc màu theo số liệu (ADR-050 lần 3: tenants / products / sold / reviews). Màu là token runtime `var(--brand-*)`. */
const METRIC_VISUAL: Record<HeroStatBadgeItem["metric"], { Icon: (props: IconProps) => ReactNode; color: string }> = {
  tenants: { Icon: IconStorefront, color: BLUE },
  products: { Icon: IconDocs, color: AMBER },
  sold: { Icon: IconBag, color: GREEN },
  reviews: { Icon: IconStar, color: AMBER },
};

/**
 * Bản đọc cho trình đọc màn hình, dựng từ `value` thật và cùng quy tắc với `formatCompactStatCount`
 * (`isStatRounded` / `floorStatValue`) → không bao giờ phóng đại; "Hơn" xuất hiện đúng khi chữ hiển thị có "+".
 * "1,2K+" → "Hơn 1.200"; "1,2K" → "1.200"; "87" → "87".
 */
function spokenCount(value: number): string {
  const floored = floorStatValue(value);
  return isStatRounded(value) ? `Hơn ${formatCount(floored)}` : formatCount(floored);
}

/**
 * Vị trí thẻ nổi trên desktop (lg+), theo số thẻ — thứ tự trên → dưới khớp thứ tự DOM (= thứ tự CMS):
 * 1 thẻ: dưới-trái · 2 thẻ: trên-phải, dưới-trái · 3 thẻ: trên-phải, giữa-phải, dưới-trái.
 * Độ tràn ra ngoài mép khung ≤ lề `container-page` (32px ở lg) → không gây cuộn ngang; section vẫn `overflow-x-clip` dự phòng.
 */
const TOP_RIGHT = "lg:top-[7%] lg:-right-4 xl:-right-6";
const MIDDLE_RIGHT = "lg:top-1/2 lg:-translate-y-1/2 lg:-right-6 xl:-right-8";
const BOTTOM_LEFT = "lg:bottom-[7%] lg:-left-8 xl:-left-12";
const POSITIONS: Record<number, string[]> = {
  1: [BOTTOM_LEFT],
  2: [TOP_RIGHT, BOTTOM_LEFT],
  3: [TOP_RIGHT, MIDDLE_RIGHT, BOTTOM_LEFT],
};

const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3" };

/**
 * Thẻ số liệu nổi bật của Hero (ADR-050 lần 3). Đặt **bên trong** khung media có `position: relative`, ngay sau ảnh/minh hoạ.
 * - Mobile/tablet: hàng ngang dưới ảnh, 1–3 cột co giãn, không phủ ảnh.
 * - Desktop (lg+): mỗi thẻ `absolute` phủ mép khung theo `POSITIONS`; `ul` còn trong luồng nhưng cao 0 → không nhảy layout.
 * - A11y: `ul` có nhãn nhóm; phần nhìn thấy `aria-hidden`, kèm câu sr-only "Hơn 1.200 Gian hàng…".
 * Không có hiệu ứng chuyển động → không cần nhánh `prefers-reduced-motion`.
 */
export function HeroStatBadges({ items, groupLabel = "Số liệu nổi bật" }: { items: HeroStatBadgeItem[]; groupLabel?: string }) {
  if (items.length === 0) return null;
  const shown = items.slice(0, 3);
  const positions = POSITIONS[shown.length] ?? [];
  return (
    <ul role="list" aria-label={groupLabel} className={`mt-5 grid gap-2.5 sm:gap-3 lg:mt-0 lg:block ${GRID_COLS[shown.length] ?? "grid-cols-3"}`}>
      {shown.map((badge, index) => {
        const { Icon, color } = METRIC_VISUAL[badge.metric];
        return (
          <li
            key={badge.id}
            className={`flex min-w-0 flex-col items-center gap-2 rounded-2xl bg-white px-2.5 py-3 text-center sm:flex-row sm:gap-3 sm:px-3.5 sm:text-left lg:absolute lg:z-10 lg:w-max lg:max-w-[220px] lg:min-w-[170px] lg:px-4 lg:py-3.5 ${positions[index] ?? ""}`}
            style={{ boxShadow: "0 18px 40px rgba(6,12,35,0.28)" }}
          >
            <span className="sr-only">{`${spokenCount(badge.value)} ${badge.label}`}</span>
            <span
              aria-hidden="true"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:h-10 sm:w-10"
              style={{ background: `color-mix(in srgb, ${color} 14%, white)`, color }}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span aria-hidden="true" className="flex min-w-0 flex-col">
              <span className="font-[family-name:var(--font-heading)] text-xl leading-tight font-bold tabular-nums sm:text-2xl" style={{ color: INK }}>
                {badge.display}
              </span>
              <span className="mt-0.5 text-xs leading-snug [overflow-wrap:anywhere] sm:text-[13px]" style={{ color: INK_SOFT }}>
                {badge.label}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
