import { AppError } from "@gieochu/core";
import { ensureBucketExists, getBucketStats, isValidBucketName } from "@gieochu/storage";
import { getPrismaClient } from "@gieochu/db";
import {
  createClientForProvider,
  BUCKET_PREFIX_MAX_LENGTH,
  getDecryptedSystemStorageConfig,
  normalizePublicStorageConfig,
  isValidBucketPrefix,
  type StorageProvider,
} from "./system-storage";

const DEFAULT_BUCKET_ID_LENGTH = 12;
const EXTENDED_BUCKET_ID_LENGTH = 16;

/**
 * Derives a valid S3 / MinIO bucket name for a specific tenant: `${prefix}${first N chars of tenantId}`.
 * Never truncates silently — throws AppError when the prefix or resulting name is invalid.
 */
export function deriveTenantBucketName(
  tenantId: string,
  prefix = "gc-",
  idLength = DEFAULT_BUCKET_ID_LENGTH,
): string {
  const lowerPrefix = prefix.trim().toLowerCase();
  if (!isValidBucketPrefix(lowerPrefix)) {
    throw new AppError({
      code: "INVALID_STORAGE_CONFIG",
      message: `Tiền tố bucket đang cấu hình không hợp lệ (chỉ gồm chữ thường, số, dấu gạch ngang; bắt đầu bằng chữ/số; tối đa ${BUCKET_PREFIX_MAX_LENGTH} ký tự). Vui lòng sửa trong Cài đặt lưu trữ.`,
      httpStatus: 400,
    });
  }
  const cleanPrefix = lowerPrefix.endsWith("-") ? lowerPrefix : `${lowerPrefix}-`;

  const cleanTenantId = tenantId
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .slice(0, idLength);

  const bucketName = `${cleanPrefix}${cleanTenantId}`;
  if (!isValidBucketName(bucketName)) {
    throw new AppError({
      code: "STORAGE_BUCKET_NAME_INVALID",
      message: "Không thể sinh tên bucket hợp lệ cho gian hàng.",
      httpStatus: 500,
    });
  }

  return bucketName;
}

export interface TenantBucketResult {
  bucket: string;
  provider: StorageProvider;
  isNew: boolean;
}

/**
 * Gets or provisions a dedicated storage bucket for a tenant on the active provider.
 * Idempotent: if already assigned, ensures the bucket exists on the assigned provider.
 */
export async function getOrCreateTenantBucket(tenantId: string): Promise<TenantBucketResult> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, storageBucket: true, storageProvider: true },
  });

  if (!tenant) {
    throw new AppError({ code: "TENANT_NOT_FOUND", message: "Không tìm thấy gian hàng.", httpStatus: 404 });
  }

  const sysConfig = await getDecryptedSystemStorageConfig();
  if (!sysConfig) {
    throw new AppError({ code: "STORAGE_NOT_CONFIGURED", message: "Chưa cấu hình lưu trữ hệ thống.", httpStatus: 503 });
  }

  // If already provisioned, ensure bucket exists on that provider
  if (tenant.storageBucket && tenant.storageProvider) {
    const provider = tenant.storageProvider as StorageProvider;
    try {
      const { client } = await createClientForProvider(provider);
      await ensureBucketExists(client, tenant.storageBucket);
    } catch {
      // Continue even if ensure fails (network or already exists)
    }
    return {
      bucket: tenant.storageBucket,
      provider,
      isNew: false,
    };
  }

  // Provision new dedicated bucket on the active provider
  const activeProvider = sysConfig.activeProvider;
  const prefix = activeProvider === "MINIO" ? (sysConfig.minio.bucketPrefix ?? "gc-") : "gc-";
  let bucketName = deriveTenantBucketName(tenant.id, prefix);

  // Tránh hai gian hàng dùng chung bucket: nếu trùng tên thì dùng 16 ký tự đầu của tenantId.
  const isTaken = async (name: string): Promise<boolean> =>
    (await prisma.tenant.findFirst({
      where: { id: { not: tenant.id }, storageBucket: name },
      select: { id: true },
    })) !== null;

  if (await isTaken(bucketName)) {
    bucketName = deriveTenantBucketName(tenant.id, prefix, EXTENDED_BUCKET_ID_LENGTH);
    if (await isTaken(bucketName)) {
      throw new AppError({
        code: "STORAGE_BUCKET_NAME_CONFLICT",
        message: "Tên bucket dự kiến đã được gian hàng khác sử dụng. Vui lòng liên hệ quản trị kỹ thuật.",
        httpStatus: 409,
      });
    }
  }

  const { client } = await createClientForProvider(activeProvider);
  await ensureBucketExists(client, bucketName);

  await prisma.tenant.update({
    where: { id: tenant.id },
    data: {
      storageBucket: bucketName,
      storageProvider: activeProvider,
    },
  });

  return {
    bucket: bucketName,
    provider: activeProvider,
    isNew: true,
  };
}

