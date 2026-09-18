import { afterAll, describe, expect, it } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import { archiveProduct, createProduct, publishProduct } from "../../lib/product";
import type { CurrentUser } from "../../lib/session";

const prisma = getPrismaClient();
const RUN_PREFIX = `m5test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

describe("M5 product publish eligibility and archiving", () => {
  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.productFile.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("publishing fails when the product has no CLEAN sale file yet, and status stays DRAFT", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Publish Test", slug: `${RUN_PREFIX}-publish` });

    const product = await createProduct(tenant.id, { title: "Đề thi Toán 12", type: "EXAM" });
    // Owner has set a price and a cover image, but never uploaded a sale file.
    await withTenant(tenant.id, (tx) =>
      tx.product.update({ where: { id: product.id }, data: { priceVnd: 50_000, coverImageKey: "tenants/x/cover.png" } }),
    );

    await expect(publishProduct(tenant.id, product.id)).rejects.toMatchObject({ code: "PRODUCT_NOT_PUBLISHABLE" });

    const stillDraft = await withTenant(tenant.id, (tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    expect(stillDraft.status).toBe("DRAFT");
  });

  it("archiving a product leaves its existing files untouched (a buyer's download rights aren't affected)", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Archive Test", slug: `${RUN_PREFIX}-archive` });

    const product = await createProduct(tenant.id, { title: "Giáo án Văn", type: "TEMPLATE" });
    await withTenant(tenant.id, (tx) =>
      tx.productFile.create({
        data: {
          productId: product.id,
          tenantId: tenant.id,
          objectKey: `tenants/${tenant.id}/products/${product.id}/f1/giao-an.pdf`,
          fileName: "giao-an.pdf",
          mimeType: "application/pdf",
          sizeBytes: 12_345,
          scanStatus: "CLEAN",
          isPreview: false,
        },
      }),
    );

    const archived = await archiveProduct(tenant.id, product.id);
    expect(archived.status).toBe("ARCHIVED");

    const fileStillThere = await withTenant(tenant.id, (tx) =>
      tx.productFile.findMany({ where: { productId: product.id } }),
    );
    expect(fileStillThere).toHaveLength(1);
    expect(fileStillThere[0]?.scanStatus).toBe("CLEAN");
    expect(fileStillThere[0]?.removedAt).toBeNull();
  });
});
