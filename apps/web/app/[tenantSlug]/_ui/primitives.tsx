import type { CSSProperties, ReactNode } from "react";

/**
 * Khối dựng dùng chung của storefront (bám ảnh mẫu portfolio): container nội dung 1280px,
 * tiêu đề section căn giữa IN HOA + gạch accent, nút pill và link CTA an toàn.
 * href CTA đến từ CMS của tenant đã được lọc ở `@gieochu/core` (chỉ #anchor, /path, http(s)).
 */

/**
 * Container chung = utility `container-page` (ADR-024, khai báo trong app/globals.css): nội dung tối đa
 * 1280px, căn giữa, lề 16/24/32px. Giữ tên hằng để các section khỏi đổi import.
 */
export const CONTAINER = "container-page";

/**
 * Anchor id theo type section (id section, CTA hero trỏ #tai-lieu/#lien-he). Storefront không còn menu anchor (ADR-025).
 * ADR-029 (M10a): `#danh-gia` thuộc về section đánh giá THẬT (`reviews`); section nhập tay `testimonials` hiển thị
 * là "Cảm nhận" nên dùng `#cam-nhan`. CTA cũ trỏ `#danh-gia` giờ dẫn tới đánh giá thật (không render khi chưa có).
 */
export const SECTION_ANCHORS = {
  hero: { id: "gioi-thieu" },
  services: { id: "dich-vu" },
  products: { id: "tai-lieu" },
  testimonials: { id: "cam-nhan" },
  reviews: { id: "danh-gia" },
  posts: { id: "bai-viet" },
  contact: { id: "lien-he" },
} as const;

export function SectionHeading({ id, title, subtitle }: { id: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center">
      <h2
        id={id}
        className="font-[family-name:var(--font-heading)] text-2xl leading-tight font-extrabold tracking-[0.04em] text-balance uppercase [overflow-wrap:anywhere] sm:text-[28px]"
      >
        {title}
      </h2>
      <span aria-hidden="true" className="mx-auto mt-3.5 block h-[3px] w-[45px] rounded-full" style={{ background: "var(--sf-accent)" }} />
      {subtitle ? (
        <p className="mx-auto mt-4 max-w-2xl text-[15px] leading-relaxed sm:text-base" style={{ color: "var(--sf-ink-soft)" }}>
          {subtitle}
        </p>
      ) : null}
    </div>
  );
}

function isExternal(href: string): boolean {
  return /^https?:\/\//i.test(href);
}

export type PillTone = "primary" | "accent" | "white";

const PILL_TONE: Record<PillTone, string> = {
  primary:
    "bg-[color:var(--sf-primary)] text-[color:var(--sf-on-primary)] shadow-[0_12px_26px_-12px_var(--sf-primary)]",
  accent: "bg-[color:var(--sf-accent)] text-[color:var(--sf-on-accent)] shadow-[0_12px_26px_-12px_var(--sf-accent)]",
  white: "bg-white text-[color:var(--sf-accent-text)] shadow-lg shadow-black/15",
};

const PILL_SIZE = {
  md: "min-h-11 px-6 text-[13px]",
  lg: "min-h-12 px-8 text-sm",
} as const;

/** Class chung của nút pill in hoa (mẫu: HIRE ME / VIEW MY WORK / SEND MESSAGE). */
export function pillClass(tone: PillTone, size: keyof typeof PILL_SIZE = "lg"): string {
  return `inline-flex items-center justify-center gap-2 rounded-full font-[family-name:var(--font-heading)] font-bold tracking-[0.08em] uppercase transition-[filter,transform] duration-200 hover:brightness-110 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 ${PILL_TONE[tone]} ${PILL_SIZE[size]}`;
}

/**
 * Link CTA do tenant cấu hình. URL tuyệt đối → mở tab mới (rel noopener) và báo
 * cho trình đọc màn hình; #anchor và /đường-dẫn → điều hướng bình thường.
 */
export function SfLink({
  href,
  className,
  style,
  children,
}: {
  href: string;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  if (isExternal(href)) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className} style={style}>
        {children}
        <span className="sr-only"> (mở tab mới)</span>
      </a>
    );
  }
  return (
    <a href={href} className={className} style={style}>
      {children}
    </a>
  );
}

/** Chữ cái đầu (monogram) — dùng khi không có ảnh. */
export function initialOf(name: string): string {
  return name.trim().slice(0, 1).toUpperCase() || "?";
}
