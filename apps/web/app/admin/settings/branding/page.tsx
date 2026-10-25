import { DEFAULT_BRAND } from "@gieochu/config/brand";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemBranding } from "../../../../lib/branding";
import { AdminPageHeader } from "../../_ui/kit";
import { BrandingEditor, ResetBrandingButton } from "./branding-editor";

export default async function AdminBrandingSettingsPage() {
  await requireAdminAccess("/admin/settings/branding");

  const branding = await getSystemBranding();
  // ADR-032: giá trị dự phòng khi ô tên/slogan để trống là DEFAULT_BRAND (không còn env).
  const defaultBrand = DEFAULT_BRAND;

  return (
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Nhận diện thương hiệu"
        subtitle="Logo, favicon, tên, slogan và màu sắc áp dụng cho toàn bộ hệ thống — System Center, Studio và trang khách hàng."
        action={<ResetBrandingButton />}
      />

      <BrandingEditor
        initial={{
          logoLightUrl: branding?.logoLightUrl ?? "",
          logoDarkUrl: branding?.logoDarkUrl ?? "",
          logoSquareUrl: branding?.logoSquareUrl ?? "",
          logoSidebarUrl: branding?.logoSidebarUrl ?? "",
          logoFooterUrl: branding?.logoFooterUrl ?? "",
          faviconUrl: branding?.faviconUrl ?? "",
          ogImageUrl: branding?.ogImageUrl ?? "",
          brandName: branding?.brandName ?? "",
          brandSlogan: branding?.brandSlogan ?? "",
          defaultBrandName: defaultBrand.name,
          defaultBrandSlogan: defaultBrand.slogan,
          navbarLogoHeightPx: branding?.navbarLogoHeightPx ?? 40,
          primaryColorHex: branding?.primaryColorHex ?? "",
          accentColorHex: branding?.accentColorHex ?? "",
          secondaryColorHex: branding?.secondaryColorHex ?? "",
        }}
      />
    </div>
  );
}
