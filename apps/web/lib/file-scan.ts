import { logger } from "@gieochu/core";
import { createS3Client, deleteObject, matchesDeclaredExtension, readObjectForScan } from "@gieochu/storage";
import { renderProductFileRejectedEmail } from "@gieochu/email";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withSystemJob } from "@gieochu/db";
import { getDecryptedSystemStorageConfig } from "./system-storage";
import { sendEmailNow } from "./email-dispatch";

/**
 * §"M5" file.scan job — run after `complete` confirms the object exists.
 * Reads the object once (hashing + magic-byte sniffing in the same pass, see
 * packages/storage/src/scan.ts), then either marks it CLEAN or rejects it.
 *
 * ClamAV integration: `CLAMAV_HOST` has no client implementation yet (no
 * virus-scan library is installed) — per the spec's own suggested fallback,
 * every file that passes the format check is marked CLEAN with a logged
 * warning, whether or not CLAMAV_HOST is set (see docs/BACKLOG.md; a formal
 * ADR lands once a real ClamAV client is wired in).
 */
export async function runFileScan(productFileId: string): Promise<void> {
  const prisma = getPrismaClient();
  const env = getEnv();

  const file = await withSystemJob((tx) => tx.productFile.findUniqueOrThrow({ where: { id: productFileId } }));
  if (file.scanStatus !== "PENDING") return; // already processed — idempotent

  const storageConfig = await getDecryptedSystemStorageConfig();
  if (!storageConfig) {
    logger.warn({ productFileId }, "file.scan: storage not configured, skipping");
    return;
  }
  const client = createS3Client(storageConfig);

  const { sha256, detectedExt } = await readObjectForScan(client, storageConfig.bucketPrivate, file.objectKey);
  const isValid = matchesDeclaredExtension(file.fileName, detectedExt);

  if (!isValid) {
    await deleteObject(client, storageConfig.bucketPrivate, file.objectKey);
    await withSystemJob((tx) => tx.productFile.update({ where: { id: productFileId }, data: { scanStatus: "REJECTED" } }));

    const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: file.tenantId } });
    await prisma.tenant.update({
      where: { id: file.tenantId },
      data: { storageUsedBytes: { decrement: file.sizeBytes } },
    });

    const [owner, product] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: tenant.ownerId } }),
      withSystemJob((tx) => tx.product.findUniqueOrThrow({ where: { id: file.productId } })),
    ]);
    const rendered = renderProductFileRejectedEmail({
      appName: env.APP_NAME,
      productTitle: product.title,
      fileName: file.fileName,
      productUrl: `${env.APP_URL}/studio/${tenant.slug}/products/${product.id}`,
    });
    const sent = await sendEmailNow({ type: "product_file_rejected", to: owner.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
    if (!sent.ok) {
      logger.warn({ productFileId, email: owner.email, error: sent.error }, "file.scan: gửi email báo owner thất bại");
    }

    logger.warn({ productFileId, fileName: file.fileName, detectedExt }, "file.scan: rejected (magic bytes don't match extension)");
    return;
  }

  if (env.CLAMAV_HOST) {
    logger.warn({ productFileId }, "file.scan: CLAMAV_HOST is set but no ClamAV client is implemented yet — falling back to CLEAN");
  }

  await withSystemJob((tx) => tx.productFile.update({ where: { id: productFileId }, data: { scanStatus: "CLEAN", sha256 } }));
}
