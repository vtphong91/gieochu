import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemCloudinaryConfig } from "../../../../lib/system-cloudinary";
import { AdminPageHeader } from "../../_ui/kit";
import { CloudinaryForm } from "./cloudinary-form";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

export default async function AdminCloudinarySettingsPage() {
  await requireAdminAccess("/admin/settings/cloudinary");

  const config = await getSystemCloudinaryConfig();

  return (
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Cloudinary Upload" subtitle="Tài khoản Cloudinary dùng để upload ảnh trong Landing Page CMS." />

      {/* Full width theo khung app (quy tắc 2026-10-25) — thay SettingsGrid 2 cột. */}
      <div className="mt-6">
        <CloudinaryForm
          initial={{
            cloudName: config?.publicConfig.cloudName ?? "",
            uploadFolder: config?.publicConfig.uploadFolder ?? "gieochu",
            isEnabled: config?.isEnabled ?? false,
            maskedApiKey: config?.maskedSecrets.apiKey,
            maskedApiSecret: config?.maskedSecrets.apiSecret,
            lastVerifiedAt: config?.lastVerifiedAt
              ? config.lastVerifiedAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE })
              : null,
          }}
        />
      </div>
    </div>
  );
}
