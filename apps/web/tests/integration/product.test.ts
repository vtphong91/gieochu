import { afterAll, describe, expect, it } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import {
  addProductExternalLink,
  archiveProduct,
  createProduct,
  getProductPreviewData,
  publishProduct,
  updateProduct,
} from "../../lib/product";
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
    await prisma.documentCategory.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
  });

  it("publishing fails when the product has no CLEAN sale file yet, and status stays DRAFT", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Publish Test", slug: `${RUN_PREFIX}-publish` });

    const product = await createProduct(tenant.id, { title: "Đề thi Toán 12", type: "EXAM" });
    // Owner has set a price and a cover image, but never uploaded a sale file.
    await withTenant(tenant.id, (tx) =>
      tx.product.update({ where: { id: product.id }, data: { priceVnd: 50_000, coverImageKey: "tenants/x/cover.png" } }),
    );

    await expect(publishProduct(tenant.id, product.id, null, { rightsConfirmed: true })).rejects.toMatchObject({ code: "PRODUCT_NOT_PUBLISHABLE" });

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

  it("ADR-026: publishing is refused without an active category or a delivery source, and a link-only product publishes", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Publish ADR026", slug: `${RUN_PREFIX}-adr026` });
    const [activeCategory, inactiveCategory] = await Promise.all([
      prisma.documentCategory.create({ data: { slug: `${RUN_PREFIX}-active`, name: "Đề thi" } }),
      prisma.documentCategory.create({ data: { slug: `${RUN_PREFIX}-inactive`, name: "Cũ", isActive: false } }),
    ]);

    const product = await createProduct(tenant.id, { title: "Bộ đề Toán 9", type: "EXAM" });
    await withTenant(tenant.id, (tx) =>
      tx.product.update({ where: { id: product.id }, data: { priceVnd: 30_000, coverImageKey: "tenants/x/cover.png" } }),
    );

    // No category, no file, no link: both blockers are reported together.
    const noCategory = await publishProduct(tenant.id, product.id, null, { rightsConfirmed: true }).catch((e: unknown) => e);
    expect(noCategory).toMatchObject({ code: "PRODUCT_NOT_PUBLISHABLE" });
    expect((noCategory as { reasons: { code: string }[] }).reasons.map((r) => r.code).sort()).toEqual([
      "CATEGORY_REQUIRED",
      "NO_DELIVERY_SOURCE",
    ]);

    // An inactive category can't even be assigned; a disallowed link host is refused.
    await expect(updateProduct(tenant.id, product.id, { categoryId: inactiveCategory.id })).rejects.toMatchObject({ code: "CATEGORY_INACTIVE" });
    await expect(
      addProductExternalLink(tenant.id, product.id, { label: "Link lạ", url: "https://evilsharepoint.com/x" }),
    ).rejects.toMatchObject({ code: "INVALID_EXTERNAL_URL" });

    await updateProduct(tenant.id, product.id, { categoryId: activeCategory.id });
    await expect(publishProduct(tenant.id, product.id, null, { rightsConfirmed: true })).rejects.toMatchObject({ code: "PRODUCT_NOT_PUBLISHABLE" });

    // A valid external link alone is an acceptable delivery source (owner decision, ADR-026).
    const link = await addProductExternalLink(tenant.id, product.id, { label: "Bộ đề (Drive)", url: "https://drive.google.com/file/d/abc/view" });
    expect(link).toMatchObject({ sourceKind: "EXTERNAL_URL", objectKey: null, scanStatus: null, sizeBytes: 0 });
    const published = await publishProduct(tenant.id, product.id, null, { rightsConfirmed: true });
    expect(published.status).toBe("PUBLISHED");
    expect(published.categoryId).toBe(activeCategory.id);

    // Once the category is switched off, the next edit of the published product must pick a new one.
    await prisma.documentCategory.update({ where: { id: activeCategory.id }, data: { isActive: false } });
    await expect(updateProduct(tenant.id, product.id, { title: "Bộ đề Toán 9 (mới)" })).rejects.toMatchObject({ code: "CATEGORY_INACTIVE" });
    await expect(updateProduct(tenant.id, product.id, { categoryId: null })).rejects.toMatchObject({ code: "CATEGORY_REQUIRED" });
    const stillPublished = await withTenant(tenant.id, (tx) => tx.product.findUniqueOrThrow({ where: { id: product.id } }));
    expect(stillPublished.status).toBe("PUBLISHED");
    expect(stillPublished.title).toBe("Bộ đề Toán 9");
  });

  it("ADR-027: a Cloudinary cover satisfies publishing, preview reads the tenant's own draft only, and PRIVATE unpublishes on save", async () => {
    const owner = await createActiveUser(nextEmail());
    const other = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Publish ADR027", slug: `${RUN_PREFIX}-adr027` });
    const otherTenant = await createTenantForUser(toCurrentUser(other.id), { name: "Other ADR027", slug: `${RUN_PREFIX}-adr027-other` });
    const category = await prisma.documentCategory.create({ data: { slug: `${RUN_PREFIX}-adr027-cat`, name: "Giáo án" } });
    const coverImageUrl = "https://res.cloudinary.com/demo/image/upload/v1/gieochu/tenants/x/products/cover.png";

    // Non-Cloudinary covers and over-long summaries are refused before anything is written.
    await expect(
      createProduct(tenant.id, { title: "Giáo án lỗi", coverImageUrl: "https://evil.example.com/cover.png" }),
    ).rejects.toMatchObject({ code: "INVALID_COVER_IMAGE_URL" });
    await expect(createProduct(tenant.id, { title: "Giáo án lỗi", summary: "a".repeat(301) })).rejects.toMatchObject({
      code: "INVALID_PRODUCT_SUMMARY",
    });

    const product = await createProduct(tenant.id, {
      title: "Giáo án Văn 10",
      type: "TEMPLATE",
      summary: "  Trọn bộ\n giáo án\u0007 học kỳ I  ",
      coverImageUrl,
      categoryId: category.id,
      priceVnd: 40_000,
    });
    expect(product).toMatchObject({ status: "DRAFT", summary: "Trọn bộ giáo án học kỳ I", coverImageUrl, coverImageKey: null });

    // Create-page "Công khai" without a delivery source: publish is refused, the draft is kept, and the
    // Cloudinary cover counts as the cover image (only the delivery source is missing).
    const refused = await publishProduct(tenant.id, product.id, null, { rightsConfirmed: true }).catch((e: unknown) => e);
    expect((refused as { reasons: { code: string }[] }).reasons.map((r) => r.code)).toEqual(["NO_DELIVERY_SOURCE"]);

    // Preview reads the draft through withTenant; another tenant (RLS) or an unknown id gets 404.
    const preview = await getProductPreviewData(tenant.id, product.id);
    expect(preview.tenant.slug).toBe(tenant.slug);
    expect(preview.product).toMatchObject({ status: "DRAFT", categoryName: "Giáo án", coverUrl: coverImageUrl, effectivePriceVnd: 40_000, onSale: false });
    expect(JSON.stringify(preview)).not.toContain("externalUrl");
    await expect(getProductPreviewData(otherTenant.id, product.id)).rejects.toMatchObject({ code: "PRODUCT_NOT_FOUND" });

    await addProductExternalLink(tenant.id, product.id, { label: "Giáo án (Drive)", url: "https://drive.google.com/file/d/xyz/view" });
    expect((await publishProduct(tenant.id, product.id, null, { rightsConfirmed: true })).status).toBe("PUBLISHED");

    // "Riêng tư" on a published product: saved and unpublished in the same update, even while clearing the category.
    const privateSaved = await updateProduct(tenant.id, product.id, { summary: "", categoryId: null }, { unpublish: true });
    expect(privateSaved).toMatchObject({ status: "DRAFT", summary: null, categoryId: null });
  });
});
