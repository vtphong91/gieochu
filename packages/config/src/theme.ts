/**
 * Design tokens theo docs/GIEOCHU_BRAND_IDENTITY_PRODUCT_PROPOSAL_V1.0.md §28
 * (Color System) và §30 (Typography). `primary`/`accent`/`secondary`/
 * `background`/`surface`/`ink` là giá trị gốc trong proposal — các key còn
 * lại (`primaryDeep`, `accentSoft`, `backgroundAlt`, `line`, `inkSoft`) là
 * biến thể tiện ích (tint/shade) suy ra để dùng cho gradient, border, badge —
 * proposal không định nghĩa trực tiếp.
 *
 * Toàn bộ UI (trang chủ, auth, System Center, trang CMS) phải đọc màu từ đây
 * thay vì hard-code hex riêng lẻ từng file — một nguồn duy nhất khi rebrand.
 */
/**
 * `primary`/`accent`/`secondary`/`primaryDeep`/`accentSoft` là CSS
 * var() có fallback — System Admin đổi màu qua /admin/settings/branding
 * (bảng SystemBranding), root layout (apps/web/app/layout.tsx) tính 2 sắc
 * dẫn xuất (primaryDeep/accentSoft) rồi set `:root` bằng 1 thẻ <style>. Chưa
 * cấu hình gì thì var() rỗng, trình duyệt tự dùng giá trị fallback (đúng hex
 * gốc bên dưới) — không cần JS nào khác, không "nhấp nháy" màu sai lúc tải.
 */
export const brandColors = {
  /** Primary — Xanh tri thức: header, hero, navigation, primary UI. */
  primary: "var(--brand-primary, #0F3B82)",
  /** Điểm tối cho gradient/hero (derived — đậm hơn primary). */
  primaryDeep: "var(--brand-primary-deep, #12213A)",
  /** Accent — Cam năng lượng: CTA, highlight, pricing, achievement. */
  accent: "var(--brand-accent, #D97706)",
  /** Tint nhạt của accent — badge, nhấn nhẹ (derived — nhạt hơn accent). */
  accentSoft: "var(--brand-accent-soft, #FCEBD5)",
  /** Secondary — Xanh phát triển: success, growth, positive state. */
  secondary: "var(--brand-secondary, #16A34A)",
  /** Background — Kem ấm: nền trang, section editorial. */
  background: "#FFF7E9",
  /** Biến thể ấm hơn của background — zebra-stripe section (derived). */
  backgroundAlt: "#F5EEDD",
  /** Surface — Xanh nhạt: card, secondary section, soft highlight. */
  surface: "#E8F1FF",
  /** Border ấm hài hoà với background (derived). */
  line: "#E7DFC9",
  /** Text — Navy: heading, body text, dark UI. */
  ink: "#12213A",
  /** Biến thể nhạt của Text cho nội dung phụ (derived). */
  inkSoft: "#55607A",
} as const;

/**
 * Heading: Be Vietnam Pro (lựa chọn đầu trong proposal, đã hỗ trợ tiếng Việt
 * sẵn trong dự án). Body: Inter (lựa chọn đầu trong proposal). Google Fonts
 * load qua next/font trong từng app — đây chỉ là tên font + CSS variable
 * dùng chung để mọi nơi gọi đúng 1 cặp font.
 */
export const brandFonts = {
  headingVar: "--font-heading",
  bodyVar: "--font-body",
} as const;
