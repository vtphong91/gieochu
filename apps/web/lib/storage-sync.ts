import { copyObjectBetweenClients, ensureBucketExists } from "@gieochu/storage";
import { getPrismaClient, Prisma } from "@gieochu/db";
import {
  createClientForProvider,
  getDecryptedSystemStorageConfig,
  type StorageProvider,
} from "./system-storage";
import { deriveTenantBucketName } from "./tenant-storage";

export type SyncDirection = "R2_TO_MINIO" | "MINIO_TO_R2";

export interface RunStorageSyncOptions {
  direction: SyncDirection;
  tenantId?: string;
  limit?: number;
}

export interface StorageSyncErrorDetail {
  fileId: string;
  objectKey: string;
  fileName: string;
  error: string;
}

export interface StorageSyncResult {
  direction: SyncDirection;
  totalFiles: number;
  syncedFiles: number;
  failedFiles: number;
  totalBytes: number;
  errors: StorageSyncErrorDetail[];
  startedAt: Date;
  completedAt: Date;
}

/**
 * Runs stream-copy data synchronization between Cloudflare R2 and MinIO without
 * buffering objects to web server memory or local disk.
 */
export async function runStorageSync(options: RunStorageSyncOptions): Promise<StorageSyncResult> {
  const startedAt = new Date();
  const prisma = getPrismaClient();

  const sourceProvider: StorageProvider = options.direction === "R2_TO_MINIO" ? "CLOUDFLARE_R2" : "MINIO";
  const targetProvider: StorageProvider = options.direction === "R2_TO_MINIO" ? "MINIO" : "CLOUDFLARE_R2";

  const sysConfig = await getDecryptedSystemStorageConfig();
  if (!sysConfig) {
    throw new Error("Hệ thống lưu trữ chưa được cấu hình hoặc chưa bật.");
  }

  const { client: sourceClient } = await createClientForProvider(sourceProvider);
  const { client: targetClient } = await createClientForProvider(targetProvider);

  // Filter product_files that need syncing
  const whereClause: Prisma.ProductFileWhereInput = {
    sourceKind: "FILE",
    objectKey: { not: null },
    removedAt: null,
  };

  if (options.tenantId) {
    whereClause.tenantId = options.tenantId;
  }

  if (options.direction === "R2_TO_MINIO") {
    whereClause.OR = [
      { storageProvider: "CLOUDFLARE_R2" },
      { storageProvider: null },
    ];
  } else {
    whereClause.storageProvider = "MINIO";
  }

  const files = await prisma.productFile.findMany({
    where: whereClause,
    take: options.limit || 500,
    select: {
      id: true,
      tenantId: true,
      productId: true,
      objectKey: true,
      fileName: true,
      mimeType: true,
      sizeBytes: true,
      storageBucket: true,
      storageProvider: true,
    },
  });

  const tenantIds = [...new Set(files.map((f) => f.tenantId))];
  const tenants = await prisma.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, storageBucket: true, storageProvider: true },
  });
  const tenantMap = new Map(tenants.map((t) => [t.id, t]));

  let syncedFiles = 0;
  let failedFiles = 0;
  let totalBytes = 0;
  const errors: StorageSyncErrorDetail[] = [];

  for (const file of files) {
    if (!file.objectKey) continue;

    try {
      const tenant = tenantMap.get(file.tenantId);

      // Determine source bucket
      let sourceBucket = file.storageBucket;
      if (!sourceBucket) {
        if (sourceProvider === "CLOUDFLARE_R2") {
          sourceBucket = sysConfig.r2.bucketPrivate;
        } else {
          const prefix = sysConfig.minio.bucketPrefix || "gc-";
          sourceBucket = `${prefix}private`;
        }
      }

      // Determine target bucket
      let targetBucket: string;
      if (targetProvider === "MINIO") {
        const prefix = sysConfig.minio.bucketPrefix || "gc-";
        targetBucket = tenant?.storageBucket || deriveTenantBucketName(file.tenantId, prefix);
      } else {
        // R2 target
        targetBucket = tenant?.storageBucket || sysConfig.r2.bucketPrivate;
      }

      // Ensure target bucket exists
      await ensureBucketExists(targetClient, targetBucket);

      // Stream copy directly between providers
      const copyResult = await copyObjectBetweenClients({
        sourceClient,
        sourceBucket,
        sourceKey: file.objectKey,
        targetClient,
        targetBucket,
        targetKey: file.objectKey,
        contentType: file.mimeType || undefined,
      });

      // Update DB record
      await prisma.productFile.update({
        where: { id: file.id },
        data: {
          storageBucket: targetBucket,
          storageProvider: targetProvider,
        },
      });

      // If tenant does not have a bucket record yet, update tenant
      if (!tenant?.storageBucket || tenant.storageProvider !== targetProvider) {
        await prisma.tenant.update({
          where: { id: file.tenantId },
          data: {
            storageBucket: targetBucket,
            storageProvider: targetProvider,
          },
        });
        if (tenant) {
          tenant.storageBucket = targetBucket;
          tenant.storageProvider = targetProvider;
        }
      }

      syncedFiles += 1;
      totalBytes += copyResult.sizeBytes;
    } catch (err) {
      failedFiles += 1;
      errors.push({
        fileId: file.id,
        objectKey: file.objectKey,
        fileName: file.fileName,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return {
    direction: options.direction,
    totalFiles: files.length,
    syncedFiles,
    failedFiles,
    totalBytes,
    errors,
    startedAt,
    completedAt: new Date(),
  };
}
