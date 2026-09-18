import {
  AppError,
  canDownloadEntitlement,
  createDownloadToken,
  evaluateDownloadToken,
  forbidden,
  hashOpaqueToken,
  notFound,
} from "@gieochu/core";
import { getPrismaClient, withCustomer, withTenant } from "@gieochu/db";
import { createPresignedDownload, createS3Client } from "@gieochu/storage";
import { getEnv } from "@gieochu/config";
import { requireStorageConfig } from "./product-upload";

export interface RequestDownloadResult {
  token: string;
  expiresAt: Date;
}

/**
 * §"M9" step 1 of 2: validates the file/entitlement, then issues a
 * single-use 60s token — the actual bytes only ever get presigned in step 2
 * (`consumeDownloadToken`), so a leaked/retried request here never grants a
 * download by itself.
 */
export async function requestDownload(userId: string, fileId: string): Promise<RequestDownloadResult> {
  const file = await withCustomer(userId, (tx) => tx.productFile.findUnique({ where: { id: fileId } }));
  if (!file || file.removedAt || file.scanStatus !== "CLEAN") {
    throw notFound("Không tìm thấy file.");
  }

  const entitlement = await withCustomer(userId, (tx) =>
    tx.entitlement.findFirst({ where: { userId, productId: file.productId, revokedAt: null } }),
  );
  if (!entitlement) {
    throw forbidden("Bạn chưa sở hữu tài liệu này.");
  }

  const guard = canDownloadEntitlement(entitlement);
  if (!guard.allowed) {
    throw new AppError({
      code: guard.reason === "REVOKED" ? "ENTITLEMENT_REVOKED" : "DOWNLOAD_LIMIT_REACHED",
      message: guard.reason === "REVOKED" ? "Quyền tải đã bị thu hồi." : "Bạn đã dùng hết lượt tải.",
      httpStatus: 403,
    });
  }

  const now = new Date();
  const { token, tokenHash, expiresAt } = createDownloadToken(now);
  await getPrismaClient().downloadToken.create({
    data: { tokenHash, entitlementId: entitlement.id, fileId: file.id, userId, tenantId: entitlement.tenantId, expiresAt },
  });

  return { token, expiresAt };
}

/**
 * §"M9" step 2: consumes the token (atomic — a retried/duplicated GET can
 * never succeed twice), atomically increments `downloadsUsed` only if the
 * entitlement is still eligible at this exact moment (re-checked here, not
 * just at request time — matches the coupon-race pattern from M8), logs a
 * `download_events` row, then returns a short-lived presigned GET URL.
 */
export async function consumeDownloadToken(rawToken: string, ip: string | undefined): Promise<string> {
  const tokenHash = hashOpaqueToken(rawToken);
  const prisma = getPrismaClient();
  const record = await prisma.downloadToken.findUnique({ where: { tokenHash } });
  if (!record) {
    throw new AppError({ code: "TOKEN_INVALID", message: "Link tải không hợp lệ.", httpStatus: 410 });
  }

  const now = new Date();
  if (evaluateDownloadToken(record, now) !== "valid") {
    throw new AppError({ code: "TOKEN_INVALID", message: "Link tải đã hết hạn hoặc đã được dùng.", httpStatus: 410 });
  }

  // Atomic claim (re-checks usedAt/expiresAt again, not just the read above) — the actual
  // single-use guarantee under concurrent GETs of the same URL, same pattern as M8's coupon claim.
  const claimed = await prisma.downloadToken.updateMany({
    where: { tokenHash, usedAt: null, expiresAt: { gt: now } },
    data: { usedAt: now },
  });
  if (claimed.count === 0) {
    throw new AppError({ code: "TOKEN_INVALID", message: "Link tải đã hết hạn hoặc đã được dùng.", httpStatus: 410 });
  }

  const file = await withTenant(record.tenantId, async (tx) => {
    const incremented = await tx.$executeRaw`
      UPDATE "entitlements" SET "downloadsUsed" = "downloadsUsed" + 1
      WHERE "id" = ${record.entitlementId} AND "revokedAt" IS NULL AND ("downloadLimit" = 0 OR "downloadsUsed" < "downloadLimit")
    `;
    if (incremented === 0) {
      throw new AppError({ code: "DOWNLOAD_LIMIT_REACHED", message: "Bạn đã dùng hết lượt tải hoặc quyền tải đã bị thu hồi.", httpStatus: 403 });
    }

    const productFile = await tx.productFile.findUniqueOrThrow({ where: { id: record.fileId } });
    await tx.downloadEvent.create({
      data: { tenantId: record.tenantId, fileId: productFile.id, entitlementId: record.entitlementId, userId: record.userId, ip },
    });
    return productFile;
  });

  const storageConfig = await requireStorageConfig();
  const client = createS3Client(storageConfig);
  const env = getEnv();
  return createPresignedDownload(client, {
    bucket: storageConfig.bucketPrivate,
    key: file.objectKey,
    fileName: file.fileName,
    ttlSeconds: env.PRESIGN_DOWNLOAD_TTL_SECONDS,
  });
}
