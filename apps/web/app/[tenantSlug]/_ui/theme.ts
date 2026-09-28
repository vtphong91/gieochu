import type { CSSProperties } from "react";
import { brandColors } from "@gieochu/config/theme";
import { darkenHex, lightenHex } from "../../../lib/color-utils";

/**
 * Bảng màu storefront theo tenant. Màu tenant (Studio → Thương hiệu) có thể là
 * bất kỳ hex nào, kể cả màu sáng như vàng chanh — nên mọi cặp chữ/nền ở đây
 * được TÍNH ở server theo WCAG 2.x thay vì tin màu gốc:
 * - chữ trên nền màu (nút, khối CTA): chọn trắng / mực / đen, cặp nào đạt ≥ 4.5:1;
 * - màu tenant dùng làm CHỮ trên nền sáng: làm đậm dần đến khi đạt ngưỡng.
 * Kết quả truyền xuống bằng CSS variables inline (`--sf-*`) — không sinh class động.
 */

const WHITE = "#ffffff";
/**
 * Đỏ điểm nhấn cố định của mẫu (badge ✓, dấu ngoặc kép, sao, nút lên đầu trang,
 * icon dịch vụ thứ 3, nhãn giảm giá). Dùng red-600 thay #ef4444 của ảnh mẫu: chữ
 * trắng trên nền này đạt 4.8:1 (AA chữ thường), #ef4444 chỉ đạt 3.8:1.
 */
const RED = "#dc2626";
/** Nền xám xanh rất nhạt trung tính (footer) — gần #eef2f5 của mẫu. */
const BLACK = "#000000";
/** Màu mực của hệ thống (hex thuần trong theme.ts, không phải var()). */
const INK = brandColors.ink;

function channel(c: number): number {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function luminance(hex: string): number {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const int = parseInt(full, 16);
  return 0.2126 * channel((int >> 16) & 255) + 0.7152 * channel((int >> 8) & 255) + 0.0722 * channel(int & 255);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Chữ đặt trên (các) nền `backgrounds` — ưu tiên trắng, rồi mực, cuối cùng đen/trắng cái nào cao hơn. */
function pickTextOn(backgrounds: string[]): string {
  const worst = (fg: string) => Math.min(...backgrounds.map((bg) => contrastRatio(fg, bg)));
  if (worst(WHITE) >= 4.5) return WHITE;
  if (worst(INK) >= 4.5) return INK;
  return worst(BLACK) >= worst(WHITE) ? BLACK : WHITE;
}

/** Làm đậm `hex` từng bước 5% đến khi đạt `min` trên nền `bg`; không đạt nổi → màu mực. */
function ensureTextContrast(hex: string, bg: string, min: number): string {
  if (contrastRatio(hex, bg) >= min) return hex;
  for (let ratio = 0.95; ratio > 0; ratio -= 0.05) {
    const candidate = darkenHex(hex, ratio);
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return INK;
}

export interface StorefrontPalette {
  primary: string;
  accent: string;
}

/** CSS variables gắn vào phần tử gốc `.sf-root` của storefront. */
export function buildStorefrontStyle({ primary, accent }: StorefrontPalette): CSSProperties {
  const heroBg = lightenHex(primary, 0.05);
  const primarySoft = lightenHex(primary, 0.1);
  const onAccent = pickTextOn([accent]);
  // Đầu thứ 2 của gradient CTA đi theo hướng làm TĂNG tương phản với chữ đã chọn
  // (chữ trắng → đậm hơn, chữ tối → nhạt hơn), nên cả dải gradient đều ≥ 4.5:1.
  const ctaEnd = onAccent === WHITE ? darkenHex(accent, 0.78) : lightenHex(accent, 0.8);
  // primarySoft là nền sáng "tối nhất" mà chữ màu primary nằm trên (badge, placeholder),
  // đạt trên nó thì cũng đạt trên nền trắng/heroBg.
  const primaryText = ensureTextContrast(primary, primarySoft, 4.5);
  // Accent làm CHỮ trên nền trắng (nút trắng trong khối CTA, icon dịch vụ).
  const accentText = ensureTextContrast(accent, WHITE, 4.5);

  const vars: Record<`--sf-${string}`, string> = {
    "--sf-primary": primary,
    "--sf-on-primary": pickTextOn([primary]),
    "--sf-primary-text": primaryText,
    "--sf-primary-soft": primarySoft,
    "--sf-hero-bg": heroBg,
    "--sf-accent": accent,
    "--sf-on-accent": onAccent,
    "--sf-cta-end": ctaEnd,
    "--sf-accent-text": accentText,
    "--sf-red": RED,
    // Tiêu đề hero là chữ lớn (≥ 36px, đậm) → ngưỡng AA cho chữ lớn là 3:1.
    "--sf-heading-from": ensureTextContrast(primary, heroBg, 3),
    "--sf-heading-to": ensureTextContrast(accent, heroBg, 3),
    "--sf-focus": primaryText,
    "--sf-ink": INK,
    "--sf-ink-soft": brandColors.inkSoft,
    "--sf-line": brandColors.line,
  };
  return vars as CSSProperties;
}
