import {
  AppError,
  calculateOrderPricing,
  canPublishProduct,
  isCloudinaryImageUrl,
  isReservedProductSlug,
  normalizeExternalDocumentUrl,
  normalizeProductSummary,
  RESERVED_PRODUCT_SLUGS,
  slugify,
  suggestSlug,
  type PublishBlock,
  type PublishEligibilityResult,
} from "@gieochu/core";
import {
  getPrismaClient,
  withTenant,
  type Prisma,
  type Product,
  type ProductFile,
  type ProductFileScanStatus,
  type ProductStatus,
  type ProductType,
} from "@gieochu/db";
import { assertTenantCanWrite } from "./tenant-write-guard";
import { assertPlanLimit } from "./plan-limits";
import { listActiveCategoriesForStudio, type StudioCategoryOption } from "./document-category";
import { getProductCoverUrl, hasProductCover } from "./product-cover";

/** ADR-026: nhãn hiển thị của link tài liệu ngoài (lưu ở `product_files.fileName`). */
export const EXTERNAL_LINK_LABEL_MAX_LENGTH = 200;

/**
 * Lỗi xuất bản mang theo danh sách lý do có cấu trúc — Server Action trả nguyên `reasons` cho UI
 * (checklist), route/caller khác vẫn thấy một AppError `PRODUCT_NOT_PUBLISHABLE` bình thường.
 */
export class ProductNotPublishableError extends AppError {
  readonly reasons: PublishBlock[];

  constructor(reasons: PublishBlock[]) {
    super({
      code: "PRODUCT_NOT_PUBLISHABLE",
      message: `Sản phẩm chưa đủ điều kiện xuất bản: ${reasons.map((r) => r.message).join(" ")}`,
      httpStatus: 400,
    });
    this.reasons = reasons;
  }
}

async function requireWritableTenant(tenantId: string) {
  const tenant = await getPrismaClient().tenant.findUniqueOrThrow({ where: { id: tenantId } });
  assertTenantCanWrite(tenant);
  return tenant;
}

async function requireOwnedProduct(tenantId: string, productId: string): Promise<Product> {
  const product = await withTenant(tenantId, (tx) => tx.product.findUnique({ where: { id: productId } }));
  if (!product || product.tenantId !== tenantId) {
    throw new AppError({ code: "PRODUCT_NOT_FOUND", message: "Không tìm thấy sản phẩm.", httpStatus: 404 });
  }
  return product;
}

/**
 * ADR-026: danh mục (L1) phải tồn tại và đang `isActive` mới được gán. `null` = bỏ trống (chỉ hợp lệ khi
 * sản phẩm chưa xuất bản — caller quyết định).
 */
async function assertAssignableCategory(categoryId: string): Promise<void> {
  const category = await getPrismaClient().documentCategory.findUnique({ where: { id: categoryId }, select: { isActive: true } });
  if (!category) {
    throw new AppError({ code: "CATEGORY_NOT_FOUND", message: "Danh mục không tồn tại.", httpStatus: 400 });
  }
  if (!category.isActive) {
    throw new AppError({ code: "CATEGORY_INACTIVE", message: "Danh mục đang ngừng hoạt động — hãy chọn danh mục khác.", httpStatus: 400 });
  }
}

export interface ProductFieldsInput {
  title?: string;
  /** ADR-027: mô tả ngắn văn bản thuần. `null` = xoá; `undefined` = không đổi. Chuẩn hoá lại ở đây. */
  summary?: string | null;
  /** `null` = xoá mô tả; `undefined` = không đổi. */
  description?: string | null;
  /** ADR-027: ảnh bìa Cloudinary (`https://res.cloudinary.com/...`). `null` = xoá; `undefined` = không đổi. */
  coverImageUrl?: string | null;
  type?: ProductType;
  /** ADR-026. `null` = bỏ trống danh mục; `undefined` = không đổi. */
  categoryId?: string | null;
  tags?: string[];
  priceVnd?: number;
  /** null clears the sale price — M6 builds the pricing engine that reads these; M5 only owns the columns/CRUD. */
  salePriceVnd?: number | null;
  saleStartsAt?: Date | null;
  saleEndsAt?: Date | null;
  downloadLimit?: number;
}

