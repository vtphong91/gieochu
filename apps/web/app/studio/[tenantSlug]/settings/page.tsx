import type { Metadata } from "next";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { BrandingForm } from "./branding-form";
import { SlugForm } from "./slug-form";
import { AdminPageHeader } from "../../../admin/_ui/kit";
import { ModuleTabs } from "../../../admin/_ui/module-tabs";
import { STUDIO_SETTINGS_TABS_LABEL, studioSettingsTabs } from "./_ui/settings-tabs";

interface TenantBranding {
  primaryColor?: string;
  accentColor?: string;
  socialLinks?: Partial<Record<"facebook" | "youtube" | "tiktok" | "zalo" | "website", string>>;
}

/** ADR-058: title riêng theo tab (task 2.7). */
export const metadata: Metadata = { title: "Thông tin & thương hiệu — Cài đặt" };

export default async function StudioSettingsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/settings`);

  const branding = (tenant.branding as TenantBranding | null) ?? {};
  const socialLinks = branding.socialLinks ?? {};

  return (
    // ADR-058: tab "Thông tin & thương hiệu" của nhóm Cài đặt — h1 là tên nhóm. Wrapper <div>: layout Studio đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Cài đặt" subtitle="Thông tin & thương hiệu — tên, giới thiệu, màu, mạng xã hội và đường dẫn trang của bạn." />
      <ModuleTabs label={STUDIO_SETTINGS_TABS_LABEL} items={studioSettingsTabs(tenant.slug)} current={`/studio/${tenant.slug}/settings`} />

      {/* Chủ dự án (2026-10-25): nội dung full width theo khung Studio, xếp 1 cột. */}
      <div className="mt-6 space-y-6">
        <BrandingForm
          tenantSlug={tenant.slug}
          initial={{
            name: tenant.name,
            bio: tenant.bio ?? "",
            primaryColor: branding.primaryColor ?? "#2563eb",
            accentColor: branding.accentColor ?? "#16a34a",
            facebook: socialLinks.facebook ?? "",
            youtube: socialLinks.youtube ?? "",
            tiktok: socialLinks.tiktok ?? "",
            zalo: socialLinks.zalo ?? "",
            website: socialLinks.website ?? "",
          }}
        />

        <SlugForm tenantSlug={tenant.slug} />
      </div>
    </div>
  );
}
