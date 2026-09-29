export interface Brand {
  /** Full name, used in headers, <title>, email, footer. */
  name: string;
  /** Compact name, used for logo, favicon, PWA short_name, push notifications. */
  shortName: string;
  slogan: string;
}

/**
 * ADR-032 mục 2: chuỗi thương hiệu mặc định — khai báo DUY NHẤT tại đây, chỉ dùng làm
 * fallback khi System Center (bảng `SystemBranding`) chưa đặt giá trị. Không đọc env.
 * Nguồn hiệu lực là `getEffectiveBrand()` (apps/web/lib/branding.ts, async đọc DB);
 * package này không phụ thuộc @gieochu/db nên không tự đọc DB.
 */
export const DEFAULT_BRAND: Readonly<Brand> = Object.freeze({
  name: "Gieo Chữ",
  shortName: "Gieo",
  slogan: "Gieo kiến thức. Tạo giá trị.",
});

/** Phần thương hiệu lưu ở DB (`SystemBranding.brandName/brandSlogan`) — null/rỗng = dùng mặc định. */
export interface StoredBrandFields {
  brandName?: string | null;
  brandSlogan?: string | null;
}

/** Ghép giá trị DB với DEFAULT_BRAND — hàm thuần, dùng chung cho web và script/worker. */
export function resolveBrand(stored: StoredBrandFields | null | undefined): Brand {
  return {
    name: stored?.brandName?.trim() || DEFAULT_BRAND.name,
    // SystemBranding chưa có cột tên ngắn — luôn dùng mặc định.
    shortName: DEFAULT_BRAND.shortName,
    slogan: stored?.brandSlogan?.trim() || DEFAULT_BRAND.slogan,
  };
}
