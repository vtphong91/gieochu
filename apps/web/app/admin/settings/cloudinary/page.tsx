import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemCloudinaryConfig } from "../../../../lib/system-cloudinary";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { CloudinaryForm } from "./cloudinary-form";

export default async function AdminCloudinarySettingsPage() {
  await requireAdminAccess("/admin/settings/cloudinary");

  const config = await getSystemCloudinaryConfig();

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Cloudinary Upload" subtitle="Tài khoản Cloudinary dùng để upload ảnh trong Landing Page CMS." />

      <SettingsGrid>
        <CloudinaryForm
          initial={{
            cloudName: config?.publicConfig.cloudName ?? "",
            uploadFolder: config?.publicConfig.uploadFolder ?? "gieochu",
            isEnabled: config?.isEnabled ?? false,
            maskedApiKey: config?.maskedSecrets.apiKey,
            maskedApiSecret: config?.maskedSecrets.apiSecret,
            lastVerifiedAt: config?.lastVerifiedAt
              ? config.lastVerifiedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
              : null,
          }}
        />
      </SettingsGrid>
    </main>
  );
}