export interface TenantStorageMonitoringItem {
  id: string;
  tenantId: string;
  name: string;
  slug: string;
  status: string;
  storageBucket?: string | null;
  storageProvider?: string | null;
  bucket: string;
  provider: StorageProvider | string;
  hasDedicatedBucket: boolean;
  storageUsedBytes: number;
  usedBytes: number;
  planCode?: string;
  planName: string;
  planStorageMb: number;
  planStorageBytes: number;
  usedPercent: number;
  fileCount: number;
}

/**
 * Retrieves monitoring information for all tenant storage buckets.
 */
export async function getTenantStorageMonitoringList(): Promise<TenantStorageMonitoringItem[]> {
  const prisma = getPrismaClient();

  const [tenants, fileCounts] = await Promise.all([
    prisma.tenant.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        storageUsedBytes: true,
        storageBucket: true,
        storageProvider: true,
        subscription: {
          select: {
            plan: {
              select: {
                code: true,
                name: true,
                storageMb: true,
              },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.productFile.groupBy({
      by: ["tenantId"],
      _count: { id: true },
      where: { sourceKind: "FILE", removedAt: null },
    }),
  ]);

  const fileCountMap = new Map<string, number>(fileCounts.map((fc) => [fc.tenantId, fc._count.id]));

  return tenants.map((t) => {
    const planStorageMb = t.subscription?.plan?.storageMb ?? 100;
    const planStorageBytes = planStorageMb * 1024 * 1024;
    const usedPercent =
      planStorageBytes > 0
        ? Math.min(100, Math.round((t.storageUsedBytes / planStorageBytes) * 100))
        : 0;

    const fileCount = fileCountMap.get(t.id) ?? 0;

    return {
      id: t.id,
      tenantId: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      storageBucket: t.storageBucket,
      storageProvider: t.storageProvider,
      bucket: t.storageBucket ?? "Dùng chung (Shared)",
      provider: t.storageProvider ?? "CLOUDFLARE_R2",
      hasDedicatedBucket: Boolean(t.storageBucket),
      storageUsedBytes: t.storageUsedBytes,
      usedBytes: t.storageUsedBytes,
      planCode: t.subscription?.plan?.code ?? "FREE",
      planName: t.subscription?.plan?.name ?? "Gói cơ bản",
      planStorageMb,
      planStorageBytes,
      usedPercent,
      fileCount,
    };
  });
}

export interface TenantBucketInspectionResult {
  ok: boolean;
  tenantId: string;
  tenantName: string;
  bucket: string;
  provider: string;
  isDedicated: boolean;
  bucketExists: boolean;
  storageObjectsCount: number;
  storageTotalBytes: number;
  dbFilesCount: number;
  dbUsedBytes: number;
  isSynced: boolean;
  message: string;
}

/**
 * Inspects a tenant's bucket or shared storage prefix directly on the target provider (MinIO / Cloudflare R2).
 * Verifies bucket existence, real object count, and actual cumulative bytes.
 */
export async function inspectTenantBucket(tenantId: string): Promise<TenantBucketInspectionResult> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      name: true,
      storageBucket: true,
      storageProvider: true,
      storageUsedBytes: true,
    },
  });

  if (!tenant) {
    throw new AppError({ code: "TENANT_NOT_FOUND", message: "Không tìm thấy gian hàng.", httpStatus: 404 });
  }

  const sysConfigRow = await prisma.systemStorageConfig.findUnique({ where: { id: "default" } });
  if (!sysConfigRow) {
    throw new AppError({ code: "STORAGE_NOT_CONFIGURED", message: "Hệ thống lưu trữ chưa được cấu hình.", httpStatus: 503 });
  }
  const publicConfig = normalizePublicStorageConfig(sysConfigRow.publicConfig as Record<string, unknown>);

  const provider = (tenant.storageProvider as StorageProvider) || publicConfig.activeProvider;
  let bucket: string;
  let prefix: string | undefined = undefined;
  const isDedicated = Boolean(tenant.storageBucket);

  if (tenant.storageBucket) {
    bucket = tenant.storageBucket;
  } else {
    // Shared private bucket with tenant prefix
    if (provider === "MINIO") {
      const minioPrefix = publicConfig.minio.bucketPrefix || "gc-";
      bucket = `${minioPrefix}private`;
    } else {
      bucket = publicConfig.r2.bucketPrivate;
    }
    prefix = `tenants/${tenant.id}/`;
  }

  // Count active DB files
  const dbFilesCount = await prisma.productFile.count({
    where: { tenantId: tenant.id, sourceKind: "FILE", removedAt: null },
  });

  try {
    const { client } = await createClientForProvider(provider);
    const stats = await getBucketStats(client, bucket, prefix);

    if (!stats.exists) {
      return {
        ok: false,
        tenantId: tenant.id,
        tenantName: tenant.name,
        bucket,
        provider,
        isDedicated,
        bucketExists: false,
        storageObjectsCount: 0,
        storageTotalBytes: 0,
        dbFilesCount,
        dbUsedBytes: tenant.storageUsedBytes,
        isSynced: false,
        message: `Bucket "${bucket}" chưa tồn tại trên nền tảng ${provider}.`,
      };
    }

    const isSynced = stats.totalBytes === tenant.storageUsedBytes;
    const formatMb = (b: number) => (b / (1024 * 1024)).toFixed(2);

    return {
      ok: true,
      tenantId: tenant.id,
      tenantName: tenant.name,
      bucket,
      provider,
      isDedicated,
      bucketExists: true,
      storageObjectsCount: stats.totalObjects,
      storageTotalBytes: stats.totalBytes,
      dbFilesCount,
      dbUsedBytes: tenant.storageUsedBytes,
      isSynced,
      message: isSynced
        ? `Bucket "${bucket}" (${provider}) hoạt động tốt: ${stats.totalObjects} tệp vật lý (${formatMb(stats.totalBytes)} MB). Dữ liệu đã khớp với DB.`
        : `Lệch dữ liệu trên ${provider}: Storage thực tế có ${stats.totalObjects} tệp (${formatMb(stats.totalBytes)} MB), nhưng DB ghi nhận ${formatMb(tenant.storageUsedBytes)} MB.`,
    };
  } catch (error) {
    return {
      ok: false,
      tenantId: tenant.id,
      tenantName: tenant.name,
      bucket,
      provider,
      isDedicated,
      bucketExists: false,
      storageObjectsCount: 0,
      storageTotalBytes: 0,
      dbFilesCount,
      dbUsedBytes: tenant.storageUsedBytes,
      isSynced: false,
      message: `Lỗi kết nối tới nền tảng ${provider}: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

/**
 * Reconciles the tenant's recorded storageUsedBytes in PostgreSQL with the real bytes
 * currently stored on the object storage provider (MinIO / Cloudflare R2).
 */
export async function reconcileTenantStorage(tenantId: string): Promise<TenantBucketInspectionResult> {
  const result = await inspectTenantBucket(tenantId);
  if (!result.ok || !result.bucketExists) {
    return result;
  }

  const prisma = getPrismaClient();
  await prisma.tenant.update({
    where: { id: tenantId },
    data: {
      storageUsedBytes: result.storageTotalBytes,
    },
  });

  result.dbUsedBytes = result.storageTotalBytes;
  result.isSynced = true;
  result.message = `Đã cập nhật đồng bộ dung lượng DB theo thực tế: ${(result.storageTotalBytes / (1024 * 1024)).toFixed(2)} MB (${result.storageObjectsCount} tệp trên ${result.provider}).`;
  return result;
}

/**
 * Reconciles all tenants in DB against storage providers.
 */
export async function reconcileAllTenantsStorage(): Promise<{
  total: number;
  synced: number;
  failed: number;
  results: TenantBucketInspectionResult[];
}> {
  const prisma = getPrismaClient();
  const tenants = await prisma.tenant.findMany({ select: { id: true } });

  const results: TenantBucketInspectionResult[] = [];
  let synced = 0;
  let failed = 0;

  for (const t of tenants) {
    const res = await reconcileTenantStorage(t.id);
    results.push(res);
    if (res.ok) synced++;
    else failed++;
  }

  return { total: tenants.length, synced, failed, results };
}
