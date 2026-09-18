import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemStorageConfig } from "../../../../lib/system-storage";
import { StorageForm } from "./storage-form";

export default async function AdminStorageSettingsPage() {
  await requireAdminAccess("/admin/settings/storage");

  const config = await getSystemStorageConfig();

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Lưu trữ file</h1>
      <p className="mt-2 text-sm text-gray-500">
        Cấu hình tài khoản S3-compatible (Cloudflare R2) dùng để lưu file tài liệu (bucket private) và ảnh bìa
        (bucket public) của toàn nền tảng.
      </p>

      <div className="mt-6">
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
              ? config.lastVerifiedAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })
              : null,
          }}
        />
      </div>
    </main>
  );
}
