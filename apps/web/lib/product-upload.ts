import { randomUUID } from "node:crypto";
import { AppError, logger } from "@gieochu/core";
import {
  buildProductFileKey,
  completeMultipartUpload,
  createPresignedUpload,
  createS3Client,
  deleteObject,
  headObject,
  isAllowedExtension,
  isProductObjectKeyFor,
  type PresignedUpload,
  type ProductObjectKeyKind,
} from "@gieochu/storage";
import { getPrismaClient, withTenant, type ProductFile } from "@gieochu/db";
import { assertPlanLimit } from "./plan-limits";
import { getDecryptedSystemStorageConfig, createClientForProvider, type StorageProvider } from "./system-storage";
import { getOrCreateTenantBucket } from "./tenant-storage";
import { getSystemSettings } from "./system-settings";
import { enqueueFileScan } from "./jobs";

export async function requireStorageConfig() {
  const config = await getDecryptedSystemStorageConfig();
  if (!config) {
    throw new AppError({ code: "STORAGE_NOT_CONFIGURED", message: "Chưa cấu hình lưu trữ file.", httpStatus: 503 });
  }
  return config;
}

/**
 * The object key comes back from the client on `complete` — it must be one
 * `buildProductFileKey` could have issued for THIS tenant/product, otherwise a
 * tenant could register another tenant's (leaked via download URL) key. Pure
 * check, runs before any storage call.
 */
function assertOwnObjectKey(objectKey: string, tenantId: string, productId: string, kind: ProductObjectKeyKind): void {
  const fileName = objectKey.split("/").pop() ?? "";
  const extOk = kind === "cover" ? COVER_IMAGE_EXTENSIONS.has(fileName.split(".").pop()?.toLowerCase() ?? "") : isAllowedExtension(fileName);
  if (!isProductObjectKeyFor(objectKey, tenantId, productId, kind) || !extOk) {
    throw new AppError({ code: "INVALID_OBJECT_KEY", message: "Khoá file tải lên không hợp lệ cho sản phẩm này.", httpStatus: 400 });
  }
}

/** Best-effort cleanup of an upload we refuse to register — failure is logged, never masks the original error. */
async function discardUploadedObject(client: ReturnType<typeof createS3Client>, bucket: string, objectKey: string): Promise<void> {
  try {
    await deleteObject(client, bucket, objectKey);
  } catch (error) {
    logger.warn({ objectKey, err: error }, "product-upload: không xoá được object bị từ chối");
  }
}

export interface PresignUploadInput {
  fileName: string;
  sizeBytes: number;
  mimeType: string;
  isPreview: boolean;
}

export interface PresignUploadResult {
  objectKey: string;
  upload: PresignedUpload;
}

/**
 * §"M5" sequence diagram: requireTenantMember + format check are the
 * caller's job (Server Action); this validates size against the plan and
 * creates the presigned upload. Nothing is written to `product_files` yet —
 * that only happens once `completeProductFileUpload` confirms the object
 * actually landed in the bucket.
 */
export async function presignProductFileUpload(tenantId: string, productId: string, input: PresignUploadInput): Promise<PresignUploadResult> {
  if (!isAllowedExtension(input.fileName)) {
    throw new AppError({ code: "UNSUPPORTED_FILE_TYPE", message: "Định dạng file không được hỗ trợ.", httpStatus: 400 });
  }

  const product = await withTenant(tenantId, (tx) => tx.product.findUnique({ where: { id: productId } }));
  if (!product) {
    throw new AppError({ code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy sản phẩm.", httpStatus: 404 });
  }

  await assertPlanLimit(tenantId, "fileSize", input.sizeBytes);
  await assertPlanLimit(tenantId, "storage", input.sizeBytes);

  const storageConfig = await requireStorageConfig();
  const settings = await getSystemSettings();
  const objectKey = buildProductFileKey(tenantId, productId, randomUUID(), input.fileName);

  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, storageBucket: true, storageProvider: true },
  });

  let bucket = storageConfig.bucketPrivate;
  let client = createS3Client(storageConfig);

  if (storageConfig.activeProvider === "MINIO" || tenant?.storageBucket) {
    const tenantBucket = await getOrCreateTenantBucket(tenantId);
    bucket = tenantBucket.bucket;
    const providerClient = await createClientForProvider(tenantBucket.provider);
    client = providerClient.client;
  }

  const upload = await createPresignedUpload(client, {
    bucket,
    key: objectKey,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    ttlSeconds: settings.presignUploadTtlSeconds,
  });

  return { objectKey, upload };
}

export interface CompleteUploadInput {
  objectKey: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  isPreview: boolean;
  /** Present only when the upload used the multipart path. */
  uploadId?: string;
  parts?: { partNumber: number; eTag: string }[];
}

/**
 * HeadObject confirms the object actually exists (and matches the claimed
 * size) before trusting anything the client says — §7.5 "không tin số
 * tiền/trạng thái từ client" applies just as much to upload metadata.
 */
