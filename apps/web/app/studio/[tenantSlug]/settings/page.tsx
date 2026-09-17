import { requireTenantMember } from "../../../../lib/tenant";
import { BrandingForm } from "./branding-form";
import { SlugForm } from "./slug-form";

interface TenantBranding {
  primaryColor?: string;
  accentColor?: string;
  socialLinks?: Partial<Record<"facebook" | "youtube" | "tiktok" | "zalo" | "website", string>>;
}

export default async function StudioSettingsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMember(tenantSlug);

  const branding = (tenant.branding as TenantBranding | null) ?? {};
  const socialLinks = branding.socialLinks ?? {};

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Cài đặt trang</h1>

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
    </main>
  );
}
