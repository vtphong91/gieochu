import { brandColors } from "@gieochu/config/theme";

/**
 * Ảnh đại diện tài khoản (ADR-041 C.3) — dùng ở header công khai, header Studio và khu vực `/account`. Không có ảnh
 * → vòng tròn chữ cái: lấy chữ cái đầu của **từ cuối** trong họ tên (tên gọi người Việt: "Nguyễn Thị Lan" → "L"),
 * không có tên thì chữ đầu email. Ảnh luôn đứng cạnh tên/email hiển thị nên mặc định `alt=""` (trang trí) — truyền
 * `alt` khi ảnh đứng một mình. Server-safe (không hook).
 */
export function AccountAvatar({
  url,
  name,
  size = 32,
  alt = "",
  className = "",
}: {
  url: string | null;
  /** Họ tên (ưu tiên) hoặc email — dùng cho chữ cái thay thế. */
  name: string;
  size?: number;
  alt?: string;
  className?: string;
}) {
  const box = { width: size, height: size };
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary đã cắt vuông + f_auto,q_auto ở server
      <img src={url} alt={alt} width={size} height={size} style={box} className={`shrink-0 rounded-full object-cover ${className}`} />
    );
  }
  return (
    <span
      aria-hidden={alt ? undefined : true}
      role={alt ? "img" : undefined}
      aria-label={alt || undefined}
      className={`flex shrink-0 items-center justify-center rounded-full font-[family-name:var(--font-heading)] font-bold text-white ${className}`}
      style={{ ...box, background: brandColors.primary, fontSize: Math.max(11, Math.round(size * 0.4)) }}
    >
      {avatarInitial(name)}
    </span>
  );
}

export function avatarInitial(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  const source = name.includes("@") ? name.trim() : (words[words.length - 1] ?? "");
  return (source.slice(0, 1) || "U").toLocaleUpperCase("vi-VN");
}
