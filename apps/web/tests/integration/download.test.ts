import { afterAll, describe, expect, it, vi } from "vitest";
import { generateOrderCode } from "@gieochu/core";
import { getPrismaClient, withPublic, withSystemJob, withTenant } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import { requestDownload, consumeDownloadToken } from "../../lib/download";
import { createShareLink, resolveShareLink, consumeShareLinkDownload, revokeShareLink } from "../../lib/share-link";
import { listLibraryEntitlements } from "../../lib/library";
import { addProductExternalLink } from "../../lib/product";
import type { CurrentUser } from "../../lib/session";

// ADR-034: DB dev = production — test KHÔNG ghi `system_storage_config`. Presign/URL tải chỉ là ký request cục bộ (không gọi
// mạng), nên thay lớp đọc cấu hình bằng cấu hình R2 giả trong bộ nhớ. Tenant tạo mới chưa có bucket riêng → đi nhánh
// R2 mặc định, không gọi `ensureBucketExists`.
vi.mock("../../lib/system-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/system-storage")>();
  const { createS3Client } = await import("@gieochu/storage");
  const credentials = { accessKeyId: "fake", secretAccessKey: "fake" };
  const r2 = { endpoint: "https://fake.example.com", region: "auto", bucketPrivate: "fake-private", bucketPublic: "fake-public", ...credentials };
  const fakeConfig = {
    isEnabled: true,
    activeProvider: "CLOUDFLARE_R2" as const,
    r2,
    minio: { host: "", useSSL: true, region: "us-east-1", ...credentials },
    endpoint: r2.endpoint,
    region: r2.region,
    bucketPrivate: r2.bucketPrivate,
    bucketPublic: r2.bucketPublic,
    ...credentials,
  };
  const clientConfig = { endpoint: r2.endpoint, region: r2.region, ...credentials };
  return {
    ...actual,
    getDecryptedSystemStorageConfig: async () => fakeConfig,
    createClientForProvider: async () => ({ client: createS3Client(clientConfig), config: clientConfig }),
  };
});

const prisma = getPrismaClient();
const RUN_PREFIX = `m9test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.com`;
}

async function createActiveUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: "not-used-in-this-test", status: "ACTIVE", emailVerifiedAt: new Date() },
  });
}

function toCurrentUser(userId: string): CurrentUser {
  return { userId, familyId: "test-family", role: "USER", emailVerified: true, profileCompleted: true };
}

async function createOwnerAndTenant(name: string, slug: string) {
  const owner = await createActiveUser(nextEmail());
  const created = await createTenantForUser(toCurrentUser(owner.id), { name, slug: `${RUN_PREFIX}-${slug}` });
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: created.id } });
  return { owner, tenant };
}

/** Bypasses the full M8 checkout flow — M9's own tests only need an existing FULFILLED order + entitlement to already be in place. */
async function purchaseProduct(
  tenantId: string,
  buyerId: string,
  productId: string,
  opts: { downloadsUsed?: number; downloadLimit?: number } = {},
) {
  return withTenant(tenantId, async (tx) => {
    const order = await tx.order.create({
      data: {
        tenantId,
        customerId: buyerId,
        code: generateOrderCode("TST"),
        status: "FULFILLED",
        subtotalVnd: 10_000,
        totalVnd: 10_000,
        expiresAt: new Date(Date.now() + 60_000),
        paidAt: new Date(),
      },
    });
    const item = await tx.orderItem.create({
      data: { orderId: order.id, productId, titleSnapshot: "Test product", unitPriceVnd: 10_000, finalPriceVnd: 10_000 },
    });
    const entitlement = await tx.entitlement.create({
      data: {
        userId: buyerId,
        tenantId,
        productId,
        orderItemId: item.id,
        downloadsUsed: opts.downloadsUsed ?? 0,
        downloadLimit: opts.downloadLimit ?? 5,
      },
    });
    return entitlement;
  });
}

