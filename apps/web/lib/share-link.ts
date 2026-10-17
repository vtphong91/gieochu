import {
  AppError,
  generateOpaqueToken,
  hashOpaqueToken,
  hashSharePassword,
  isShareLinkUsable,
  notFound,
  verifySharePassword,
} from "@gieochu/core";
import { createPresignedDownload, createS3Client } from "@gieochu/storage";
import { getPrismaClient, withPublic, withTenant, type Prisma, type ShareLink } from "@gieochu/db";
import { assertTenantCanWrite } from "./tenant-write-guard";
import { requireStorageConfig } from "./product-upload";
import { getSystemSettings } from "./system-settings";

export interface CreateShareLinkInput {
  label: string;
  expiresAt?: Date | null;
  maxUses?: number | null;
  password?: string | null;
  /**
   * Empty/omitted = every currently-sold (non-preview, CLEAN, not-removed) file of the product.
   * ADR-026: link tài liệu ngoài (EXTERNAL_URL) KHÔNG đi qua share link — share link là kênh ẩn danh,
   * không phát URL Drive/OneDrive cho người chưa mua.
   */
  fileIds?: string[];
}

export interface CreatedShareLink {
  shareLink: ShareLink;
  token: string;
}

/** §"M9": token shown to the owner exactly once — only its hash is ever persisted. */
export async function createShareLink(tenantId: string, productId: string, input: CreateShareLinkInput): Promise<CreatedShareLink> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);

  const product = await withTenant(tenantId, (tx) => tx.product.findUnique({ where: { id: productId } }));
  if (!product) throw notFound("Không tìm thấy sản phẩm.");

  const token = generateOpaqueToken();
  const passwordHash = input.password ? await hashSharePassword(input.password) : null;

  const shareLink = await withTenant(tenantId, (tx) =>
    tx.shareLink.create({
      data: {
        tenantId,
        productId,
        tokenHash: hashOpaqueToken(token),
        label: input.label,
        passwordHash,
        fileIds: (input.fileIds && input.fileIds.length > 0 ? input.fileIds : null) as Prisma.InputJsonValue,
        maxUses: input.maxUses ?? null,
        expiresAt: input.expiresAt ?? null,
      },
    }),
  );

  return { shareLink, token };
}

export async function listShareLinks(tenantId: string, productId: string) {
  return withTenant(tenantId, (tx) => tx.shareLink.findMany({ where: { tenantId, productId }, orderBy: { createdAt: "desc" } }));
}

export async function getShareLinkDetail(tenantId: string, shareLinkId: string) {
  const shareLink = await withTenant(tenantId, (tx) =>
    tx.shareLink.findUnique({ where: { id: shareLinkId }, include: { downloadEvents: { orderBy: { createdAt: "desc" } } } }),
  );
  if (!shareLink || shareLink.tenantId !== tenantId) throw notFound("Không tìm thấy link chia sẻ.");
  return shareLink;
}

export async function revokeShareLink(tenantId: string, shareLinkId: string): Promise<void> {
  const shareLink = await withTenant(tenantId, (tx) => tx.shareLink.findUnique({ where: { id: shareLinkId } }));
  if (!shareLink || shareLink.tenantId !== tenantId) throw notFound("Không tìm thấy link chia sẻ.");
  await withTenant(tenantId, (tx) => tx.shareLink.update({ where: { id: shareLinkId }, data: { revokedAt: new Date() } }));
}

export interface ResolvedShareLink {
  shareLink: ShareLink;
  tenantName: string;
  productTitle: string;
  files: { id: string; fileName: string; sizeBytes: number }[];
  requiresPassword: boolean;
}

async function loadShareLinkFiles(tenantId: string, productId: string, fileIds: unknown) {
  const allowedIds = Array.isArray(fileIds) ? (fileIds as string[]) : null;
  return withTenant(tenantId, (tx) =>
    tx.productFile.findMany({
      where: {
        tenantId,
        productId,
        sourceKind: "FILE",
        isPreview: false,
        scanStatus: "CLEAN",
        removedAt: null,
        ...(allowedIds ? { id: { in: allowedIds } } : {}),
      },
    }),
  );
}

/**
 * §"M9" flowchart: 404 when the token simply doesn't exist, 410 once it's
 * found but revoked/expired/out-of-uses — `resolveShareLink` always fetches
 * the row (via `withPublic`, per the RLS policy allowing public read
 * regardless of status) so the caller can tell those two cases apart.
 */