export interface CreateProductInput extends ProductFieldsInput {
  title: string;
  slug?: string;
}

/**
 * ADR-027: kiểm lại mô tả ngắn + URL ảnh bìa ở tầng nghiệp vụ (Server Action đã validate, đây là lớp chặn
 * cuối cho mọi caller). Trả giá trị đã chuẩn hoá; `undefined` giữ nguyên nghĩa "không đổi".
 */
function normalizeSummaryAndCover(input: ProductFieldsInput): { summary: string | null | undefined; coverImageUrl: string | null | undefined } {
  let summary: string | null | undefined = input.summary;
  if (typeof summary === "string") {
    const result = normalizeProductSummary(summary);
    if (!result.ok) throw new AppError({ code: "INVALID_PRODUCT_SUMMARY", message: result.message, httpStatus: 400 });
    summary = result.value;
  }
  let coverImageUrl: string | null | undefined = input.coverImageUrl;
  if (typeof coverImageUrl === "string") {
    coverImageUrl = coverImageUrl.trim() || null;
    if (coverImageUrl && !isCloudinaryImageUrl(coverImageUrl)) {
      throw new AppError({ code: "INVALID_COVER_IMAGE_URL", message: "Ảnh bìa phải được upload lên Cloudinary.", httpStatus: 400 });
    }
  }
  return { summary, coverImageUrl };
}

function assertSalePrice(priceVnd: number, salePriceVnd: number | null): void {
  if (salePriceVnd != null && salePriceVnd >= priceVnd) {
    throw new AppError({ code: "INVALID_SALE_PRICE", message: "Giá ưu đãi phải nhỏ hơn giá gốc.", httpStatus: 400 });
  }
}

/**
 * §"M5": DRAFT product, slug suggested (base/base-2/base-3...) on collision within the tenant.
 * ADR-026: nhận luôn các field của editor (danh mục, giá, tags...) để lần lưu đầu của editor dùng chung
 * không làm mất dữ liệu đã nhập; danh mục được để trống vì sản phẩm mới luôn là nháp.
 */
export async function createProduct(tenantId: string, input: CreateProductInput): Promise<Product> {
  await requireWritableTenant(tenantId);

  const explicitSlug = input.slug?.trim();
  const base = slugify(explicitSlug || input.title);
  if (!base) {
    throw new AppError({ code: "INVALID_SLUG", message: "Không tạo được đường dẫn từ tiêu đề.", httpStatus: 400 });
  }
  // ADR-030 §2: slug trùng segment tĩnh con của `/[tenantSlug]` (posts, checkout...) thì trang tài liệu không bao
  // giờ hiện được. Slug tự nhập → từ chối; slug tự sinh từ tiêu đề → coi như đã bị chiếm, thêm hậu tố (-2, -3...).
  if (explicitSlug && isReservedProductSlug(base)) {
    throw new AppError({
      code: "INVALID_SLUG",
      message: `Đường dẫn "${base}" là từ dành riêng của hệ thống — vui lòng chọn đường dẫn khác.`,
      httpStatus: 400,
    });
  }
  const { summary, coverImageUrl } = normalizeSummaryAndCover(input);
  if (input.categoryId) await assertAssignableCategory(input.categoryId);
  if (input.priceVnd !== undefined || input.salePriceVnd != null) {
    assertSalePrice(input.priceVnd ?? 0, input.salePriceVnd ?? null);
  }

  const existing = await withTenant(tenantId, (tx) => tx.product.findMany({ where: { tenantId }, select: { slug: true } }));
  const slug = suggestSlug(base, [...existing.map((p) => p.slug), ...RESERVED_PRODUCT_SLUGS]);

  return withTenant(tenantId, (tx) =>
    tx.product.create({
      data: {
        tenantId,
        slug,
        title: input.title,
        summary: summary ?? null,
        description: input.description,
        coverImageUrl: coverImageUrl ?? null,
        type: input.type ?? "OTHER",
        status: "DRAFT",
        categoryId: input.categoryId ?? null,
        tags: input.tags,
        priceVnd: input.priceVnd,
        salePriceVnd: input.salePriceVnd ?? null,
        saleStartsAt: input.saleStartsAt ?? null,
        saleEndsAt: input.saleEndsAt ?? null,
        downloadLimit: input.downloadLimit,
      },
    }),
  );
}

