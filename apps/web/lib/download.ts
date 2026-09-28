import {
  AppError,
  canDownloadEntitlement,
  createDownloadToken,
  evaluateDownloadToken,
  forbidden,
  hashOpaqueToken,
  normalizeExternalDocumentUrl,
  notFound,
} from "@gieochu/core";
import { getPrismaClient, withCustomer, withTenant, type ProductFile } from "@gieochu/db";
import { createPresignedDownload, createS3Client } from "@gieochu/storage";
import { getEnv } from "@gieochu/config";
import { requireStorageConfig } from "./product-upload";

export interface RequestDownloadResult {
  token: string;
  expiresAt: Date;
}

/**
 * ADR-026: một dòng `product_files` có giao được cho khách không — file phải CLEAN và có object key;
 * link ngoài phải còn qua allowlist hiện hành (kiểm lại ở cả 2 bước, phòng allowlist bị thu hẹp sau khi
 * link đã lưu). Trả object key (FILE) hoặc URL đã chuẩn hoá (EXTERNAL_URL); `null` nếu không giao được.
 */
type DeliverableTarget = { kind: "FILE"; objectKey: string } | { kind: "EXTERNAL_URL"; url: string };

function deliverableTarget(file: Pick<ProductFile, "sourceKind" | "scanStatus" | "objectKey" | "externalUrl">): DeliverableTarget | null {
  if (file.sourceKind === "EXTERNAL_URL") {
    const url = file.externalUrl ? normalizeExternalDocumentUrl(file.externalUrl) : null;
    return url ? { kind: "EXTERNAL_URL", url } : null;
  }
  return file.scanStatus === "CLEAN" && file.objectKey ? { kind: "FILE", objectKey: file.objectKey } : null;
}

/**
 * §"M9" step 1 of 2: validates the file/entitlement, then issues a
 * single-use 60s token — the actual bytes only ever get presigned in step 2
 * (`consumeDownloadToken`), so a leaked/retried request here never grants a
 * download by itself. ADR-026: link tài liệu ngoài đi cùng luồng (entitlement + `downloadLimit` + token).
 */
export async function requestDownload(userId: string, fileId: string): Promise<RequestDownloadResult> {
  const file = await withCustomer(userId, (tx) => tx.productFile.findUnique({ where: { id: fileId } }));
  if (!file || file.removedAt || !deliverableTarget(file)) {
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
 * `download_events` row, then returns a short-lived presigned GET URL —
 * or, for an ADR-026 external link, the (re-validated) link itself.
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

  const target = await withTenant(record.tenantId, async (tx) => {
    // Kiểm nguồn giao hàng TRƯỚC khi trừ lượt: link bị gỡ khỏi allowlist / file mất object không được ăn lượt.
    const productFile = await tx.productFile.findUniqueOrThrow({ where: { id: record.fileId } });
    const deliverable = deliverableTarget(productFile);
    if (!deliverable) {
      throw new AppError({ code: "DOWNLOAD_SOURCE_UNAVAILABLE", message: "Tài liệu này hiện không còn tải được.", httpStatus: 410 });
    }

    const incremented = await tx.$executeRaw`
      UPDATE "entitlements" SET "downloadsUsed" = "downloadsUsed" + 1
      WHERE "id" = ${record.entitlementId} AND "revokedAt" IS NULL AND ("downloadLimit" = 0 OR "downloadsUsed" < "downloadLimit")
    `;
    if (incremented === 0) {
      throw new AppError({ code: "DOWNLOAD_LIMIT_REACHED", message: "Bạn đã dùng hết lượt tải hoặc quyền tải đã bị thu hồi.", httpStatus: 403 });
    }

    await tx.downloadEvent.create({
      data: { tenantId: record.tenantId, fileId: productFile.id, entitlementId: record.entitlementId, userId: record.userId, ip },
    });
    return { deliverable, fileName: productFile.fileName };
  });

  if (target.deliverable.kind === "EXTERNAL_URL") return target.deliverable.url;

  const storageConfig = await requireStorageConfig();
  const client = createS3Client(storageConfig);
  const env = getEnv();
  return createPresignedDownload(client, {
    bucket: storageConfig.bucketPrivate,
    key: target.deliverable.objectKey,
    fileName: target.fileName,
    ttlSeconds: env.PRESIGN_DOWNLOAD_TTL_SECONDS,
  });
}
