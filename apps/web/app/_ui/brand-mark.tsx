/**
 * Logo hệ thống dùng chung mọi vị trí (header trang chủ, sidebar admin/studio,
 * trang đăng nhập, footer) — hiện ảnh thật nếu System Admin đã cấu hình qua
 * /admin/settings/branding (getEffectiveLogos()), rơi về badge chữ cái đầu
 * thương hiệu (thiết kế gốc) nếu chưa cấu hình logo.
 */
export function BrandMark({
  url,
  brandName,
  size = 32,
  rounded = 10,
  fallbackBg,
  fallbackFg = "white",
}: {
  url: string | null;
  brandName: string;
  size?: number;
  rounded?: number;
  fallbackBg: string;
  fallbackFg?: string;
}) {
  if (url) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- ảnh ngoài (Cloudinary), không qua next/image optimize
      <img src={url} alt={brandName} style={{ height: size, width: "auto", maxWidth: size * 4.5 }} className="shrink-0 object-contain" />
    );
  }
  return (
    <span
      className="font-[family-name:var(--font-heading)] flex shrink-0 items-center justify-center font-bold"
      style={{ height: size, width: size, borderRadius: rounded, background: fallbackBg, color: fallbackFg, fontSize: size * 0.42 }}
    >
      {brandName.slice(0, 1).toUpperCase()}
    </span>
  );
}