export type UpdateProductInput = ProductFieldsInput;

export interface UpdateProductOptions {
  /**
   * ADR-027 §1 ("Riêng tư" trên sản phẩm đang Công khai): lưu và chuyển PUBLISHED -> DRAFT trong CÙNG một
   * lệnh update — không có khoảnh khắc sản phẩm công khai mang dữ liệu nửa vời, và luật "đã xuất bản phải có
   * danh mục" xét theo trạng thái đích (DRAFT). Không tác dụng với DRAFT/ARCHIVED.
   */
  unpublish?: boolean;
}

/**
 * Slug không đổi sau khi tạo (chưa hỗ trợ đổi slug sản phẩm). ADR-026: danh mục mới gán phải đang hoạt
 * động; sản phẩm đang PUBLISHED bắt buộc có danh mục hoạt động ở mọi lần sửa ("lần xuất bản/sửa tiếp theo
 * phải chọn lại" khi danh mục cũ đã bị tắt). Nháp/lưu trữ được để trống.
 */
export async function updateProduct(
  tenantId: string,
  productId: string,
  input: UpdateProductInput,
  options: UpdateProductOptions = {},
): Promise<Product> {
  await requireWritableTenant(tenantId);
  const existing = await requireOwnedProduct(tenantId, productId);
  const { summary, coverImageUrl } = normalizeSummaryAndCover(input);
  const unpublish = options.unpublish === true && existing.status === "PUBLISHED";
  const targetStatus = unpublish ? "DRAFT" : existing.status;

  const effectivePrice = input.priceVnd ?? existing.priceVnd;
  const effectiveSalePrice = input.salePriceVnd === undefined ? existing.salePriceVnd : input.salePriceVnd;
  assertSalePrice(effectivePrice, effectiveSalePrice);

  const effectiveCategoryId = input.categoryId === undefined ? existing.categoryId : input.categoryId;
  if (effectiveCategoryId) {
    await assertAssignableCategory(effectiveCategoryId);
  } else if (targetStatus === "PUBLISHED") {
    throw new AppError({ code: "CATEGORY_REQUIRED", message: "Sản phẩm đã xuất bản phải có danh mục.", httpStatus: 400 });
  }

  const data: Prisma.ProductUncheckedUpdateInput = {
    title: input.title,
    summary,
    description: input.description,
    coverImageUrl,
    type: input.type,
    categoryId: input.categoryId,
    tags: input.tags,
    priceVnd: input.priceVnd,
    salePriceVnd: input.salePriceVnd,
    saleStartsAt: input.saleStartsAt,
    saleEndsAt: input.saleEndsAt,
    downloadLimit: input.downloadLimit,
    ...(unpublish ? { status: "DRAFT" as const } : {}),
  };
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data }));
}

async function requireActiveDeliveryRow(tenantId: string, productId: string, rowId: string, kind: "FILE" | "EXTERNAL_URL"): Promise<ProductFile> {
  const row = await withTenant(tenantId, (tx) => tx.productFile.findUnique({ where: { id: rowId } }));
  if (!row || row.tenantId !== tenantId || row.productId !== productId || row.removedAt || row.sourceKind !== kind) {
    throw kind === "FILE"
      ? new AppError({ code: "PRODUCT_FILE_NOT_FOUND", message: "Không tìm thấy file.", httpStatus: 404 })
      : new AppError({ code: "PRODUCT_LINK_NOT_FOUND", message: "Không tìm thấy link tài liệu.", httpStatus: 404 });
  }
  return row;
}

