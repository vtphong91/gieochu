import { randomUUID } from "node:crypto";
import { AppError } from "@gieochu/core";
import {
  buildProductFileKey,
  completeMultipartUpload,
  createPresignedUpload,
  createS3Client,
  headObject,
  isAllowedExtension,
  type PresignedUpload,
} from "@gieochu/storage";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withTenant, type ProductFile } from "@gieochu/db";
import { assertPlanLimit } from "./plan-limits";
import { getDecryptedSystemStorageConfig } from "./system-storage";
import { enqueueFileScan } from "./jobs";

export async function requireStorageConfig() {
  const config = await getDecryptedSystemStorageConfig();
  if (!config) {
    throw new AppError({ code: "STORAGE_NOT_CONFIGURED", message: "Chưa cấu hình lưu trữ file.", httpStatus: 503 });
  }
  return config;
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
  const env = getEnv();
  const objectKey = buildProductFileKey(tenantId, productId, randomUUID(), input.fileName);
  const client = createS3Client(storageConfig);

  const upload = await createPresignedUpload(client, {
    bucket: storageConfig.bucketPrivate,
    key: objectKey,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    ttlSeconds: env.PRESIGN_UPLOAD_TTL_SECONDS,
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
  const product = await withTenant(tenantId, (tx) => tx.product.findUnique({ where: { id: productId } }));
  if (!product) {
    throw new AppError({ code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy sản phẩm.", httpStatus: 404 });
  }

  const storageConfig = await requireStorageConfig();
  const client = createS3Client(storageConfig);

  if (input.uploadId && input.parts) {
    await completeMultipartUpload(client, {
      bucket: storageConfig.bucketPrivate,
      key: input.objectKey,
      uploadId: input.uploadId,
      parts: input.parts,
    });
  }

  const head = await headObject(client, storageConfig.bucketPrivate, input.objectKey);
  if (!head || head.sizeBytes !== input.sizeBytes) {
    throw new AppError({ code: "UPLOAD_NOT_FOUND", message: "Không tìm thấy file vừa tải lên.", httpStatus: 400 });
  }

  const file = await withTenant(tenantId, (tx) =>
    tx.productFile.create({
      data: {
        productId,
        tenantId,
        objectKey: input.objectKey,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        isPreview: input.isPreview,
        scanStatus: "PENDING",
      },
    }),
  );

  const prisma = getPrismaClient();
  await prisma.tenant.update({ where: { id: tenantId }, data: { storageUsedBytes: { increment: input.sizeBytes } } });

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
  const env = getEnv();
  const objectKey = buildProductFileKey(tenantId, productId, "cover", input.fileName);
  const client = createS3Client(storageConfig);

  const upload = await createPresignedUpload(client, {
    bucket: storageConfig.bucketPublic,
    key: objectKey,
    sizeBytes: input.sizeBytes,
    mimeType: input.mimeType,
    ttlSeconds: env.PRESIGN_UPLOAD_TTL_SECONDS,
  });

  return { objectKey, upload };
}

export async function completeCoverImageUpload(tenantId: string, productId: string, objectKey: string): Promise<void> {
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