export async function completeProductFileUpload(tenantId: string, productId: string, input: CompleteUploadInput): Promise<ProductFile> {
  assertOwnObjectKey(input.objectKey, tenantId, productId, "file");

  const product = await withTenant(tenantId, (tx) => tx.product.findUnique({ where: { id: productId } }));
  if (!product) {
    throw new AppError({ code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy sản phẩm.", httpStatus: 404 });
  }

  // `product_files.objectKey` is @unique — check up front so a repeated
  // complete gets a clean 409 (and never touches/deletes the registered object).
  const existing = await withTenant(tenantId, (tx) => tx.productFile.findUnique({ where: { objectKey: input.objectKey }, select: { id: true } }));
  if (existing) {
    throw new AppError({ code: "UPLOAD_ALREADY_COMPLETED", message: "File này đã được ghi nhận trước đó.", httpStatus: 409 });
  }

  const storageConfig = await requireStorageConfig();
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, storageBucket: true, storageProvider: true },
  });

  let bucket = storageConfig.bucketPrivate;
  let provider: StorageProvider = "CLOUDFLARE_R2";
  let client = createS3Client(storageConfig);

  if (storageConfig.activeProvider === "MINIO" || tenant?.storageBucket) {
    const tenantBucket = await getOrCreateTenantBucket(tenantId);
    bucket = tenantBucket.bucket;
    provider = tenantBucket.provider;
    const providerClient = await createClientForProvider(tenantBucket.provider);
    client = providerClient.client;
  }

  if (input.uploadId && input.parts) {
    await completeMultipartUpload(client, {
      bucket,
      key: input.objectKey,
      uploadId: input.uploadId,
      parts: input.parts,
    });
  }

  const head = await headObject(client, bucket, input.objectKey);
  if (!head) {
    throw new AppError({ code: "UPLOAD_NOT_FOUND", message: "Không tìm thấy file vừa tải lên.", httpStatus: 400 });
  }
  if (head.sizeBytes !== input.sizeBytes) {
    await discardUploadedObject(client, bucket, input.objectKey);
    throw new AppError({ code: "UPLOAD_SIZE_MISMATCH", message: "Dung lượng file tải lên không khớp với khai báo.", httpStatus: 400 });
  }

  // Presign checked the plan against the size the client CLAIMED — re-check
  // with the real size from HeadObject so "presign small, upload big" fails.
  const realSizeBytes = head.sizeBytes;
  try {
    await assertPlanLimit(tenantId, "fileSize", realSizeBytes);
    await assertPlanLimit(tenantId, "storage", realSizeBytes);
  } catch (error) {
    await discardUploadedObject(client, bucket, input.objectKey);
    throw error;
  }

  const file = await withTenant(tenantId, (tx) =>
    tx.productFile.create({
      data: {
        productId,
        tenantId,
        objectKey: input.objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: realSizeBytes,
        storageBucket: bucket,
        storageProvider: provider,
        isPreview: input.isPreview,
        scanStatus: "PENDING",
      },
    }),
  );

  await prisma.tenant.update({ where: { id: tenantId }, data: { storageUsedBytes: { increment: realSizeBytes } } });

  await enqueueFileScan({ productFileId: file.id });

  return file;
}

const COVER_IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);
const MAX_COVER_IMAGE_BYTES = 5 * 1024 * 1024;

export interface PresignCoverImageResult {
  objectKey: string;
  upload: PresignedUpload;
}

/**
 * Cover images live in the PUBLIC bucket (direct URL, no presign needed to
 * display — §"M5" plan) and aren't tracked in `product_files` or counted
 * against `storageUsedBytes` (that quota is for the sellable documents, not
 * presentational assets). No file.scan either — publicly displayed images
 * only, same trust level as a tenant's own logo/cover (M4).
 */
export async function presignCoverImageUpload(tenantId: string, productId: string, input: { fileName: string; sizeBytes: number; mimeType: string }): Promise<PresignCoverImageResult> {
  const ext = input.fileName.split(".").pop()?.toLowerCase();
  if (!ext || !COVER_IMAGE_EXTENSIONS.has(ext)) {
    throw new AppError({ code: "UNSUPPORTED_FILE_TYPE", message: "Ảnh bìa chỉ chấp nhận PNG/JPG/JPEG.", httpStatus: 400 });
  }
  if (input.sizeBytes > MAX_COVER_IMAGE_BYTES) {
    throw new AppError({ code: "FILE_TOO_LARGE", message: "Ảnh bìa tối đa 5MB.", httpStatus: 400 });
  }

  const product = await withTenant(tenantId, (tx) => tx.product.findUnique({ where: { id: productId } }));
  if (!product) {
    throw new AppError({ code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy sản phẩm.", httpStatus: 404 });
  }

  const storageConfig = await requireStorageConfig();
  const settings = await getSystemSettings();
  const objectKey = buildProductFileKey(tenantId, productId, "cover", input.fileName);
  const client = createS3Client(storageConfig);

  const upload = await createPresignedUpload(client, {
    bucket: storageConfig.bucketPublic,
    key: objectKey,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    ttlSeconds: settings.presignUploadTtlSeconds,
  });

  return { objectKey, upload };
}

export async function completeCoverImageUpload(tenantId: string, productId: string, objectKey: string): Promise<void> {
  assertOwnObjectKey(objectKey, tenantId, productId, "cover");

  const product = await withTenant(tenantId, (tx) => tx.product.findUnique({ where: { id: productId } }));
  if (!product) {
    throw new AppError({ code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy sản phẩm.", httpStatus: 404 });
  }

  const storageConfig = await requireStorageConfig();
  const client = createS3Client(storageConfig);
  const head = await headObject(client, storageConfig.bucketPublic, objectKey);
  if (!head) {
    throw new AppError({ code: "UPLOAD_NOT_FOUND", message: "Không tìm thấy ảnh vừa tải lên.", httpStatus: 400 });
  }

  await withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { coverImageKey: objectKey } }));
}
