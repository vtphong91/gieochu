"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError } from "@gieochu/core";
import { requireRole } from "../../../../lib/session";
import {
  saveSystemStorageConfig,
  testSystemStorageConnection,
  testRawStorageConnection,
  type RawStorageTestInput,
  type StorageProvider,
} from "../../../../lib/system-storage";
import {
  getOrCreateTenantBucket,
  getTenantStorageMonitoringList,
  inspectTenantBucket,
  reconcileTenantStorage,
  reconcileAllTenantsStorage,
  type TenantBucketInspectionResult,
  type TenantStorageMonitoringItem,
} from "../../../../lib/tenant-storage";
import {
  runStorageSync,
  type StorageSyncResult,
  type SyncDirection,
} from "../../../../lib/storage-sync";

export interface StorageActionState {
  error?: string;
  success?: boolean;
  testResult?: { ok: boolean; message?: string };
  syncResult?: StorageSyncResult;
  monitoringData?: TenantStorageMonitoringItem[];
}

const legacyStorageSchema = z.object({
  endpoint: z.string().trim().url().optional(),
  region: z.string().trim().optional(),
  bucketPrivate: z.string().trim().optional(),
  bucketPublic: z.string().trim().optional(),
  publicBaseUrl: z.string().trim().optional(),
});

export async function saveStorageConfigAction(
  _prevState: StorageActionState,
  formData: FormData,
): Promise<StorageActionState> {
  await requireRole("SYSTEM_ADMIN");

  const activeProviderInput = String(formData.get("activeProvider") ?? "").trim();
  const activeProvider: StorageProvider =
    activeProviderInput === "MINIO" ? "MINIO" : "CLOUDFLARE_R2";

  // R2 fields
  const r2Endpoint = String(formData.get("r2Endpoint") || formData.get("endpoint") || "").trim();
  const r2Region = String(formData.get("r2Region") || formData.get("region") || "auto").trim();
  const r2BucketPrivate = String(formData.get("r2BucketPrivate") || formData.get("bucketPrivate") || "").trim();
  const r2BucketPublic = String(formData.get("r2BucketPublic") || formData.get("bucketPublic") || "").trim();
  const r2PublicBaseUrl = String(formData.get("r2PublicBaseUrl") || formData.get("publicBaseUrl") || "").trim();
  const r2AccessKeyId = String(formData.get("r2AccessKeyId") || (activeProvider === "CLOUDFLARE_R2" ? formData.get("accessKeyId") : "") || "").trim();
  const r2SecretAccessKey = String(formData.get("r2SecretAccessKey") || (activeProvider === "CLOUDFLARE_R2" ? formData.get("secretAccessKey") : "") || "").trim();

  // MinIO fields
  const minioHost = String(formData.get("minioHost") || "").trim();
  const minioPortStr = formData.get("minioPort");
  const minioPort = minioPortStr ? Number(minioPortStr) : 9000;
  const minioUseSSL = formData.get("minioUseSSL") === "on" || formData.get("minioUseSSL") === "true";
  const minioRegion = String(formData.get("minioRegion") || "us-east-1").trim();
  const minioBucketPrefix = String(formData.get("minioBucketPrefix") || "gc-").trim();
  const minioMaxUploadMbStr = formData.get("minioMaxUploadMb");
  const minioMaxUploadMb = minioMaxUploadMbStr ? Number(minioMaxUploadMbStr) : 500;
  const minioPublicBaseUrl = String(formData.get("minioPublicBaseUrl") || "").trim();
  const minioAccessKeyId = String(formData.get("minioAccessKeyId") || (activeProvider === "MINIO" ? formData.get("accessKeyId") : "") || "").trim();
  const minioSecretAccessKey = String(formData.get("minioSecretAccessKey") || (activeProvider === "MINIO" ? formData.get("secretAccessKey") : "") || "").trim();

  // Legacy single form validation fallback
  if (activeProvider === "CLOUDFLARE_R2" && r2Endpoint) {
    const parsed = legacyStorageSchema.safeParse({
      endpoint: r2Endpoint,
      region: r2Region,
      bucketPrivate: r2BucketPrivate,
      bucketPublic: r2BucketPublic,
      publicBaseUrl: r2PublicBaseUrl || undefined,
    });
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dữ liệu cấu hình R2 không hợp lệ." };
    }
  }

  try {
    await saveSystemStorageConfig({
      isEnabled: formData.get("isEnabled") === "on" || formData.get("isEnabled") === "true",
      activeProvider,
      r2: {
        endpoint: r2Endpoint,
        region: r2Region,
        bucketPrivate: r2BucketPrivate,
        bucketPublic: r2BucketPublic,
        publicBaseUrl: r2PublicBaseUrl || undefined,
      },
      minio: {
        host: minioHost,
        port: minioPort,
        useSSL: minioUseSSL,
        region: minioRegion,
        bucketPrefix: minioBucketPrefix,
        maxUploadMb: minioMaxUploadMb,
        publicBaseUrl: minioPublicBaseUrl || undefined,
      },
      secrets: {
        r2: {
          accessKeyId: r2AccessKeyId,
          secretAccessKey: r2SecretAccessKey,
        },
        minio: {
          accessKeyId: minioAccessKeyId,
          secretAccessKey: minioSecretAccessKey,
        },
      },
    });
  } catch (error) {
    if (error instanceof AppError) return { error: error.message };
    return { error: error instanceof Error ? error.message : "Lỗi lưu cấu hình storage." };
  }

  revalidatePath("/admin/settings/storage");
  revalidatePath("/admin/settings/storage/buckets");
  revalidatePath("/admin/settings/storage/sync");
  return { success: true };
}

