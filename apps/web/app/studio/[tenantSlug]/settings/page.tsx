import Link from "next/link";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { BrandingForm } from "./branding-form";
import { SlugForm } from "./slug-form";
import { AdminPageHeader, SettingsGrid } from "../../../admin/_ui/kit";

interface TenantBranding {
  primaryColor?: string;
  accentColor?: string;
  socialLinks?: Partial<Record<"facebook" | "youtube" | "tiktok" | "zalo" | "website", string>>;
}

export default async function StudioSettingsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/settings`);

  const branding = (tenant.branding as TenantBranding | null) ?? {};
  const socialLinks = branding.socialLinks ?? {};

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Cài đặt trang" subtitle="Thương hiệu, đường dẫn và các cấu hình khác của trang bạn." />

      <SettingsGrid>
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
      </SettingsGrid>

      <p className="mt-6 text-sm">
        <Link href={`/studio/${tenant.slug}/settings/payments`} className="font-medium" style={{ color: "#0F3B82" }}>
          Cấu hình thanh toán →
        </Link>
      </p>
    </main>
  );
}
