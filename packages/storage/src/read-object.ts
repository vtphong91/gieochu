import { Buffer } from "node:buffer";
import type { Readable } from "node:stream";
import { GetObjectCommand, type S3Client } from "@aws-sdk/client-s3";

/**
 * ADR-063: tải nguyên object về Buffer để trích xuất bản xem trước. Nhỏ (≤ ~50 MB cho tài liệu bán).
 * Khác `readObjectForScan` ở chỗ không hash, không sniff — chỉ gom byte.
 */
export async function readObjectAsBuffer(client: S3Client, bucket: string, key: string): Promise<Buffer> {
  const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = result.Body as Readable | undefined;
  if (!body) throw new Error(`Empty body for ${bucket}/${key}`);
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as Uint8Array));
  }
  return Buffer.concat(chunks);
}
