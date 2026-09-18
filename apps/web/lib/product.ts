import { AppError, canPublishProduct, slugify, suggestSlug } from "@gieochu/core";
import { getPrismaClient, withTenant, type Prisma, type Product, type ProductType } from "@gieochu/db";
import { assertTenantCanWrite } from "./tenant-write-guard";
import { assertPlanLimit } from "./plan-limits";

async function requireOwnedProduct(tenantId: string, productId: string): Promise<Product> {
  const product = await withTenant(tenantId, (tx) => tx.product.findUnique({ where: { id: productId } }));
  if (!product) {
    throw new AppError({ code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy sản phẩm.", httpStatus: 404 });
  }
  return product;
}

export interface CreateProductInput {
  title: string;
  slug?: string;
  type?: ProductType;
}

/** §"M5": DRAFT product, slug suggested (base/base-2/base-3...) on collision within the tenant. */
export async function createProduct(tenantId: string, input: CreateProductInput): Promise<Product> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);

  const base = slugify(input.slug?.trim() || input.title);
  if (!base) {
    throw new AppError({ code: "INVALID_SLUG", message: "Không tạo được đường dẫn từ tiêu đề.", httpStatus: 400 });
  }

  const existing = await withTenant(tenantId, (tx) => tx.product.findMany({ where: { tenantId }, select: { slug: true } }));
  const slug = suggestSlug(
    base,
    existing.map((p) => p.slug),
  );

  return withTenant(tenantId, (tx) =>
    tx.product.create({ data: { tenantId, slug, title: input.title, type: input.type ?? "OTHER", status: "DRAFT" } }),
  );
}

export interface UpdateProductInput {
  title?: string;
  description?: string;
  type?: ProductType;
  tags?: string[];
  priceVnd?: number;
  /** null clears the sale price — M6 builds the pricing engine that reads these; M5 only owns the columns/CRUD. */
  salePriceVnd?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
  downloadLimit?: number;
}

export async function updateProduct(tenantId: string, productId: string, input: UpdateProductInput): Promise<Product> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  const existing = await requireOwnedProduct(tenantId, productId);

  const effectivePrice = input.priceVnd ?? existing.priceVnd;
  const effectiveSalePrice = input.salePriceVnd === undefined ? existing.salePriceVnd : input.salePriceVnd;
  if (effectiveSalePrice != null && effectiveSalePrice >= effectivePrice) {
    throw new AppError({ code: "INVALID_SALE_PRICE", message: "Giá ưu đãi phải nhỏ hơn giá gốc.", httpStatus: 400 });
  }

  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: input as Prisma.ProductUpdateInput }));
}

/**
 * §"M5": "Xoá file của sản phẩm đã có người mua: chỉ ẩn khỏi danh sách mới,
 * không xoá object" — soft-hide only (`removedAt`), the S3 object is never
 * touched here (only file.scan's REJECTED path ever deletes an object, and
 * only for a file that was never CLEAN).
 */
export async function removeProductFile(tenantId: string, productId: string, fileId: string): Promise<void> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  await requireOwnedProduct(tenantId, productId);

  const file = await withTenant(tenantId, (tx) => tx.productFile.findUnique({ where: { id: fileId } }));
  if (!file || file.productId !== productId || file.removedAt) {
    throw new AppError({ code: "PRODUCT_FILE_NOT_FOUND", message: "Không tìm thấy file.", httpStatus: 404 });
  }

  await withTenant(tenantId, (tx) => tx.productFile.update({ where: { id: fileId }, data: { removedAt: new Date() } }));
  await prisma.tenant.update({ where: { id: tenantId }, data: { storageUsedBytes: { decrement: file.sizeBytes } } });
}

/**
 * §"M5" state diagram: DRAFT -> PUBLISHED, gated by `canPublishProduct()` —
 * at least one CLEAN sale (non-preview) file, a cover image, a valid price,
 * an ACTIVE tenant, and room under the plan's product limit.
 */
export async function publishProduct(tenantId: string, productId: string): Promise<Product> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  const product = await requireOwnedProduct(tenantId, productId);

  const [cleanSaleFileCount, publishedCount, subscription] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.productFile.count({ where: { productId, tenantId, isPreview: false, scanStatus: "CLEAN", removedAt: null } }),
    ),
    withTenant(tenantId, (tx) => tx.product.count({ where: { tenantId, status: "PUBLISHED" } })),
    prisma.subscription.findUniqueOrThrow({ where: { tenantId }, include: { plan: true } }),
  ]);

  const decision = canPublishProduct({
    hasCleanSaleFile: cleanSaleFileCount > 0,
    hasCoverImage: Boolean(product.coverImageKey),
    priceVnd: product.priceVnd,
    tenantStatus: tenant.status,
    currentPublishedCount: publishedCount,
    maxProducts: subscription.plan.maxProducts,
  });

  if (!decision.allowed) {
    throw new AppError({
      code: "PRODUCT_NOT_PUBLISHABLE",
      message: `Sản phẩm chưa đủ điều kiện xuất bản: ${decision.reasons.join(", ")}.`,
      httpStatus: 400,
    });
  }

  await assertPlanLimit(tenantId, "products", 1);
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { status: "PUBLISHED" } }));
}

/**
 * PUBLISHED -> DRAFT. §"M5" diagram notes "chưa có đơn" as the real-world
 * expectation, but M8 (orders) doesn't exist yet — nothing to check against,
 * so this is unconditional for now (see docs/BACKLOG.md).
 */
export async function unpublishProduct(tenantId: string, productId: string): Promise<Product> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  await requireOwnedProduct(tenantId, productId);
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { status: "DRAFT" } }));
}

/** DRAFT/PUBLISHED -> ARCHIVED. Files are untouched — archiving never affects an existing buyer's download rights. */
export async function archiveProduct(tenantId: string, productId: string): Promise<Product> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  await requireOwnedProduct(tenantId, productId);
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } }));
}

/** ARCHIVED -> DRAFT — must be re-published explicitly, not restored straight to PUBLISHED. */
export async function restoreProduct(tenantId: string, productId: string): Promise<Product> {
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  await requireOwnedProduct(tenantId, productId);
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { status: "DRAFT" } }));
}

export async function listProducts(tenantId: string) {
  return withTenant(tenantId, (tx) => tx.product.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } }));
}

export async function getProduct(tenantId: string, productId: string) {
  const product = await requireOwnedProduct(tenantId, productId);
  const files = await withTenant(tenantId, (tx) =>
    tx.productFile.findMany({ where: { productId, tenantId, removedAt: null }, orderBy: { createdAt: "asc" } }),
  );
  return { product, files };
}