/**
 * §"M5": "Xoá file của sản phẩm đã có người mua: chỉ ẩn khỏi danh sách mới,
 * không xoá object" — soft-hide only (`removedAt`), the S3 object is never
 * touched here (only file.scan's REJECTED path ever deletes an object, and
 * only for a file that was never CLEAN).
 */
export async function removeProductFile(tenantId: string, productId: string, fileId: string): Promise<void> {
  await requireWritableTenant(tenantId);
  await requireOwnedProduct(tenantId, productId);
  const file = await requireActiveDeliveryRow(tenantId, productId, fileId, "FILE");

  await withTenant(tenantId, (tx) => tx.productFile.update({ where: { id: fileId }, data: { removedAt: new Date() } }));
  await getPrismaClient().tenant.update({ where: { id: tenantId }, data: { storageUsedBytes: { decrement: file.sizeBytes } } });
}

export interface ExternalLinkInput {
  label: string;
  url: string;
}

function parseExternalLinkInput(input: ExternalLinkInput): { label: string; url: string } {
  const label = input.label.trim();
  if (!label || label.length > EXTERNAL_LINK_LABEL_MAX_LENGTH) {
    throw new AppError({
      code: "INVALID_EXTERNAL_LINK_LABEL",
      message: `Tên link phải từ 1 đến ${EXTERNAL_LINK_LABEL_MAX_LENGTH} ký tự.`,
      httpStatus: 400,
    });
  }
  const url = normalizeExternalDocumentUrl(input.url);
  if (!url) {
    throw new AppError({
      code: "INVALID_EXTERNAL_URL",
      message: "Link phải bắt đầu bằng https:// và thuộc Google Drive/Docs, OneDrive, SharePoint hoặc Dropbox.",
      httpStatus: 400,
    });
  }
  return { label, url };
}

/**
 * ADR-026 §3: link tài liệu ngoài lưu cùng `product_files` (RLS L2 sẵn có). Không object key, không quét,
 * không tính dung lượng — hình dạng dòng được CHECK constraint `product_files_source_shape` ép ở DB.
 */
export async function addProductExternalLink(tenantId: string, productId: string, input: ExternalLinkInput): Promise<ProductFile> {
  await requireWritableTenant(tenantId);
  await requireOwnedProduct(tenantId, productId);
  const { label, url } = parseExternalLinkInput(input);

  return withTenant(tenantId, (tx) =>
    tx.productFile.create({
      data: {
        productId,
        tenantId,
        sourceKind: "EXTERNAL_URL",
        externalUrl: url,
        fileName: label,
        sizeBytes: 0,
        scanStatus: null,
        isPreview: false,
      },
    }),
  );
}

/** Sửa nhãn/URL link. Khách đã mua sẽ nhận URL mới ở lần mở tiếp theo (dùng khi tenant sửa link hỏng). */
export async function updateProductExternalLink(
  tenantId: string,
  productId: string,
  linkId: string,
  input: ExternalLinkInput,
): Promise<ProductFile> {
  await requireWritableTenant(tenantId);
  await requireOwnedProduct(tenantId, productId);
  await requireActiveDeliveryRow(tenantId, productId, linkId, "EXTERNAL_URL");
  const { label, url } = parseExternalLinkInput(input);

  return withTenant(tenantId, (tx) => tx.productFile.update({ where: { id: linkId }, data: { fileName: label, externalUrl: url } }));
}

/** Gỡ mềm (`removedAt`) — cùng cách gỡ file; không có dung lượng để trừ. */
export async function removeProductExternalLink(tenantId: string, productId: string, linkId: string): Promise<void> {
  await requireWritableTenant(tenantId);
  await requireOwnedProduct(tenantId, productId);
  await requireActiveDeliveryRow(tenantId, productId, linkId, "EXTERNAL_URL");
  await withTenant(tenantId, (tx) => tx.productFile.update({ where: { id: linkId }, data: { removedAt: new Date() } }));
}

/**
 * ADR-026 §4: đánh giá điều kiện xuất bản cho một sản phẩm. `currentPublishedCount` không tính chính sản
 * phẩm này, để checklist của một sản phẩm đang PUBLISHED không tự báo "vượt giới hạn".
 */
