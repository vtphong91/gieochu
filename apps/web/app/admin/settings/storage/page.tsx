import Link from "next/link";
import { logger } from "@gieochu/core";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSystemStorageConfig } from "../../../../lib/system-storage";
import { getTenantStorageMonitoringList } from "../../../../lib/tenant-storage";
import { AdminPageHeader } from "../../_ui/kit";
import { IconDatabase, IconLayers, IconRefresh } from "../../_ui/icons";
import { StorageForm, type StorageFormInitial } from "./storage-form";
import { BucketMonitoring, type BucketMonitoringTenant } from "./bucket-monitoring";
import { StorageSyncPanel } from "./storage-sync-panel";

export const metadata = {
  title: "Quản trị Lưu trữ (Storage Management) | System Admin",
};

interface PageProps {
  searchParams: Promise<{ tab?: string }>;
}

export default async function AdminStorageSettingsPage({ searchParams }: PageProps) {
  await requireAdminAccess("/admin/settings/storage");

  const { tab } = await searchParams;
  const currentTab = tab === "buckets" ? "buckets" : tab === "sync" ? "sync" : "config";

  const config = await getSystemStorageConfig();

  // Load danh sách tenant từ hàm giám sát lưu trữ chuyên dụng (đếm đúng số tệp ProductFile hợp lệ)
  let tenants: BucketMonitoringTenant[] = [];

  try {
    const monitoringList = await getTenantStorageMonitoringList();
    tenants = monitoringList.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      storageBucket: t.storageBucket,
      storageProvider: t.storageProvider,
      storageUsedBytes: t.storageUsedBytes,
      planCode: t.planCode,
      planName: t.planName,
      planStorageMb: t.planStorageMb,
      fileCount: t.fileCount, // Đếm chính xác số tệp tài liệu trong ProductFile
      status: t.status,
    }));
  } catch (err) {
    logger.warn({ err }, "AdminStorageSettingsPage: không thể tải danh sách tenant storage monitoring");
  }

  // Parse enriched config or map legacy config
  const rawPublicConfig = config?.publicConfig as unknown as {
    endpoint?: string;
    region?: string;
    bucketPrivate?: string;
    bucketPublic?: string;
    publicBaseUrl?: string;
    activeProvider?: "CLOUDFLARE_R2" | "MINIO";
    r2?: {
      endpoint: string;
      region: string;
      bucketPrivate: string;
      bucketPublic: string;
      publicBaseUrl: string;
      maxUploadMb?: number;
    };
    minio?: {
      host: string;
      port: number;
      useSSL: boolean;
      region: string;
      bucketPrefix: string;
      publicBaseUrl: string;
      maxUploadMb?: number;
    };
  } | null;

  const storageInitial: StorageFormInitial = {
    activeProvider: rawPublicConfig?.activeProvider ?? "CLOUDFLARE_R2",
    isEnabled: config?.isEnabled ?? false,
    endpoint: rawPublicConfig?.endpoint ?? "",
    region: rawPublicConfig?.region ?? "auto",
    bucketPrivate: rawPublicConfig?.bucketPrivate ?? "",
    bucketPublic: rawPublicConfig?.bucketPublic ?? "",
    publicBaseUrl: rawPublicConfig?.publicBaseUrl ?? "",
    maskedAccessKeyId: config?.maskedSecrets.accessKeyId,
    maskedSecretAccessKey: config?.maskedSecrets.secretAccessKey,
    lastVerifiedAt: config?.lastVerifiedAt
      ? config.lastVerifiedAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE })
      : null,
    r2: rawPublicConfig?.r2,
    minio: rawPublicConfig?.minio,
  };

  return (
    <main className="px-5 py-8 lg:px-8 space-y-6">
      <AdminPageHeader
        title="Quản trị Lưu trữ (Storage Management)"
        subtitle="Hạ tầng lưu trữ đa nền tảng Cloudflare R2 & MinIO, Dedicated Bucket cho gian hàng và Công cụ di chuyển đồng bộ dữ liệu (ADR-038)."
      />

      {/* Tabs Phân khu trực quan */}
      <div className="flex border-b border-gray-200 gap-2 sm:gap-4 overflow-x-auto">
        <Link
          href="/admin/settings/storage?tab=config"
          className={`pb-3.5 px-3 text-sm font-semibold inline-flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            currentTab === "config"
              ? "border-[#0F3B82] text-[#0F3B82]"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <IconDatabase className="w-4 h-4" />
          <span>Cấu hình Lưu trữ (Dual-Provider)</span>
        </Link>

        <Link
          href="/admin/settings/storage?tab=buckets"
          className={`pb-3.5 px-3 text-sm font-semibold inline-flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            currentTab === "buckets"
              ? "border-[#0F3B82] text-[#0F3B82]"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <IconLayers className="w-4 h-4" />
          <span>Giám sát Dung lượng Bucket ({tenants.length})</span>
        </Link>

        <Link
          href="/admin/settings/storage?tab=sync"
          className={`pb-3.5 px-3 text-sm font-semibold inline-flex items-center gap-2 border-b-2 whitespace-nowrap transition-colors ${
            currentTab === "sync"
              ? "border-[#0F3B82] text-[#0F3B82]"
              : "border-transparent text-gray-500 hover:text-gray-800"
          }`}
        >
          <IconRefresh className="w-4 h-4" />
          <span>Công cụ Đồng bộ Dữ liệu</span>
        </Link>
      </div>

      {/* Nội dung Tab */}
      <div className="pt-2">
        {currentTab === "config" && <StorageForm initial={storageInitial} />}
        {currentTab === "buckets" && <BucketMonitoring initialTenants={tenants} />}
        {currentTab === "sync" && <StorageSyncPanel tenants={tenants} />}
      </div>
    </main>
  );
}
