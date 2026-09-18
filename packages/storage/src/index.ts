// §"M5 — Sản phẩm và File tài liệu". Presign/upload/file.scan (the actual
// upload flow) are still deferred — see docs/BACKLOG.md — but the S3 client
// and a connection test now exist for System Admin's storage config page
// (apps/web/app/admin/settings/storage), built via ADR-017.
export { ALLOWED_EXTENSIONS, getDeclaredExtension, isAllowedExtension, matchesDeclaredExtension } from "./file-format";
export type { AllowedExtension } from "./file-format";

export { buildProductFileKey, sanitizeFileName } from "./object-key";

export { createS3Client } from "./s3-client";
export type { S3ClientConfig } from "./s3-client";

export { testS3Connection } from "./connection-test";
export type { TestConnectionResult } from "./connection-test";