export async function evaluateProductPublish(tenantId: string, product: Product): Promise<PublishEligibilityResult> {
  const prisma = getPrismaClient();
  const [tenant, category, deliveryRows, publishedCount, subscription] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
    product.categoryId ? prisma.documentCategory.findUnique({ where: { id: product.categoryId }, select: { isActive: true } }) : null,
    withTenant(tenantId, (tx) =>
      tx.productFile.findMany({
        where: { productId: product.id, tenantId, isPreview: false, removedAt: null },
        select: { sourceKind: true, scanStatus: true, externalUrl: true },
      }),
    ),
    withTenant(tenantId, (tx) => tx.product.count({ where: { tenantId, status: "PUBLISHED", id: { not: product.id } } })),
    prisma.subscription.findUniqueOrThrow({ where: { tenantId }, include: { plan: true } }),
  ]);

  return canPublishProduct({
    categoryStatus: !product.categoryId || !category ? "missing" : category.isActive ? "active" : "inactive",
    hasCleanSaleFile: deliveryRows.some((row) => row.sourceKind === "FILE" && row.scanStatus === "CLEAN"),
    hasValidExternalLink: deliveryRows.some(
      (row) => row.sourceKind === "EXTERNAL_URL" && row.externalUrl != null && normalizeExternalDocumentUrl(row.externalUrl) !== null,
    ),
    hasCoverImage: hasProductCover(product),
    priceVnd: product.priceVnd,
    tenantStatus: tenant.status,
    currentPublishedCount: publishedCount,
    maxProducts: subscription.plan.maxProducts,
  });
}

/**
 * §"M5" state diagram: DRAFT -> PUBLISHED, gated by `canPublishProduct()` (ADR-026: danh mục hoạt động,
 * ảnh bìa, ≥1 file bán CLEAN hoặc link ngoài hợp lệ, giá hợp lệ, tenant ACTIVE, còn chỗ trong gói).
 * Gọi lại trên sản phẩm đã PUBLISHED là no-op (dùng cho "lưu rồi xuất bản").
 */
export async function publishProduct(tenantId: string, productId: string): Promise<Product> {
  await requireWritableTenant(tenantId);
  const product = await requireOwnedProduct(tenantId, productId);
  if (product.status === "PUBLISHED") return product;

  const decision = await evaluateProductPublish(tenantId, product);
  if (!decision.allowed) throw new ProductNotPublishableError(decision.reasons);

  await assertPlanLimit(tenantId, "products", 1);
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { status: "PUBLISHED" } }));
}

/**
 * PUBLISHED -> DRAFT. §"M5" diagram notes "chưa có đơn" as the real-world
 * expectation, but M8 (orders) doesn't exist yet — nothing to check against,
 * so this is unconditional for now (see docs/BACKLOG.md).
 */
export async function unpublishProduct(tenantId: string, productId: string): Promise<Product> {
  await requireWritableTenant(tenantId);
  await requireOwnedProduct(tenantId, productId);
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { status: "DRAFT" } }));
}

/** DRAFT/PUBLISHED -> ARCHIVED. Files are untouched — archiving never affects an existing buyer's download rights. */
export async function archiveProduct(tenantId: string, productId: string): Promise<Product> {
  await requireWritableTenant(tenantId);
  await requireOwnedProduct(tenantId, productId);
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { status: "ARCHIVED" } }));
}

/** ARCHIVED -> DRAFT — must be re-published explicitly, not restored straight to PUBLISHED. */
export async function restoreProduct(tenantId: string, productId: string): Promise<Product> {
  await requireWritableTenant(tenantId);
  await requireOwnedProduct(tenantId, productId);
  return withTenant(tenantId, (tx) => tx.product.update({ where: { id: productId }, data: { status: "DRAFT" } }));
}

export async function listProducts(tenantId: string) {
  return withTenant(tenantId, (tx) => tx.product.findMany({ where: { tenantId }, orderBy: { updatedAt: "desc" } }));
}