export async function testStorageConnectionAction(
  inputParam?: FormData | StorageProvider | "ALL" | RawStorageTestInput,
): Promise<StorageActionState> {
  await requireRole("SYSTEM_ADMIN");

  let result: { ok: boolean; message?: string };

  if (inputParam instanceof FormData) {
    const rawProvider = String(
      inputParam.get("testingProvider") ||
      inputParam.get("activeProvider") ||
      "CLOUDFLARE_R2",
    ).trim();
    const provider: StorageProvider = rawProvider === "MINIO" ? "MINIO" : "CLOUDFLARE_R2";

    const minioPortStr = inputParam.get("minioPort");
    const minioPort = minioPortStr ? Number(minioPortStr) : undefined;
    const minioUseSSL =
      inputParam.get("minioUseSSL") === "on" || inputParam.get("minioUseSSL") === "true";

    result = await testRawStorageConnection({
      provider,
      // MinIO
      minioHost: String(inputParam.get("minioHost") || "").trim() || undefined,
      minioPort,
      minioUseSSL,
      minioRegion: String(inputParam.get("minioRegion") || "").trim() || undefined,
      minioBucketPrefix: String(inputParam.get("minioBucketPrefix") || "").trim() || undefined,
      minioAccessKeyId: String(inputParam.get("minioAccessKeyId") || "").trim() || undefined,
      minioSecretAccessKey: String(inputParam.get("minioSecretAccessKey") || "").trim() || undefined,
      // R2
      r2Endpoint: String(inputParam.get("r2Endpoint") || inputParam.get("endpoint") || "").trim() || undefined,
      r2Region: String(inputParam.get("r2Region") || inputParam.get("region") || "").trim() || undefined,
      r2BucketPrivate: String(inputParam.get("r2BucketPrivate") || inputParam.get("bucketPrivate") || "").trim() || undefined,
      r2BucketPublic: String(inputParam.get("r2BucketPublic") || inputParam.get("bucketPublic") || "").trim() || undefined,
      r2AccessKeyId: String(inputParam.get("r2AccessKeyId") || inputParam.get("accessKeyId") || "").trim() || undefined,
      r2SecretAccessKey: String(inputParam.get("r2SecretAccessKey") || inputParam.get("secretAccessKey") || "").trim() || undefined,
      // Fallback
      accessKeyId: String(inputParam.get("accessKeyId") || "").trim() || undefined,
      secretAccessKey: String(inputParam.get("secretAccessKey") || "").trim() || undefined,
    });
  } else if (typeof inputParam === "object" && inputParam !== null && "provider" in inputParam) {
    result = await testRawStorageConnection(inputParam as RawStorageTestInput);
  } else {
    result = await testSystemStorageConnection(inputParam as StorageProvider | "ALL" | undefined);
  }

  revalidatePath("/admin/settings/storage");
  revalidatePath("/admin/settings/storage/buckets");
  return { testResult: result };
}

export async function provisionTenantBucketAction(tenantId: string): Promise<{ ok: boolean; message: string; bucketName?: string }> {
  await requireRole("SYSTEM_ADMIN");
  if (!tenantId?.trim()) {
    return { ok: false, message: "Thiếu ID gian hàng." };
  }

  try {
    const result = await getOrCreateTenantBucket(tenantId.trim());
    revalidatePath("/admin/settings/storage/buckets");
    return {
      ok: true,
      message: `Khởi tạo bucket "${result.bucket}" thành công trên nền tảng ${result.provider}.`,
      bucketName: result.bucket,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Không thể khởi tạo bucket cho gian hàng.",
    };
  }
}

