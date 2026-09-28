type IconProps = { className?: string };
const base = { viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.8", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

export function IconBold({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 4h7a3.5 3.5 0 0 1 0 7H6z" />
      <path d="M6 11h8a3.5 3.5 0 0 1 0 7H6z" />
    </svg>
  );
}
export function IconItalic({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M11 4h6M5 20h6M14 4 8 20" />
    </svg>
  );
}
export function IconUnderline({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 4v7a6 6 0 0 0 12 0V4M5 20h14" />
    </svg>
  );
}
export function IconStrike({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 12h12M8 6.5c0-1.4 1.8-2.5 4-2.5s4 1 4 2.3M8 17.3c0 1.4 1.8 2.5 4 2.5s4-1 4-2.5" />
    </svg>
  );
}
export function IconCode({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m9 8-4 4 4 4M15 8l4 4-4 4" />
    </svg>
  );
}
export function IconHighlight({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m14 4 6 6-8.5 8.5H5v-6.5z" />
      <path d="M4 20h16" />
    </svg>
  );
}
export function IconBulletList({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="4.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" stroke="none" />
      <circle cx="4.5" cy="18" r="1" fill="currentColor" stroke="none" />
      <path d="M9 6h11M9 12h11M9 18h11" />
    </svg>
  );
}
export function IconOrderedList({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4.5 4.5v3M4.5 7.5h1M4 12h1.2c.5 0 .8.4.6.9l-1.6 1.9h1.8M4.3 20v-1.8c0-.5.4-.9.9-.9s.9.4.9.9V20" />
    </svg>
  );
}
export function IconQuote({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 7c-1.7 0-3 1.3-3 3v3h3v-3H5c0-1.1.9-2 2-2zM16 7c-1.7 0-3 1.3-3 3v3h3v-3h-2c0-1.1.9-2 2-2z" />
    </svg>
  );
}
export function IconAlignLeft({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M4 12h10M4 18h13" />
    </svg>
  );
}
export function IconAlignCenter({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M7 12h10M5.5 18h13" />
    </svg>
  );
}
export function IconAlignRight({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M10 12h10M7 18h13" />
    </svg>
  );
}
export function IconAlignJustify({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  );
}
export function IconLinkChain({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9.5 14.5 14.5 9.5" />
      <path d="M11 6.5 12.6 5A4 4 0 1 1 18.3 10.7l-1.6 1.6M13 17.5 11.4 19A4 4 0 1 1 5.7 13.3l1.6-1.6" />
    </svg>
  );
}
export function IconImagePic({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.4" />
      <path d="m5 17 4.5-5 3.5 4 2.5-3 4.5 4.5" />
    </svg>
  );
}
export function IconUndo({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7 9H4V6M4 9a8 8 0 1 1 2 5.3" />
    </svg>
  );
}
export function IconRedo({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M17 9h3V6M20 9a8 8 0 1 0-2 5.3" />
    </svg>
  );
}
export function IconTextColor({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M9.5 15 12.5 6l3 9M10.3 12.5h4.4" />
      <path d="M5 20h14" />
    </svg>
  );
}
export function IconHorizontalRule({ className }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4 12h16" />
    </svg>
  );
}
/** Vòng tải — quay chỉ khi người dùng không bật giảm chuyển động (motion-safe). */
export function IconSpinner({ className }: IconProps) {
  return (
    <svg {...base} className={`motion-safe:animate-spin ${className ?? ""}`} aria-hidden="true">
      <path d="M12 3.5a8.5 8.5 0 1 0 8.5 8.5" />
    </svg>
  );
}