/**
 * Sản phẩm + file đã upload (chưa gỡ). `files` CHỈ gồm `sourceKind = FILE` — các trang cũ (upload,
 * share link) chỉ hiểu file; link ngoài lấy qua `getProductEditorData().links`.
 */
export async function getProduct(tenantId: string, productId: string) {
  const product = await requireOwnedProduct(tenantId, productId);
  const files = await withTenant(tenantId, (tx) =>
    tx.productFile.findMany({ where: { productId, tenantId, sourceKind: "FILE", removedAt: null }, orderBy: { createdAt: "asc" } }),
  );
  return { product, files };
}

export interface EditorProductFile {
  id: string;
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  scanStatus: ProductFileScanStatus | null;
  isPreview: boolean;
  createdAt: Date;
}

export interface EditorProductLink {
  id: string;
  label: string;
  url: string;
  /** false khi URL đã lưu không còn qua allowlist hiện hành — không được tính là nguồn giao hàng. */
  isAllowed: boolean;
  createdAt: Date;
}

/** Dòng `product_files` loại EXTERNAL_URL → dạng link của editor (dùng chung cho loader và Server Action). */
export function toEditorProductLink(row: Pick<ProductFile, "id" | "fileName" | "externalUrl" | "createdAt">): EditorProductLink {
  const url = row.externalUrl ?? "";
  return { id: row.id, label: row.fileName, url, isAllowed: normalizeExternalDocumentUrl(url) !== null, createdAt: row.createdAt };
}

export interface EditorProductData {
  product: {
    id: string;
    slug: string;
    title: string;
    /** ADR-027: mô tả ngắn (văn bản thuần ≤300). */
    summary: string | null;
    description: string | null;
    type: ProductType;
    status: ProductStatus;
    categoryId: string | null;
    coverImageKey: string | null;
    /** ADR-027: ảnh bìa Cloudinary đã lưu (giá trị field `coverImageUrl` của form). */
    coverImageUrl: string | null;
    /** ADR-027: URL ảnh bìa hiệu lực để hiển thị (Cloudinary, fallback R2); null = chưa có ảnh. */
    coverUrl: string | null;
    tags: string[];
    priceVnd: number;
    salePriceVnd: number | null;
    saleStartsAt: Date | null;
    saleEndsAt: Date | null;
    downloadLimit: number;
    createdAt: Date;
    updatedAt: Date;
  };
  /** Danh mục đang gán (kể cả khi đã bị tắt — để UI cảnh báo "hãy chọn lại"). */
  category: { id: string; name: string; isActive: boolean } | null;
  /** Danh mục được phép chọn (chỉ `isActive`). */
  categories: StudioCategoryOption[];
  files: EditorProductFile[];
  links: EditorProductLink[];
  publish: PublishEligibilityResult;
}

/**
 * ADR-026 §5: dữ liệu cho editor Tạo/Sửa dùng chung. Chỉ gọi từ trang Studio đã qua
 * `requireTenantMemberPage` — `links[].url` là dữ liệu riêng của tenant, không bao giờ đưa ra trang public.
 */
export async function getProductEditorData(tenantId: string, productId: string): Promise<EditorProductData> {
  const product = await requireOwnedProduct(tenantId, productId);
  const [rows, category, categories, publish, coverUrl] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.productFile.findMany({ where: { productId, tenantId, removedAt: null }, orderBy: { createdAt: "asc" } }),
    ),
    product.categoryId
      ? getPrismaClient().documentCategory.findUnique({ where: { id: product.categoryId }, select: { id: true, name: true, isActive: true } })
      : null,
    listActiveCategoriesForStudio(),
    evaluateProductPublish(tenantId, product),
    getProductCoverUrl(product),
  ]);

  const files: EditorProductFile[] = [];
  const links: EditorProductLink[] = [];
  for (const row of rows) {
    if (row.sourceKind === "EXTERNAL_URL") {
      links.push(toEditorProductLink(row));
    } else {
      files.push({
        id: row.id,
        fileName: row.fileName,
        mimeType: row.mimeType,
        sizeBytes: row.sizeBytes,
        scanStatus: row.scanStatus,
        isPreview: row.isPreview,
        createdAt: row.createdAt,
      });
    }
  }

  return {
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      summary: product.summary,
      description: product.description,
      type: product.type,
      status: product.status,
      categoryId: product.categoryId,
      coverImageKey: product.coverImageKey,
      coverImageUrl: product.coverImageUrl,
      coverUrl,
      tags: product.tags,
      priceVnd: product.priceVnd,
      salePriceVnd: product.salePriceVnd,
      saleStartsAt: product.saleStartsAt,
      saleEndsAt: product.saleEndsAt,
      downloadLimit: product.downloadLimit,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
    },
    category,
    categories,
    files,
    links,
    publish,
  };
}