export async function triggerStorageSyncAction(
  direction: SyncDirection,
  tenantId?: string,
): Promise<StorageActionState> {
  await requireRole("SYSTEM_ADMIN");
  if (direction !== "R2_TO_MINIO" && direction !== "MINIO_TO_R2") {
    return { error: "Chiều đồng bộ không hợp lệ." };
  }

  try {
    const result = await runStorageSync({
      direction,
      tenantId: tenantId?.trim() || undefined,
    });
    revalidatePath("/admin/settings/storage/buckets");
    revalidatePath("/admin/settings/storage/sync");
    return { success: true, syncResult: result };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Lỗi trong quá trình đồng bộ dữ liệu." };
  }
}

export async function executeStorageSyncAction(
  direction: SyncDirection,
  tenantId?: string,
): Promise<{ ok: boolean; totalFiles: number; message: string; syncResult?: StorageSyncResult }> {
  await requireRole("SYSTEM_ADMIN");
  if (direction !== "R2_TO_MINIO" && direction !== "MINIO_TO_R2") {
    return { ok: false, totalFiles: 0, message: "Chiều đồng bộ không hợp lệ." };
  }

  try {
    const result = await runStorageSync({
      direction,
      tenantId: tenantId?.trim() || undefined,
    });
    revalidatePath("/admin/settings/storage/buckets");
    revalidatePath("/admin/settings/storage/sync");
    return {
      ok: true,
      totalFiles: result.totalFiles,
      message: `Đã đồng bộ ${result.syncedFiles}/${result.totalFiles} tệp tin.`,
      syncResult: result,
    };
  } catch (error) {
    return {
      ok: false,
      totalFiles: 0,
      message: error instanceof Error ? error.message : "Lỗi khi đồng bộ dữ liệu.",
    };
  }
}

export async function getStorageMonitoringDataAction(): Promise<TenantStorageMonitoringItem[]> {
  await requireRole("SYSTEM_ADMIN");
  return getTenantStorageMonitoringList();
}

export async function inspectTenantBucketAction(
  tenantId: string,
): Promise<TenantBucketInspectionResult> {
  await requireRole("SYSTEM_ADMIN");
  if (!tenantId?.trim()) {
    return {
      ok: false,
      tenantId: "",
      tenantName: "",
      bucket: "",
      provider: "",
      isDedicated: false,
      bucketExists: false,
      storageObjectsCount: 0,
      storageTotalBytes: 0,
      dbFilesCount: 0,
      dbUsedBytes: 0,
      isSynced: false,
      message: "Thiếu ID gian hàng.",
    };
  }

  try {
    return await inspectTenantBucket(tenantId.trim());
  } catch (error) {
    return {
      ok: false,
      tenantId: tenantId.trim(),
      tenantName: "",
      bucket: "",
      provider: "",
      isDedicated: false,
      bucketExists: false,
      storageObjectsCount: 0,
      storageTotalBytes: 0,
      dbFilesCount: 0,
      dbUsedBytes: 0,
      isSynced: false,
      message: error instanceof Error ? error.message : "Lỗi khi kiểm tra bucket.",
    };
  }
}

export async function reconcileTenantStorageAction(
  tenantId: string,
): Promise<TenantBucketInspectionResult> {
  await requireRole("SYSTEM_ADMIN");
  if (!tenantId?.trim()) {
    return {
      ok: false,
      tenantId: "",
      tenantName: "",
      bucket: "",
      provider: "",
      isDedicated: false,
      bucketExists: false,
      storageObjectsCount: 0,
      storageTotalBytes: 0,
      dbFilesCount: 0,
      dbUsedBytes: 0,
      isSynced: false,
      message: "Thiếu ID gian hàng.",
    };
  }

  try {
    const result = await reconcileTenantStorage(tenantId.trim());
    revalidatePath("/admin/settings/storage");
    revalidatePath("/admin/settings/storage/buckets");
    return result;
  } catch (error) {
    return {
      ok: false,
      tenantId: tenantId.trim(),
      tenantName: "",
      bucket: "",
      provider: "",
      isDedicated: false,
      bucketExists: false,
      storageObjectsCount: 0,
      storageTotalBytes: 0,
      dbFilesCount: 0,
      dbUsedBytes: 0,
      isSynced: false,
      message: error instanceof Error ? error.message : "Lỗi khi đồng bộ dung lượng.",
    };
  }
}

export async function reconcileAllTenantsStorageAction(): Promise<{
  ok: boolean;
  message: string;
  total: number;
  synced: number;
  failed: number;
}> {
  await requireRole("SYSTEM_ADMIN");
  try {
    const res = await reconcileAllTenantsStorage();
    revalidatePath("/admin/settings/storage");
    revalidatePath("/admin/settings/storage/buckets");
    return {
      ok: true,
      message: `Đã quét và đồng bộ ${res.synced}/${res.total} gian hàng (${res.failed} lỗi).`,
      total: res.total,
      synced: res.synced,
      failed: res.failed,
    };
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Lỗi đồng bộ dữ liệu toàn bộ gian hàng.",
      total: 0,
      synced: 0,
      failed: 0,
    };
  }
}

