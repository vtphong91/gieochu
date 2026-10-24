import {
  CreateBucketCommand,
  HeadBucketCommand,
  ListObjectsV2Command,
  type ListObjectsV2CommandOutput,
  type S3Client,
} from "@aws-sdk/client-s3";

/**
 * Validates S3 / MinIO bucket naming rules:
 * - Length: 3 to 63 characters
 * - Characters: lowercase letters, numbers, hyphens (-), and periods (.)
 * - Must start and end with a lowercase letter or number
 * - Must not contain two adjacent periods
 */
const BUCKET_NAME_REGEX = /^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/;

export function isValidBucketName(name: string): boolean {
  if (!name || name.length < 3 || name.length > 63) return false;
  if (name.includes("..")) return false;
  return BUCKET_NAME_REGEX.test(name);
}

export interface ResolveMinioEndpointParams {
  host: string;
  port?: number;
  useSSL?: boolean;
}

/**
 * Builds a clean S3 endpoint URL for MinIO from host, port, and useSSL flag.
 * Strips leading protocols and trailing slashes from the host.
 */
export function resolveMinioEndpoint(params: ResolveMinioEndpointParams): string {
  let cleanHost = params.host.trim();
  // Strip protocol if user pasted http:// or https://
  cleanHost = cleanHost.replace(/^https?:\/\//i, "");
  // Strip trailing slashes or path
  cleanHost = cleanHost.replace(/\/.*$/, "");

  const protocol = params.useSSL ? "https" : "http";
  if (params.port !== undefined && params.port > 0) {
    // Only omit port if it's default for protocol
    const isDefaultPort = (params.useSSL && params.port === 443) || (!params.useSSL && params.port === 80);
    if (!isDefaultPort) {
      return `${protocol}://${cleanHost}:${params.port}`;
    }
  }

  return `${protocol}://${cleanHost}`;
}

/**
 * Checks if a bucket exists and is accessible by the S3Client.
 */
export async function headBucket(client: S3Client, bucket: string): Promise<boolean> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Creates a bucket on the S3 / MinIO provider.
 * Ignores BucketAlreadyOwnedByYou and BucketAlreadyExists errors.
 */
export async function createBucket(client: S3Client, bucket: string): Promise<void> {
  if (!isValidBucketName(bucket)) {
    throw new Error(`Tên bucket không hợp lệ: "${bucket}". Tên bucket phải từ 3-63 ký tự [a-z0-9.-].`);
  }

  try {
    await client.send(new CreateBucketCommand({ Bucket: bucket }));
  } catch (error: unknown) {
    const errCode = (error as { name?: string; Code?: string })?.name ?? (error as { Code?: string })?.Code;
    if (errCode === "BucketAlreadyOwnedByYou" || errCode === "BucketAlreadyExists") {
      return;
    }
    throw error;
  }
}

/**
 * Ensures a bucket exists, creating it if it does not.
 */
export async function ensureBucketExists(client: S3Client, bucket: string): Promise<void> {
  const exists = await headBucket(client, bucket);
  if (!exists) {
    await createBucket(client, bucket);
  }
}

export interface BucketStats {
  exists: boolean;
  totalObjects: number;
  totalBytes: number;
}

/**
 * Calculates total object count and cumulative bytes in a bucket (optionally scoped to a prefix).
 */
export async function getBucketStats(
  client: S3Client,
  bucket: string,
  prefix?: string,
): Promise<BucketStats> {
  const exists = await headBucket(client, bucket);
  if (!exists) {
    return { exists: false, totalObjects: 0, totalBytes: 0 };
  }

  let totalObjects = 0;
  let totalBytes = 0;
  let continuationToken: string | undefined = undefined;

  do {
    const res: ListObjectsV2CommandOutput = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix || undefined,
        ContinuationToken: continuationToken,
      }),
    );
    if (res.Contents) {
      for (const item of res.Contents) {
        totalObjects += 1;
        totalBytes += item.Size || 0;
      }
    }
    continuationToken = res.NextContinuationToken;
  } while (continuationToken);

  return { exists: true, totalObjects, totalBytes };
}
