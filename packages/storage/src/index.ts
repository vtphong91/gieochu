// §"M5 — Sản phẩm và File tài liệu".
export { ALLOWED_EXTENSIONS, getDeclaredExtension, isAllowedExtension, matchesDeclaredExtension } from "./file-format";
export type { AllowedExtension } from "./file-format";

export { buildProductFileKey, sanitizeFileName } from "./object-key";

export { createS3Client } from "./s3-client";
export type { S3ClientConfig } from "./s3-client";

export { testS3Connection } from "./connection-test";
export type { TestConnectionResult } from "./connection-test";

export {
  completeMultipartUpload,
  createPresignedDownload,
  createPresignedUpload,
  deleteObject,
  headObject,
} from "./presign";
export type {
  CreatePresignedUploadArgs,
  HeadObjectResult,
  PresignedMultipartPart,
  PresignedMultipartUpload,
  PresignedSinglePut,
  PresignedUpload,
} from "./presign";

export { readObjectForScan } from "./scan";
export type { ScanResult } from "./scan";
