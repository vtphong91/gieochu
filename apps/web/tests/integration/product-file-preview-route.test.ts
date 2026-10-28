import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import type { CurrentUser } from "../../lib/session";

const prisma = getPrismaClient();
const RUN_PREFIX = `adr063test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function previewRequest(tenantSlug: string, productSlug: string, fileId: string): Request {
  return new Request(`http://localhost/api/${tenantSlug}/${productSlug}/preview/${fileId}`, { method: "GET" });
}

describe("ADR-063 preview route", { timeout: 60000 }, () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.productFilePreview.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.productFile.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("returns 200 with 20% payload for PUBLISHED product", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Preview", slug: `${RUN_PREFIX}-ok` });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });

    const product = await withTenant(tenant.id, (tx) =>
      tx.product.create({
        data: {
          tenantId: tenant.id,
          slug: "preview-ok",
          title: "ADR-063 preview",
          status: "PUBLISHED",
          priceVnd: 100_000,
        },
      }),
    );
    const file = await withTenant(tenant.id, (tx) =>
      tx.productFile.create({
        data: {
          productId: product.id,
          tenantId: tenant.id,
          sourceKind: "FILE",
          objectKey: `tenants/${tenant.id}/products/${product.id}/f1/doc.txt`,
          fileName: "doc.txt",
          mimeType: "text/plain",
          sizeBytes: 1024,
          scanStatus: "CLEAN",
          isPreview: false,
        },
      }),
    );
    // Giả lập cache preview đã có (không cần storage) để route trả 200 với payload mẫu.
    await prisma.productFilePreview.create({
      data: {
        productFileId: file.id,
        tenantId: tenant.id,
        productId: product.id,
        kind: "text",
        payload: { text: "nội dung mẫu", charsShown: 12, totalChars: 60 },
        ratio: 20,
        schemaVersion: 1,
      },
    });

    const { GET } = await import("../../app/api/[tenantSlug]/[productSlug]/preview/[fileId]/route");
    const response = await GET(previewRequest(tenant.slug, product.slug, file.id), {
      params: Promise.resolve({ tenantSlug: tenant.slug, productSlug: product.slug, fileId: file.id }),
    });
    expect(response.status).toBe(200);
    const body = (await response.json()) as { kind: string; ratio: number; payload: { totalChars: number } };
    expect(body.kind).toBe("text");
    expect(body.ratio).toBe(20);
    expect(body.payload.totalChars).toBe(60);
  });

  it("returns 404 for DRAFT product and for file belonging to other tenant", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Preview Draft", slug: `${RUN_PREFIX}-draft` });
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });

    const draftProduct = await withTenant(tenant.id, (tx) =>
      tx.product.create({
        data: { tenantId: tenant.id, slug: "preview-draft", title: "Draft", status: "DRAFT", priceVnd: 50_000 },
      }),
    );
    const draftFile = await withTenant(tenant.id, (tx) =>
      tx.productFile.create({
        data: {
          productId: draftProduct.id,
          tenantId: tenant.id,
          sourceKind: "FILE",
          objectKey: `tenants/${tenant.id}/products/${draftProduct.id}/f1/d.txt`,
          fileName: "d.txt",
          mimeType: "text/plain",
          sizeBytes: 1,
          scanStatus: "CLEAN",
          isPreview: false,
        },
      }),
    );
    const { GET } = await import("../../app/api/[tenantSlug]/[productSlug]/preview/[fileId]/route");
    const draftResponse = await GET(previewRequest(tenant.slug, draftProduct.slug, draftFile.id), {
      params: Promise.resolve({ tenantSlug: tenant.slug, productSlug: draftProduct.slug, fileId: draftFile.id }),
    });
    expect(draftResponse.status).toBe(404);

    // Tenant B có PUBLISHED product nhưng fileId thuộc tenant A → 404.
    const ownerB = await createActiveUser(nextEmail());
    const tenantB = await createTenantForUser(toCurrentUser(ownerB.id), { name: "Preview Other", slug: `${RUN_PREFIX}-other` });
    await prisma.tenant.update({ where: { id: tenantB.id }, data: { status: "ACTIVE" } });
    const productB = await withTenant(tenantB.id, (tx) =>
      tx.product.create({
        data: { tenantId: tenantB.id, slug: "preview-other", title: "Other", status: "PUBLISHED", priceVnd: 1000 },
      }),
    );
    const otherResponse = await GET(previewRequest(tenantB.slug, productB.slug, draftFile.id), {
      params: Promise.resolve({ tenantSlug: tenantB.slug, productSlug: productB.slug, fileId: draftFile.id }),
    });
    expect(otherResponse.status).toBe(404);
  });
});
