import { afterAll, describe, expect, it } from "vitest";
import { encryptSecret, generateOrderCode } from "@gieochu/core";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { getEnv } from "@gieochu/config";
import { createTenantForUser } from "../../lib/create-tenant";
import { requestDownload, consumeDownloadToken } from "../../lib/download";
import { createShareLink, resolveShareLink, consumeShareLinkDownload, revokeShareLink } from "../../lib/share-link";
import { listLibraryEntitlements } from "../../lib/library";
import type { CurrentUser } from "../../lib/session";

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

/** Presign/download-URL generation is pure local request-signing (no real network call), same reasoning as M5's presign test. */
async function ensureFakeStorageConfig(): Promise<void> {
  const env = getEnv();
  const secrets = encryptSecret(JSON.stringify({ accessKeyId: "fake", secretAccessKey: "fake" }), env.STORAGE_ENCRYPTION_KEY);
  const publicConfig = { endpoint: "https://fake.example.com", region: "auto", bucketPrivate: "fake-private", bucketPublic: "fake-public" };
  await prisma.systemStorageConfig.upsert({
    where: { id: "default" },
    update: { isEnabled: true, publicConfig, encryptedSecrets: secrets },
    create: { id: "default", isEnabled: true, publicConfig, encryptedSecrets: secrets },
  });
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
    await prisma.systemStorageConfig.deleteMany({ where: { id: "default" } });
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
    await ensureFakeStorageConfig();
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
    await ensureFakeStorageConfig();
    const { tenant } = await createOwnerAndTenant("Limit Test", "limit");
    const product = await withTenant(tenant.id, (tx) => tx.product.create({ data: { tenantId: tenant.id, slug: "p", title: "P", status: "PUBLISHED" } }));
    const file = await createCleanProductFile(tenant.id, product.id);
    const buyer = await createActiveUser(nextEmail());
    await purchaseProduct(tenant.id, buyer.id, product.id, { downloadsUsed: 2, downloadLimit: 2 });

    await expect(requestDownload(buyer.id, file.id)).rejects.toMatchObject({ code: "DOWNLOAD_LIMIT_REACHED", httpStatus: 403 });
  });

  it("a password-protected share link only downloads with the correct password", async () => {
    await ensureFakeStorageConfig();
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
});
