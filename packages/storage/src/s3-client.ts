import { S3Client } from "@aws-sdk/client-s3";

export interface S3ClientConfig {
  endpoint: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
}

/**
 * §"M5"/ADR-017: config comes from `SystemStorageConfig` (System Admin —
 * apps/web/lib/system-storage.ts), not env vars. `forcePathStyle` is
 * required for MinIO-style endpoints and harmless against R2/S3.
 */
export function createS3Client(config: S3ClientConfig): S3Client {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    forcePathStyle: true,
  });
}
