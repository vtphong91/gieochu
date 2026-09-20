import { cache } from "react";
import { getBrand, type Brand } from "@gieochu/config/brand";
import { getPrismaClient } from "@gieochu/db";

const CONFIG_ID = "default";

/** cache() dedupe trong cùng 1 request — nhiều component cùng đọc branding không tạo N truy vấn DB thừa. */
export const getSystemBranding = cache(async function getSystemBranding() {
  const prisma = getPrismaClient();
  return prisma.systemBranding.findUnique({ where: { id: CONFIG_ID } });
});

/**
 * Tên/slogan hiệu lực thật sự dùng để hiển thị — ưu tiên DB (System Admin
 * cấu hình qua /admin/settings/branding), rơi về `getBrand()` (env) nếu
 * DB trống. Không sửa `getBrand()` trong @gieochu/config vì package đó
 * không được phụ thuộc @gieochu/db (xem comment SystemBranding trong schema).
 */
export async function getEffectiveBrand(): Promise<Brand> {
  const envBrand = getBrand();
  const branding = await getSystemBranding();
  if (!branding) return envBrand;
  return {
    name: branding.brandName || envBrand.name,
    shortName: envBrand.shortName,
    slogan: branding.brandSlogan || envBrand.slogan,
  };
}

export interface EffectiveLogos {
  logoLightUrl: string | null;
  logoDarkUrl: string | null;
  logoSquareUrl: string | null;
  logoSidebarUrl: string | null;
  logoFooterUrl: string | null;
  faviconUrl: string | null;
  ogImageUrl: string | null;
  navbarLogoHeightPx: number;
}

export async function getEffectiveLogos(): Promise<EffectiveLogos> {
  const branding = await getSystemBranding();
  return {
    logoLightUrl: branding?.logoLightUrl ?? null,
    logoDarkUrl: branding?.logoDarkUrl ?? null,
    logoSquareUrl: branding?.logoSquareUrl ?? null,
    // Sidebar/footer mặc định dùng logoDarkUrl nếu không ghi đè riêng.
    logoSidebarUrl: branding?.logoSidebarUrl || branding?.logoDarkUrl || null,
    logoFooterUrl: branding?.logoFooterUrl || branding?.logoDarkUrl || null,
    // Chưa upload favicon riêng thì dùng tạm App icon (vuông) — đúng như mô tả
    // "App icon dùng cho favicon dự phòng" ở tab Logo & Icon.
    faviconUrl: branding?.faviconUrl || branding?.logoSquareUrl || null,
    ogImageUrl: branding?.ogImageUrl ?? null,
    navbarLogoHeightPx: branding?.navbarLogoHeightPx ?? 40,
  };
}

export interface EffectiveBrandColors {
  primary: string;
  accent: string;
  secondary: string;
}

/** Giá trị mặc định — trùng khớp packages/config/src/theme.ts (nguồn gốc bảng màu). */
const DEFAULT_COLORS: EffectiveBrandColors = {
  primary: "#0F3B82",
  accent: "#D97706",
  secondary: "#16A34A",
};

export async function getEffectiveBrandColors(): Promise<EffectiveBrandColors> {
  const branding = await getSystemBranding();
  return {
    primary: branding?.primaryColorHex || DEFAULT_COLORS.primary,
    accent: branding?.accentColorHex || DEFAULT_COLORS.accent,
    secondary: branding?.secondaryColorHex || DEFAULT_COLORS.secondary,
  };
}