async function createCleanProductFile(tenantId: string, productId: string) {
  return withTenant(tenantId, (tx) =>
    tx.productFile.create({
      data: {
        productId,
        tenantId,
        objectKey: `${tenantId}/${productId}/${RUN_PREFIX}.pdf`,
        fileName: "Đề thi.pdf",
        mimeType: "application/pdf",
        sizeBytes: 1024,
        scanStatus: "CLEAN",
      },
    }),
  );
}

describe("M9 downloads and share links", () => {
  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.downloadToken.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.downloadEvent.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.shareLink.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.entitlement.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.orderItem.deleteMany({ where: { order: { tenantId: { in: tenantIds } } } });
        await tx.order.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.productFile.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("lists a customer's library entitlements grouped by tenant, across multiple tenants", async () => {
    const { tenant: tenantA } = await createOwnerAndTenant("Library A", "liba");
    const { tenant: tenantB } = await createOwnerAndTenant("Library B", "libb");
    const productA = await withTenant(tenantA.id, (tx) => tx.product.create({ data: { tenantId: tenantA.id, slug: "a", title: "A", status: "PUBLISHED" } }));
    const productB = await withTenant(tenantB.id, (tx) => tx.product.create({ data: { tenantId: tenantB.id, slug: "b", title: "B", status: "PUBLISHED" } }));
    const buyer = await createActiveUser(nextEmail());

    await purchaseProduct(tenantA.id, buyer.id, productA.id);
    await purchaseProduct(tenantB.id, buyer.id, productB.id);

    const groups = await listLibraryEntitlements(buyer.id);
    expect(groups.map((g) => g.tenantId).sort()).toEqual([tenantA.id, tenantB.id].sort());
  });

  it("downloads successfully: redirect URL issued, downloadsUsed incremented, download_events logged", async () => {
    const { tenant } = await createOwnerAndTenant("Download Test", "dl");
    const product = await withTenant(tenant.id, (tx) => tx.product.create({ data: { tenantId: tenant.id, slug: "p", title: "P", status: "PUBLISHED" } }));
    const file = await createCleanProductFile(tenant.id, product.id);
    const buyer = await createActiveUser(nextEmail());
    const entitlement = await purchaseProduct(tenant.id, buyer.id, product.id, { downloadsUsed: 0, downloadLimit: 5 });

    const { token } = await requestDownload(buyer.id, file.id);
    const url = await consumeDownloadToken(token, "127.0.0.1");
    expect(url).toContain("https://");

    const updated = await withTenant(tenant.id, (tx) => tx.entitlement.findUniqueOrThrow({ where: { id: entitlement.id } }));
    expect(updated.downloadsUsed).toBe(1);

    const events = await withTenant(tenant.id, (tx) => tx.downloadEvent.findMany({ where: { entitlementId: entitlement.id } }));
    expect(events).toHaveLength(1);
    expect(events[0]!.fileId).toBe(file.id);

    // A retried GET of the same (now-used) token must not succeed twice.
    await expect(consumeDownloadToken(token, "127.0.0.1")).rejects.toMatchObject({ httpStatus: 410 });
  });

  it("blocks requesting a new download token once the download limit is reached", async () => {
    const { tenant } = await createOwnerAndTenant("Limit Test", "limit");
    const product = await withTenant(tenant.id, (tx) => tx.product.create({ data: { tenantId: tenant.id, slug: "p", title: "P", status: "PUBLISHED" } }));
    const file = await createCleanProductFile(tenant.id, product.id);
    const buyer = await createActiveUser(nextEmail());
    await purchaseProduct(tenant.id, buyer.id, product.id, { downloadsUsed: 2, downloadLimit: 2 });

    await expect(requestDownload(buyer.id, file.id)).rejects.toMatchObject({ code: "DOWNLOAD_LIMIT_REACHED", httpStatus: 403 });
  });

  it("a password-protected share link only downloads with the correct password", async () => {
    const { tenant } = await createOwnerAndTenant("Share Password Test", "sharepw");
    const product = await withTenant(tenant.id, (tx) => tx.product.create({ data: { tenantId: tenant.id, slug: "p", title: "P", status: "PUBLISHED" } }));
    const file = await createCleanProductFile(tenant.id, product.id);

    const { token } = await createShareLink(tenant.id, product.id, { label: "Cho anh Nam", password: "secret123" });

    const resolved = await resolveShareLink(token);
    expect(resolved.requiresPassword).toBe(true);
    expect(resolved.files.map((f) => f.id)).toContain(file.id);

    await expect(consumeShareLinkDownload(token, file.id, "wrong-password", "127.0.0.1")).rejects.toMatchObject({
      code: "SHARE_LINK_WRONG_PASSWORD",
      httpStatus: 403,
    });

    const url = await consumeShareLinkDownload(token, file.id, "secret123", "127.0.0.1");
    expect(url).toContain("https://");
  });

  it("a revoked share link resolves to 410", async () => {
    const { tenant } = await createOwnerAndTenant("Share Revoke Test", "sharerevoke");
    const product = await withTenant(tenant.id, (tx) => tx.product.create({ data: { tenantId: tenant.id, slug: "p", title: "P", status: "PUBLISHED" } }));
    const { shareLink, token } = await createShareLink(tenant.id, product.id, { label: "Sắp thu hồi" });

    await revokeShareLink(tenant.id, shareLink.id);

    await expect(resolveShareLink(token)).rejects.toMatchObject({ code: "SHARE_LINK_REVOKED", httpStatus: 410 });
  });

  it("ADR-026: an entitled customer opens an external link (counted and logged) until the limit; others are refused and it never leaks to public or share links", async () => {
    const { tenant } = await createOwnerAndTenant("External Link Test", "extlink");
    const product = await withTenant(tenant.id, (tx) => tx.product.create({ data: { tenantId: tenant.id, slug: "p", title: "P", status: "PUBLISHED" } }));
    const driveUrl = "https://drive.google.com/file/d/ext123/view";
    const link = await addProductExternalLink(tenant.id, product.id, { label: "Tài liệu Drive", url: driveUrl });
    const buyer = await createActiveUser(nextEmail());
    const stranger = await createActiveUser(nextEmail());
    const entitlement = await purchaseProduct(tenant.id, buyer.id, product.id, { downloadsUsed: 0, downloadLimit: 1 });

    // Library lists the link (kind only — never the URL itself).
    const [group] = await listLibraryEntitlements(buyer.id);
    const libraryItem = group!.entitlements[0]!.files.find((f) => f.id === link.id);
    expect(libraryItem).toEqual({ id: link.id, kind: "EXTERNAL_URL", fileName: "Tài liệu Drive", sizeBytes: 0 });
    expect(JSON.stringify(group)).not.toContain("ext123");

    // Not entitled -> the row isn't even visible under the customer's RLS scope.
    await expect(requestDownload(stranger.id, link.id)).rejects.toMatchObject({ httpStatus: 404 });

    const { token } = await requestDownload(buyer.id, link.id);
    expect(await consumeDownloadToken(token, "127.0.0.1")).toBe(driveUrl);
    const updated = await withTenant(tenant.id, (tx) => tx.entitlement.findUniqueOrThrow({ where: { id: entitlement.id } }));
    expect(updated.downloadsUsed).toBe(1);
    const events = await withTenant(tenant.id, (tx) => tx.downloadEvent.findMany({ where: { entitlementId: entitlement.id } }));
    expect(events.map((e) => e.fileId)).toEqual([link.id]);

    // downloadLimit applies exactly like a file.
    await expect(requestDownload(buyer.id, link.id)).rejects.toMatchObject({ code: "DOWNLOAD_LIMIT_REACHED", httpStatus: 403 });

    // Public scope (storefront/preview) can never read an external-link row, even on a PUBLISHED product.
    const publicRows = await withPublic((tx) => tx.productFile.findMany({ where: { productId: product.id } }));
    expect(publicRows).toEqual([]);

    // Share links (anonymous) exclude external links entirely.
    const { token: shareToken } = await createShareLink(tenant.id, product.id, { label: "Chia sẻ" });
    expect((await resolveShareLink(shareToken)).files).toEqual([]);
    await expect(consumeShareLinkDownload(shareToken, link.id, undefined, "127.0.0.1")).rejects.toMatchObject({ httpStatus: 404 });
  });
});
