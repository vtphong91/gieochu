import {
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  UploadPartCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/** §"M5": "file > 50MB dùng multipart". */
const MULTIPART_THRESHOLD_BYTES = 50 * 1024 * 1024;
const MULTIPART_PART_SIZE_BYTES = 10 * 1024 * 1024;

export interface PresignedSinglePut {
  mode: "single";
  url: string;
}

export interface PresignedMultipartPart {
  partNumber: number;
  url: string;
}

export interface PresignedMultipartUpload {
  mode: "multipart";
  uploadId: string;
  /** The client must slice the file into chunks of exactly this size (the last part may be smaller) to match what was presigned. */
  partSizeBytes: number;
  parts: PresignedMultipartPart[];
}

export type PresignedUpload = PresignedSinglePut | PresignedMultipartUpload;

export interface CreatePresignedUploadArgs {
  bucket: string;
  key: string;
  sizeBytes: number;
  mimeType: string;
  ttlSeconds: number;
}

/**
 * A single PUT presign is pure request-signing (no network call). A
 * multipart upload does make one real call (CreateMultipartUploadCommand,
 * to obtain the UploadId) before each part's UploadPart URL can be signed.
 */
export async function createPresignedUpload(client: S3Client, args: CreatePresignedUploadArgs): Promise<PresignedUpload> {
  if (args.sizeBytes <= MULTIPART_THRESHOLD_BYTES) {
    const command = new PutObjectCommand({ Bucket: args.bucket, Key: args.key, ContentType: args.mimeType });
    const url = await getSignedUrl(client, command, { expiresIn: args.ttlSeconds });
    return { mode: "single", url };
  }

  const created = await client.send(new CreateMultipartUploadCommand({ Bucket: args.bucket, Key: args.key, ContentType: args.mimeType }));
  const uploadId = created.UploadId;
  if (!uploadId) {
    throw new Error("S3 did not return an UploadId for the multipart upload");
  }

  const partCount = Math.ceil(args.sizeBytes / MULTIPART_PART_SIZE_BYTES);
  const parts: PresignedMultipartPart[] = [];
  for (let partNumber = 1; partNumber <= partCount; partNumber += 1) {
    const command = new UploadPartCommand({ Bucket: args.bucket, Key: args.key, UploadId: uploadId, PartNumber: partNumber });
    const url = await getSignedUrl(client, command, { expiresIn: args.ttlSeconds });
    parts.push({ partNumber, url });
  }
  return { mode: "multipart", uploadId, partSizeBytes: MULTIPART_PART_SIZE_BYTES, parts };
}

export async function completeMultipartUpload(
  client: S3Client,
  args: { bucket: string; key: string; uploadId: string; parts: { partNumber: number; eTag: string }[] },
): Promise<void> {
  await client.send(
    new CompleteMultipartUploadCommand({
      Bucket: args.bucket,
      Key: args.key,
      UploadId: args.uploadId,
      MultipartUpload: { Parts: args.parts.map((p) => ({ PartNumber: p.partNumber, ETag: p.eTag })) },
    }),
  );
}

export interface HeadObjectResult {
  sizeBytes: number;
  contentType?: string;
}

/** Returns null (not throws) when the object doesn't exist — the caller treats that as "upload not confirmed". */
export async function headObject(client: S3Client, bucket: string, key: string): Promise<HeadObjectResult | null> {
  try {
    const result = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
    return { sizeBytes: result.ContentLength ?? 0, contentType: result.ContentType };
  } catch {
    return null;
  }
}

export async function deleteObject(client: S3Client, bucket: string, key: string): Promise<void> {
  await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

/** §7.6: presigned GET, short TTL, forces a download (never inline-render) via Content-Disposition. */
export async function createPresignedDownload(
  client: S3Client,
  args: { bucket: string; key: string; fileName: string; ttlSeconds: number },
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: args.bucket,
    Key: args.key,
    ResponseContentDisposition: `attachment; filename="${args.fileName}"`,
  });
  return getSignedUrl(client, command, { expiresIn: args.ttlSeconds });
}