export async function resolveShareLink(rawToken: string): Promise<ResolvedShareLink> {
  const tokenHash = hashOpaqueToken(rawToken);
  // withPublic only for the ShareLink row itself (RLS allows public read regardless of status,
  // by design). Product/Tenant are fetched via withTenant right after — a share link's whole
  // purpose is to work even for a DRAFT/unpublished product, which Product's own public RLS
  // branch (status='PUBLISHED' only) would otherwise hide.
  const shareLink = await withPublic((tx) => tx.shareLink.findUnique({ where: { tokenHash } }));
  if (!shareLink) throw notFound("Không tìm thấy link chia sẻ.");

  const usability = isShareLinkUsable(shareLink, new Date());
  if (!usability.usable) {
    throw new AppError({ code: `SHARE_LINK_${usability.reason}`, message: "Link không còn hiệu lực.", httpStatus: 410 });
  }

  const [product, tenant] = await Promise.all([
    withTenant(shareLink.tenantId, (tx) => tx.product.findUniqueOrThrow({ where: { id: shareLink.productId } })),
    getPrismaClient().tenant.findUniqueOrThrow({ where: { id: shareLink.tenantId } }),
  ]);
  if (tenant.status === "LOCKED") {
    throw new AppError({ code: "SHARE_LINK_TENANT_LOCKED", message: "Link không còn hiệu lực.", httpStatus: 410 });
  }

  const files = await loadShareLinkFiles(shareLink.tenantId, shareLink.productId, shareLink.fileIds);
  return {
    shareLink,
    tenantName: tenant.name,
    productTitle: product.title,
    files: files.map((f) => ({ id: f.id, fileName: f.fileName, sizeBytes: f.sizeBytes })),
    requiresPassword: Boolean(shareLink.passwordHash),
  };
}

/**
 * §"M9" flowchart: password check -> pick a file -> atomic `usedCount += 1`
 * (only while still within `maxUses`, same conditional-UPDATE pattern as
 * M8's coupon/M9's own download-token consume) -> log `download_events` ->
 * presigned GET.
 */
export async function consumeShareLinkDownload(rawToken: string, fileId: string, password: string | undefined, ip: string | undefined): Promise<string> {
  const tokenHash = hashOpaqueToken(rawToken);
  // withPublic, not a plain getPrismaClient() call — share_links is RLS-protected (§"M9" schema
  // comment); an unscoped read would be silently filtered to nothing, same bug class already
  // caught in M8's payment-process.ts.
  const shareLink = await withPublic((tx) => tx.shareLink.findUnique({ where: { tokenHash } }));
  if (!shareLink) throw new AppError({ code: "SHARE_LINK_NOT_FOUND", message: "Không tìm thấy link chia sẻ.", httpStatus: 404 });

  const usability = isShareLinkUsable(shareLink, new Date());
  if (!usability.usable) {
    throw new AppError({ code: `SHARE_LINK_${usability.reason}`, message: "Link không còn hiệu lực.", httpStatus: 410 });
  }

  if (shareLink.passwordHash) {
    if (!password || !(await verifySharePassword(shareLink.passwordHash, password))) {
      throw new AppError({ code: "SHARE_LINK_WRONG_PASSWORD", message: "Sai mật khẩu.", httpStatus: 403 });
    }
  }

  const file = await withTenant(shareLink.tenantId, async (tx) => {
    const productFile = await tx.productFile.findFirst({
      where: { id: fileId, productId: shareLink.productId, sourceKind: "FILE", isPreview: false, scanStatus: "CLEAN", removedAt: null },
    });
    if (!productFile || !productFile.objectKey) throw notFound("Không tìm thấy file.");

    const allowedIds = Array.isArray(shareLink.fileIds) ? (shareLink.fileIds as string[]) : null;
    if (allowedIds && !allowedIds.includes(fileId)) throw notFound("Không tìm thấy file.");

    const claimed = await tx.shareLink.updateMany({
      where: { id: shareLink.id, revokedAt: null, OR: [{ maxUses: null }, { usedCount: { lt: shareLink.maxUses ?? undefined } }] },
      data: { usedCount: { increment: 1 } },
    });
    if (claimed.count === 0) {
      throw new AppError({ code: "SHARE_LINK_LIMIT_REACHED", message: "Link không còn hiệu lực.", httpStatus: 410 });
    }

    await tx.downloadEvent.create({
      data: { tenantId: shareLink.tenantId, fileId: productFile.id, shareLinkId: shareLink.id, ip },
    });
    return {
      objectKey: productFile.objectKey,
      fileName: productFile.fileName,
      storageBucket: productFile.storageBucket,
      storageProvider: productFile.storageProvider,
    };
  });

  const storageConfig = await requireStorageConfig();
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

  const settings = await getSystemSettings();
  return createPresignedDownload(client, {
    bucket,
    key: file.objectKey,
    fileName: file.fileName,
    // ADR-032: ≤600 do validate; createPresignedDownload kẹp lại ≤600 lần nữa phòng DB sai (§7.6).
    ttlSeconds: settings.presignDownloadTtlSeconds,
  });
}
