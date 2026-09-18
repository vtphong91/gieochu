import { createHash } from "node:crypto";
import type { Readable } from "node:stream";
import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";
import { fileTypeFromBuffer } from "file-type";

/** file-type needs only the first few KB to identify a format from magic bytes. */
const SNIFF_BYTES = 4100;

export interface ScanResult {
  sha256: string;
  detectedExt: string | undefined;
}

/**
 * §"M5" file.scan job: streams the object once — hashing incrementally
 * (never buffers the whole file in memory, even for a 200MB upload) while
 * keeping only the first few KB to run magic-byte detection on.
 */
export async function readObjectForScan(client: S3Client, bucket: string, key: string): Promise<ScanResult> {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = result.Body as Readable;

  const hash = createHash("sha256");
  let sniff: Buffer | undefined;
  for await (const chunk of body) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array);
    if (!sniff) sniff = buf.subarray(0, SNIFF_BYTES);
    hash.update(buf);
  }

  const detected = sniff ? await fileTypeFromBuffer(sniff) : undefined;
  return { sha256: hash.digest("hex"), detectedExt: detected?.ext };
}
