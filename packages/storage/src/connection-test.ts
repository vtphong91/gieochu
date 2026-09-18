import { HeadBucketCommand, type S3Client } from "@aws-sdk/client-s3";

export interface TestConnectionResult {
  ok: boolean;
  message?: string;
}

/**
 * "Kiểm tra kết nối" for the System Admin storage config page — confirms the
 * credentials can actually reach both buckets (HeadBucket needs no read/list
 * permission beyond bucket-level access, so it fails fast on bad
 * endpoint/region/keys without touching any object).
 */
export async function testS3Connection(
  client: S3Client,
  buckets: { bucketPrivate: string; bucketPublic: string },
): Promise<TestConnectionResult> {
  try {
    await client.send(new HeadBucketCommand({ Bucket: buckets.bucketPrivate }));
    await client.send(new HeadBucketCommand({ Bucket: buckets.bucketPublic }));
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Không kết nối được tới storage." };
  }
}
