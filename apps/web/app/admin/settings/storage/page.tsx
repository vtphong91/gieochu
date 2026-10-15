import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemStorageConfig } from "../../../../lib/system-storage";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { StorageForm } from "./storage-form";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";

export default async function AdminStorageSettingsPage() {
  await requireAdminAccess("/admin/settings/storage");

  const config = await getSystemStorageConfig();

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Lưu trữ file"
        subtitle="Cấu hình tài khoản S3-compatible (Cloudflare R2) dùng để lưu file tài liệu và ảnh bìa của toàn nền tảng."
      />

      <SettingsGrid>
        <StorageForm
          initial={{
            endpoint: config?.publicConfig.endpoint ?? "",
            region: config?.publicConfig.region ?? "auto",
            bucketPrivate: config?.publicConfig.bucketPrivate ?? "",
            bucketPublic: config?.publicConfig.bucketPublic ?? "",
            publicBaseUrl: config?.publicConfig.publicBaseUrl ?? "",
            isEnabled: config?.isEnabled ?? false,
            maskedAccessKeyId: config?.maskedSecrets.accessKeyId,
            maskedSecretAccessKey: config?.maskedSecrets.secretAccessKey,
            lastVerifiedAt: config?.lastVerifiedAt
              ? config.lastVerifiedAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE })
              : null,
          }}
        />
      </SettingsGrid>
    </main>
  );
}
