import { logger } from "@gieochu/core";
import { createS3Client, deleteObject, matchesDeclaredExtension, readObjectForScan } from "@gieochu/storage";
import { renderProductFileRejectedEmail } from "@gieochu/email";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withSystemJob } from "@gieochu/db";
import { getDecryptedSystemStorageConfig } from "./system-storage";
import { sendEmailNow } from "./email-dispatch";
import { getEffectiveBrand } from "./branding";

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
  // ADR-026: link tài liệu ngoài không có object, không quét (scanStatus NULL nên đã return ở trên — chặn thêm).
  if (file.sourceKind !== "FILE" || !file.objectKey) return;
  const objectKey = file.objectKey;

  const storageConfig = await getDecryptedSystemStorageConfig();
  if (!storageConfig) {
    logger.warn({ productFileId }, "file.scan: storage not configured, skipping");
    return;
  }
  let client = createS3Client(storageConfig);
  const bucket = file.storageBucket || storageConfig.bucketPrivate;

  if (file.storageProvider && file.storageProvider !== storageConfig.activeProvider) {
    try {
      const { createClientForProvider } = await import("./system-storage");
      const providerClient = await createClientForProvider(file.storageProvider as import("./system-storage").StorageProvider);
      client = providerClient.client;
    } catch {
      // fallback
    }
  }

  const { sha256, detectedExt } = await readObjectForScan(client, bucket, objectKey);
  const isValid = matchesDeclaredExtension(file.fileName, detectedExt);

  if (!isValid) {
    await deleteObject(client, bucket, objectKey);
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
    const brand = await getEffectiveBrand();
    const rendered = renderProductFileRejectedEmail({
      appName: brand.name,
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

  // ADR-063: ngay sau khi file chuyển CLEAN, sinh bản xem trước 20% + cache. Fire-and-forget — lỗi sinh
  // preview KHÔNG làm fail job scan (bản xem trước là trải nghiệm, không ảnh hưởng giao hàng/thanh toán).
  if (!file.isPreview) {
    try {
      const { generateAndStorePreview } = await import("./product-file-preview");
      await generateAndStorePreview(productFileId);
    } catch (err) {
      logger.warn({ err, productFileId }, "ADR-063: sinh preview sau file.scan thất bại — bỏ qua");
    }
  }
}