export interface ProductPreviewData {
  tenant: { name: string; slug: string };
  product: {
    id: string;
    slug: string;
    title: string;
    summary: string | null;
    /** HTML đã sanitize khi lưu (TiptapEditor) — cùng dữ liệu trang chi tiết công khai đang đọc. */
    description: string | null;
    type: ProductType;
    status: ProductStatus;
    /** Tên danh mục đang gán (kể cả đã bị tắt), null = chưa chọn. */
    categoryName: string | null;
    tags: string[];
    /** Giá niêm yết, VND nguyên. */
    priceVnd: number;
    /** Giá áp dụng tại thời điểm xem (sale theo khung giờ) — cùng `calculateOrderPricing` với trang công khai. */
    effectivePriceVnd: number;
    onSale: boolean;
    /** Ảnh bìa hiệu lực (Cloudinary, fallback R2); null = chưa có. */
    coverUrl: string | null;
    /** 0 = không giới hạn. */
    downloadLimit: number;
    /** ADR-029: cache điểm số nguyên (chỉ review VISIBLE) — đưa vào `getProductRatingSummary`. */
    ratingSum: number;
    ratingCount: number;
  };
}

/**
 * ADR-027 §5: dữ liệu trang Xem trước trong Studio — đọc qua `withTenant` nên thấy cả bản nháp của CHÍNH
 * tenant (RLS chặn tenant khác → 404 `PRODUCT_NOT_FOUND`). Chỉ gọi sau `requireTenantMemberPage`. Cố ý KHÔNG
 * trả nguồn giao hàng (`externalUrl`, object key, file) — trang xem trước mô phỏng trang công khai.
 */
export async function getProductPreviewData(tenantId: string, productId: string): Promise<ProductPreviewData> {
  const product = await requireOwnedProduct(tenantId, productId);
  const prisma = getPrismaClient();
  const [tenant, category, coverUrl] = await Promise.all([
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { name: true, slug: true } }),
    product.categoryId ? prisma.documentCategory.findUnique({ where: { id: product.categoryId }, select: { name: true } }) : null,
    getProductCoverUrl(product),
  ]);

  const pricing = calculateOrderPricing(
    [
      {
        productId: product.id,
        title: product.title,
        priceVnd: product.priceVnd,
        salePriceVnd: product.salePriceVnd,
        saleStartsAt: product.saleStartsAt,
        saleEndsAt: product.saleEndsAt,
      },
    ],
    null,
    0,
    new Date(),
  );
  const effectivePriceVnd = pricing.lines[0]?.finalPriceVnd ?? product.priceVnd;

  return {
    tenant: { name: tenant.name, slug: tenant.slug },
    product: {
      id: product.id,
      slug: product.slug,
      title: product.title,
      summary: product.summary,
      description: product.description,
      type: product.type,
      status: product.status,
      categoryName: category?.name ?? null,
      tags: product.tags,
      priceVnd: product.priceVnd,
      effectivePriceVnd,
      onSale: effectivePriceVnd < product.priceVnd,
      coverUrl,
      downloadLimit: product.downloadLimit,
      ratingSum: product.ratingSum,
      ratingCount: product.ratingCount,
    },
  };
}
