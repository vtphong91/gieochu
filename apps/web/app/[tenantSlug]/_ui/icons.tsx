import type { JSX } from "react";
import type { ProductType } from "@gieochu/db";
import type { StorefrontServiceIcon } from "@gieochu/core/storefront-sections";
import type { StorefrontSocialLinks } from "../../../lib/storefront";
import { IconDoc, IconGlobe } from "../../admin/_ui/icons";

/**
 * Icon riêng của storefront công khai. Icon chung (tài liệu, quả địa cầu...)
 * tái dùng từ admin/_ui/icons.tsx; ở đây chỉ thêm icon mạng xã hội, loại tài
 * liệu và vài icon trang trí. Tất cả là SVG `currentColor`, nét 1.8 như bộ gốc.
 * Mọi icon mặc định `aria-hidden` — nơi dùng tự đặt nhãn chữ / aria-label.
 */
type IconProps = { className?: string };

const STROKE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;

export function IconCheck({ className }: IconProps) {
  return (
    <svg {...STROKE} strokeWidth={2.6} className={className}>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

export function IconArrowDown({ className }: IconProps) {
  return (
    <svg {...STROKE} strokeWidth={2} className={className}>
      <path d="M12 5v14M5.5 12.5 12 19l6.5-6.5" />
    </svg>
  );
}

export function IconSend({ className }: IconProps) {
  return (
    <svg {...STROKE} strokeWidth={1.4} className={className}>
      <path d="M21 3 3 10.5l7 2.5 2.5 7L21 3Z" />
      <path d="M10 13 21 3" />
    </svg>
  );
}

export function IconInfo({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 11v5.5M12 7.8v.2" />
    </svg>
  );
}

export function IconLockClosed({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <rect x="5" y="10.5" width="14" height="10" rx="2" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
    </svg>
  );
}

/** Máy bay giấy khối đặc (khối CTA liên hệ) — trang trí, 2 mặt đậm/nhạt. */
export function IconPaperPlane({ className }: IconProps) {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false" className={className}>
      <path d="M60 4 4 28l18 7 4 21 10-14 14 10L60 4Z" fill="currentColor" fillOpacity="0.9" />
      <path d="M60 4 22 35l4 21 3-15L60 4Z" fill="currentColor" fillOpacity="0.55" />
    </svg>
  );
}

/** Dấu ngoặc kép lớn của thẻ đánh giá — trang trí. */
export function IconQuote({ className }: IconProps) {
  return (
    <svg viewBox="0 0 48 40" aria-hidden="true" focusable="false" className={className}>
      <path
        fill="currentColor"
        d="M0 40V24.6C0 10.9 6.7 2.6 20 0l2.4 5.2C15.6 7.4 12 11.7 11.5 18H20v22H0Zm26 0V24.6C26 10.9 32.7 2.6 46 0l2 5.2C41.6 7.4 38 11.7 37.5 18H46v22H26Z"
      />
    </svg>
  );
}

export function IconStar({ className, filled }: IconProps & { filled: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={className}>
      <path
        d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6.1L12 16.8l-5.4 2.9 1.1-6.1L3.2 9.4l6.1-.8L12 3Z"
        fill={filled ? "currentColor" : "none"}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- Icon minh hoạ cho section Dịch vụ (8 key của StorefrontServiceIcon) ----------
   Kiểu duotone 48×48: mảng nền `currentColor` mờ + nét đậm, đổi màu theo `color` của thẻ. */

const DUO = {
  viewBox: "0 0 48 48",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2.4,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
} as const;
const SOFT = { fill: "currentColor", fillOpacity: 0.16, stroke: "none" } as const;

const SERVICE_ICONS: Record<StorefrontServiceIcon, (props: IconProps) => JSX.Element> = {
  book: ({ className }) => (
    <svg {...DUO} className={className}>
      <path {...SOFT} d="M24 12c-4-3-9-4-17-4v26c8 0 13 1 17 4 4-3 9-4 17-4V8c-8 0-13 1-17 4Z" />
      <path d="M24 12c-4-3-9-4-17-4v26c8 0 13 1 17 4 4-3 9-4 17-4V8c-8 0-13 1-17 4Z" />
      <path d="M24 12v26M12 16c3 0 6 .6 8 1.6M12 22c3 0 6 .6 8 1.6M28 17.6c2-1 5-1.6 8-1.6" />
    </svg>
  ),
  slides: ({ className }) => (
    <svg {...DUO} className={className}>
      <rect {...SOFT} x="6" y="8" width="36" height="24" rx="3" />
      <rect x="6" y="8" width="36" height="24" rx="3" />
      <path d="M24 32v7M17 41h14M13 25l6-6 5 4 7-8 4 4" />
    </svg>
  ),
  exam: ({ className }) => (
    <svg {...DUO} className={className}>
      <rect {...SOFT} x="10" y="7" width="28" height="35" rx="3" />
      <rect x="10" y="7" width="28" height="35" rx="3" />
      <path d="M18 7v4h12V7M16 21l3 3 5-5M16 32l3 3 5-5M28 22h4M28 33h4" />
    </svg>
  ),
  template: ({ className }) => (
    <svg {...DUO} className={className}>
      <rect {...SOFT} x="7" y="7" width="34" height="10" rx="2" />
      <rect x="7" y="7" width="34" height="34" rx="3" />
      <path d="M7 17h34M19 17v24M24 25h12M24 31h9" />
    </svg>
  ),
  coaching: ({ className }) => (
    <svg {...DUO} className={className}>
      <circle {...SOFT} cx="18" cy="17" r="7" />
      <circle cx="18" cy="17" r="7" />
      <path d="M5 40c1-7 6-11 13-11s12 4 13 11" />
      <path d="M31 11a6 6 0 0 1 0 12M36 29c4 1.6 6.5 5 7 11" />
    </svg>
  ),
  video: ({ className }) => (
    <svg {...DUO} className={className}>
      <rect {...SOFT} x="5" y="11" width="38" height="26" rx="6" />
      <rect x="5" y="11" width="38" height="26" rx="6" />
      <path d="m21 18 9 6-9 6V18Z" fill="currentColor" />
    </svg>
  ),
  star: ({ className }) => (
    <svg {...DUO} className={className}>
      <path {...SOFT} d="m24 5 5.6 11.5 12.6 1.7-9.2 8.7 2.3 12.5L24 33.4l-11.3 6 2.3-12.5-9.2-8.7 12.6-1.7L24 5Z" />
      <path d="m24 5 5.6 11.5 12.6 1.7-9.2 8.7 2.3 12.5L24 33.4l-11.3 6 2.3-12.5-9.2-8.7 12.6-1.7L24 5Z" />
    </svg>
  ),
  chat: ({ className }) => (
    <svg {...DUO} className={className}>
      <path {...SOFT} d="M8 10h24a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H18l-8 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" />
      <path d="M8 10h24a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4H18l-8 7v-7H8a4 4 0 0 1-4-4V14a4 4 0 0 1 4-4Z" />
      <path d="M36 18h4a4 4 0 0 1 4 4v12a4 4 0 0 1-4 4h-1v5l-6-5h-7a4 4 0 0 1-3.5-2M12 20h16" />
    </svg>
  ),
};

export function ServiceIcon({ icon, className }: { icon: StorefrontServiceIcon; className?: string }) {
  const Icon = SERVICE_ICONS[icon] ?? SERVICE_ICONS.star;
  return <Icon className={className} />;
}

/* ---------- Loại tài liệu (enum ProductType) ---------- */

function IconTemplate({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M9 9v11" />
    </svg>
  );
}

function IconSlide({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <rect x="3" y="4" width="18" height="12" rx="1.5" />
      <path d="M12 16v4M8.5 20h7M7.5 12.5l3-3 2.5 2 3.5-3.5" />
    </svg>
  );
}

function IconBook({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <path d="M12 6.5C10.3 5 7.8 4.5 4 4.5v13c3.8 0 6.3.5 8 2 1.7-1.5 4.2-2 8-2v-13c-3.8 0-6.3.5-8 2Z" />
      <path d="M12 6.5v13" />
    </svg>
  );
}

function IconExam({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <rect x="5" y="3.5" width="14" height="17" rx="1.5" />
      <path d="M9 3.5V5.5h6V3.5M8.5 11l1.5 1.5 2.5-2.5M8.5 16l1.5 1.5 2.5-2.5M14.5 11.5h1.5M14.5 16.5h1.5" />
    </svg>
  );
}

/** Nhãn tiếng Việt theo enum ProductType ở schema (TEMPLATE | SLIDE | EBOOK | EXAM | OTHER). */
export const PRODUCT_TYPE_LABEL: Record<ProductType, string> = {
  TEMPLATE: "Mẫu tài liệu",
  SLIDE: "Slide bài giảng",
  EBOOK: "Sách điện tử",
  EXAM: "Đề thi",
  OTHER: "Tài liệu",
};

const PRODUCT_TYPE_ICON: Record<ProductType, (props: IconProps) => JSX.Element> = {
  TEMPLATE: IconTemplate,
  SLIDE: IconSlide,
  EBOOK: IconBook,
  EXAM: IconExam,
  OTHER: IconDoc,
};

export function ProductTypeIcon({ type, className }: { type: ProductType; className?: string }) {
  const Icon = PRODUCT_TYPE_ICON[type];
  return (
    <span aria-hidden="true" className="inline-flex">
      <Icon className={className} />
    </span>
  );
}

/* ---------- Mạng xã hội (dạng đơn sắc, currentColor) ---------- */

function IconFacebook({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <path d="M14.5 21v-7.5h2.7l.4-3.2h-3.1V8.4c0-.9.3-1.6 1.6-1.6h1.7V4a22 22 0 0 0-2.5-.1c-2.5 0-4.1 1.5-4.1 4.2v2.3H8.5v3.2h2.7V21" />
    </svg>
  );
}

function IconYoutube({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <rect x="2.5" y="5.5" width="19" height="13" rx="4" />
      <path d="m10 9.2 5 2.8-5 2.8V9.2Z" fill="currentColor" />
    </svg>
  );
}

function IconTiktok({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <path d="M13.5 3.5v11.3a3.2 3.2 0 1 1-3.2-3.2" />
      <path d="M13.5 3.5c.4 2.6 2.1 4.2 4.8 4.4" />
    </svg>
  );
}

function IconZalo({ className }: IconProps) {
  return (
    <svg {...STROKE} className={className}>
      <path d="M12 3.5c-4.9 0-8.5 3.3-8.5 7.4 0 2.3 1.1 4.3 2.9 5.7L6 20l3.6-1.9c.8.2 1.6.3 2.4.3 4.9 0 8.5-3.3 8.5-7.5S16.9 3.5 12 3.5Z" />
      <path d="M9 8.8h5.5L9 14.2h5.5" />
    </svg>
  );
}

export type SocialKey = keyof StorefrontSocialLinks;

export const SOCIAL_META: Record<SocialKey, { label: string; Icon: (props: IconProps) => JSX.Element }> = {
  zalo: { label: "Zalo", Icon: IconZalo },
  facebook: { label: "Facebook", Icon: IconFacebook },
  website: { label: "Website", Icon: IconGlobe },
  youtube: { label: "YouTube", Icon: IconYoutube },
  tiktok: { label: "TikTok", Icon: IconTiktok },
};

/** Thứ tự ưu tiên hiển thị/liên hệ: zalo > facebook > website > youtube > tiktok. */
export const SOCIAL_ORDER: readonly SocialKey[] = ["zalo", "facebook", "website", "youtube", "tiktok"];

export interface SocialEntry {
  key: SocialKey;
  label: string;
  href: string;
}

/** Danh sách link có thật, theo thứ tự ưu tiên. Phần tử đầu = kênh "Liên hệ" chính. */
export function socialEntries(links: StorefrontSocialLinks): SocialEntry[] {
  const entries: SocialEntry[] = [];
  for (const key of SOCIAL_ORDER) {
    const href = links[key];
    if (href) entries.push({ key, label: SOCIAL_META[key].label, href });
  }
  return entries;
}

export function SocialIcon({ socialKey, className }: { socialKey: SocialKey; className?: string }) {
  const { Icon } = SOCIAL_META[socialKey];
  return (
    <span aria-hidden="true" className="inline-flex">
      <Icon className={className} />
    </span>
  );
}
