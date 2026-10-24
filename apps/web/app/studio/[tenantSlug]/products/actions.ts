"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError, isCloudinaryImageUrl, normalizeProductSummary, type PublishBlock } from "@gieochu/core";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import type { ProductType } from "@gieochu/db";
import { requireTenantMember } from "../../../../lib/tenant";
import { getSystemCloudinaryCloudName } from "../../../../lib/system-cloudinary";
import { signatureError, signatureOk, type CloudinarySignatureResult } from "../../../../lib/cloudinary-signature";
import { createTenantImageUploadSignature } from "../../../../lib/tenant-media";
import {
  addProductExternalLink,
  archiveProduct,
  createProduct,
  deleteProduct,
  ProductNotPublishableError,
  publishProduct,
  RIGHTS_CONFIRMATION_REQUIRED,
  removeProductExternalLink,
  removeProductFile,
  restoreProduct,
  toEditorProductLink,
  unpublishProduct,
  updateProduct,
  updateProductExternalLink,
  type ProductFieldsInput,
} from "../../../../lib/product";

/** A `datetime-local` input's value ("YYYY-MM-DDTHH:mm") has no timezone — it's a wall-clock reading in
 * Asia/Ho_Chi_Minh (§"quy ước code": lưu UTC, hiển thị Asia/Ho_Chi_Minh). Vietnam has no DST (fixed UTC+7),
 * so appending the offset is enough to parse it into the correct UTC instant regardless of server TZ. */
function parseVnDatetimeLocal(value: string): Date {
  return new Date(`${value}:00+07:00`);
}

/**
 * Trạng thái trả về của mọi Server Action sản phẩm (ADR-026 — contract cho editor):
 * - `fieldErrors`: lỗi theo tên field FormData (`title`, `categoryId`, `salePriceVnd`, `url`, `label`...).
 * - `error`: lỗi chung hiển thị ở banner.
 * - `ok`: thao tác thành công. `productId`: id sản phẩm vừa tạo (UI chuyển sang `/studio/[slug]/products/[id]`).
 * - `saved`: "lưu rồi xuất bản" đã lưu xong dù xuất bản bị từ chối.
 * - `publishReasons`: lý do chưa xuất bản được (khớp `publish.reasons` của loader).
 * - `published` (ADR-027, chỉ có khi FormData gửi `visibility` hoặc gọi saveAndPublish): trạng thái sau thao
 *   tác — `true` = đang Công khai (PUBLISHED), `false` = Riêng tư/nháp.
 */
export interface ProductActionState {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  productId?: string;
  saved?: boolean;
  publishReasons?: PublishBlock[];
  published?: boolean;
  deleted?: boolean;
  message?: string;
  /** Chỉ có ở `addProductLinkAction`/`updateProductLinkAction` khi thành công: bản ghi link sau thao tác
   * (`createdAt` là ISO string UTC để serialize qua Server Action). */
  link?: ProductLinkState;
}

export interface ProductLinkState {
  id: string;
  label: string;
  url: string;
  isAllowed: boolean;
  createdAt: string;
}

const PRODUCT_TYPES: ProductType[] = ["TEMPLATE", "SLIDE", "EBOOK", "EXAM", "OTHER"];

/** Mã lỗi AppError -> field FormData tương ứng, để UI hiện lỗi ngay dưới ô nhập. */
const ERROR_FIELD: Record<string, string> = {
  INVALID_SLUG: "slug",
  INVALID_SALE_PRICE: "salePriceVnd",
  CATEGORY_NOT_FOUND: "categoryId",
  CATEGORY_INACTIVE: "categoryId",
  CATEGORY_REQUIRED: "categoryId",
  INVALID_EXTERNAL_URL: "url",
  INVALID_EXTERNAL_LINK_LABEL: "label",
  INVALID_PRODUCT_SUMMARY: "summary",
  INVALID_COVER_IMAGE_URL: "coverImageUrl",
  [RIGHTS_CONFIRMATION_REQUIRED]: "rightsConfirmed",
};

/**
 * ADR-038 mục 7: ô "cam kết bản quyền" gửi qua FormData field `rightsConfirmed` (checkbox → "on"; hoặc "true"/"1").
 * Chỉ có tác dụng khi thao tác này xuất bản sản phẩm (DRAFT/ARCHIVED → PUBLISHED).
 */
function readRightsConfirmed(formData: FormData): boolean {
  const value = formData.get("rightsConfirmed");
  return value === "on" || value === "true" || value === "1";
}

function appErrorToState(error: AppError): ProductActionState {
  if (error instanceof ProductNotPublishableError) {
    return { error: "Sản phẩm chưa đủ điều kiện xuất bản.", publishReasons: error.reasons };
  }
  const field = ERROR_FIELD[error.code];
  return field ? { error: error.message, fieldErrors: { [field]: error.message } } : { error: error.message };
}

function zodToState(error: z.ZodError): ProductActionState {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!fieldErrors[key]) fieldErrors[key] = issue.message;
  }
  return { error: "Vui lòng kiểm tra lại các trường bị lỗi.", fieldErrors };
}

function optionalString(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

const INT_MESSAGE = "Phải là số nguyên không âm.";

const fieldsSchema = z.object({
  title: z.string({ error: "Vui lòng nhập tiêu đề." }).trim().min(1, "Vui lòng nhập tiêu đề.").max(200, "Tiêu đề tối đa 200 ký tự."),
  type: z.enum(PRODUCT_TYPES as [ProductType, ...ProductType[]], { error: "Loại sản phẩm không hợp lệ." }),
  summary: z
    .string()
    .optional()
    .superRefine((value, ctx) => {
      if (value === undefined) return;
      const result = normalizeProductSummary(value);
      if (!result.ok) ctx.addIssue({ code: "custom", message: result.message });
    }),
  description: z.string().optional(),
  coverImageUrl: z
    .string()
    .trim()
    .optional()
    .refine((value) => !value || isCloudinaryImageUrl(value), "Ảnh bìa phải được upload lên Cloudinary."),
  visibility: z.enum(["PUBLIC", "PRIVATE"], { error: "Chế độ hiển thị không hợp lệ." }).optional(),
  categoryId: z.string().trim().max(64).optional(),
  tags: z.string().trim().optional(),
  priceVnd: z.coerce.number({ error: INT_MESSAGE }).int(INT_MESSAGE).min(0, INT_MESSAGE).max(1_000_000_000, "Giá quá lớn.").optional(),
  salePriceVnd: z.coerce.number({ error: INT_MESSAGE }).int(INT_MESSAGE).min(0, INT_MESSAGE).optional(),
  saleStartsAt: z.string().trim().optional(),
  saleEndsAt: z.string().trim().optional(),
  downloadLimit: z.coerce.number({ error: INT_MESSAGE }).int(INT_MESSAGE).min(0, INT_MESSAGE).max(1000, "Tối đa 1000 lượt.").optional(),
});

/** ADR-027 §1: "Công khai" = PUBLISHED, "Riêng tư" = DRAFT. `undefined` = không đổi trạng thái. */
type Visibility = "PUBLIC" | "PRIVATE";

type ParsedFields =
  | { ok: true; value: ProductFieldsInput & { title: string }; visibility: Visibility | undefined }
  | { ok: false; state: ProductActionState };

/**
 * Field FormData dùng chung cho tạo và sửa. Quy ước: field **vắng mặt** trong FormData = giữ nguyên giá trị
 * cũ; field **có mặt nhưng rỗng** = xoá giá trị (trừ `priceVnd`/`downloadLimit` — rỗng = giữ nguyên).
 * `title` (bắt buộc), `type`, `description` (HTML, sanitize server-side), `categoryId`, `tags` (phân tách
 * bằng dấu phẩy), `priceVnd`, `salePriceVnd`, `saleStartsAt`/`saleEndsAt` (datetime-local giờ VN),
 * `downloadLimit` (0 = không giới hạn).
 * ADR-027: `summary` (văn bản thuần ≤300, rỗng = xoá), `coverImageUrl` (URL Cloudinary trả về sau upload,
 * rỗng = xoá ảnh Cloudinary), `visibility` (`PUBLIC` | `PRIVATE`, vắng mặt = không đổi trạng thái).
 */
function parseProductFields(formData: FormData, imageCloudName: string | null): ParsedFields {
  /** undefined = vắng mặt; "" = có mặt nhưng rỗng. */
  const raw = (name: string): string | undefined => (formData.has(name) ? String(formData.get(name) ?? "").trim() : undefined);

  const parsed = fieldsSchema.safeParse({
    title: formData.get("title") ?? undefined,
    type: formData.get("type") ?? "OTHER",
    summary: raw("summary"),
    description: raw("description"),
    coverImageUrl: raw("coverImageUrl"),
    visibility: raw("visibility") || undefined,
    categoryId: raw("categoryId"),
    tags: raw("tags"),
    priceVnd: raw("priceVnd") || undefined,
    salePriceVnd: raw("salePriceVnd") || undefined,
    saleStartsAt: raw("saleStartsAt"),
    saleEndsAt: raw("saleEndsAt"),
    downloadLimit: raw("downloadLimit") || undefined,
  });
  if (!parsed.success) return { ok: false, state: zodToState(parsed.error) };
  const data = parsed.data;

  // ADR-028: zod chỉ kiểm host res.cloudinary.com — ở đây kiểm thêm đúng cloud Cloudinary hệ thống.
  if (data.coverImageUrl && !isCloudinaryImageUrl(data.coverImageUrl, imageCloudName)) {
    const message = "Ảnh bìa phải được upload lên Cloudinary của hệ thống.";
    return { ok: false, state: { error: "Vui lòng kiểm tra lại các trường bị lỗi.", fieldErrors: { coverImageUrl: message } } };
  }

  const toDate = (value: string | undefined): Date | null | undefined =>
    value === undefined ? undefined : value === "" ? null : parseVnDatetimeLocal(value);
  const saleStartsAt = toDate(data.saleStartsAt);
  const saleEndsAt = toDate(data.saleEndsAt);
  if (saleStartsAt && Number.isNaN(saleStartsAt.getTime())) {
    return { ok: false, state: { error: "Thời gian bắt đầu ưu đãi không hợp lệ.", fieldErrors: { saleStartsAt: "Thời gian không hợp lệ." } } };
  }
  if (saleEndsAt && Number.isNaN(saleEndsAt.getTime())) {
    return { ok: false, state: { error: "Thời gian kết thúc ưu đãi không hợp lệ.", fieldErrors: { saleEndsAt: "Thời gian không hợp lệ." } } };
  }
  if (saleStartsAt && saleEndsAt && saleEndsAt <= saleStartsAt) {
    return { ok: false, state: { error: "Thời gian ưu đãi không hợp lệ.", fieldErrors: { saleEndsAt: "Phải sau thời gian bắt đầu." } } };
  }

  // Sanitize server-side — không tin HTML client gửi lên dù chính TiptapEditor sinh ra
  // (paste từ Word/web ngoài vẫn có thể mang theo script/on*-handler/javascript: link).
  // ADR-028 §5: ảnh không thuộc Cloudinary hệ thống bị loại khi lưu.
  const description =
    data.description === undefined ? undefined : data.description ? sanitizeRichTextHtml(data.description, { imageCloudName }) : null;

  const summary = data.summary === undefined ? undefined : normalizeProductSummary(data.summary);

  return {
    ok: true,
    visibility: data.visibility,
    value: {
      title: data.title,
      type: data.type,
      summary: summary === undefined ? undefined : summary.ok ? summary.value : null,
      description,
      coverImageUrl: data.coverImageUrl === undefined ? undefined : data.coverImageUrl || null,
      categoryId: data.categoryId === undefined ? undefined : data.categoryId || null,
      tags:
        data.tags === undefined
          ? undefined
          : data.tags
              .split(",")
              .map((t) => t.trim())
              .filter(Boolean),
      priceVnd: data.priceVnd,
      salePriceVnd: formData.has("salePriceVnd") ? (data.salePriceVnd ?? null) : undefined,
      saleStartsAt,
      saleEndsAt,
      downloadLimit: data.downloadLimit,
    },
  };
}

function revalidateProduct(tenantSlug: string, productId?: string): void {
  revalidatePath(`/studio/${tenantSlug}/products`);
  if (productId) revalidatePath(`/studio/${tenantSlug}/products/${productId}`);
  // ADR-030: trang công khai của tài liệu ở `/{tenantSlug}/{productSlug}` (route pattern — action không có slug) +
  // trang chủ tenant (danh sách tài liệu) sau khi xuất bản/gỡ/sửa.
  revalidatePath("/[tenantSlug]/[productSlug]", "page");
  revalidatePath(`/${tenantSlug}`);
}

/**
 * ADR-026 §5: lần lưu đầu của editor tạo bản NHÁP (nhận đủ field như sửa, thêm `slug` tuỳ chọn) và trả
 * `productId` — UI tự chuyển sang `/studio/[tenantSlug]/products/[productId]` (không redirect server-side
 * để UI giữ được trạng thái/hiệu ứng chuyển trang).
 *
 * ADR-027 §4: `visibility=PUBLIC` → sau khi tạo thử xuất bản (qua `canPublishProduct`). Chưa đủ điều kiện
 * (thường thiếu nguồn giao hàng vì trang Tạo chưa upload được file) → sản phẩm VẪN được tạo ở dạng nháp:
 * `{ ok: true, saved: true, productId, published: false, publishReasons, error }`. Thành công →
 * `{ ok: true, saved: true, productId, published: true }`. `PRIVATE`/vắng mặt → như cũ (`published: false`
 * chỉ khi có gửi `visibility`).
 */
export async function createProductAction(
  tenantSlug: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  const fields = parseProductFields(formData, await getSystemCloudinaryCloudName());
  if (!fields.ok) return fields.state;

  let productId: string;
  try {
    const product = await createProduct(tenant.id, {
      ...fields.value,
      slug: optionalString(formData, "slug")?.trim(),
    });
    productId = product.id;
  } catch (error) {
    if (error instanceof AppError) return appErrorToState(error);
    throw error;
  }

  revalidateProduct(tenantSlug);
  if (fields.visibility === undefined) return { ok: true, productId };
  if (fields.visibility === "PRIVATE") return { ok: true, saved: true, productId, published: false };

  try {
    await publishProduct(tenant.id, productId, user.userId, { rightsConfirmed: readRightsConfirmed(formData) });
  } catch (error) {
    if (error instanceof AppError) {
      return { ...appErrorToState(error), ok: true, saved: true, productId, published: false };
    }
    throw error;
  }
  revalidateProduct(tenantSlug, productId);
  return { ok: true, saved: true, productId, published: true };
}

/**
 * Lưu + áp chế độ hiển thị (ADR-027 §1). `visibility`:
 * - vắng mặt → chỉ lưu, không đổi trạng thái → `{ ok, productId }`.
 * - `PRIVATE` → lưu; sản phẩm đang PUBLISHED thì gỡ xuất bản trong cùng lệnh update (DRAFT/ARCHIVED giữ
 *   nguyên) → `{ ok, saved, productId, published: false }`.
 * - `PUBLIC` → lưu rồi xuất bản nếu đủ điều kiện (đang PUBLISHED = chỉ lưu). Lưu lỗi → không xuất bản.
 *   Lưu xong mà chưa đủ điều kiện → `{ error, saved: true, productId, published: false, publishReasons }`
 *   (không có `ok`, giữ nguyên contract ADR-026 của saveAndPublish).
 */
async function saveWithVisibility(
  tenantSlug: string,
  tenantId: string,
  productId: string,
  formData: FormData,
  forcedVisibility: Visibility | undefined,
  actorId: string,
): Promise<ProductActionState> {
  const fields = parseProductFields(formData, await getSystemCloudinaryCloudName());
  if (!fields.ok) return fields.state;
  const visibility = forcedVisibility ?? fields.visibility;

  let status: string;
  try {
    const product = await updateProduct(tenantId, productId, fields.value, { unpublish: visibility === "PRIVATE" });
    status = product.status;
  } catch (error) {
    if (error instanceof AppError) return appErrorToState(error);
    throw error;
  }
  revalidateProduct(tenantSlug, productId);

  if (visibility === undefined) return { ok: true, productId };
  if (visibility === "PRIVATE") return { ok: true, saved: true, productId, published: status === "PUBLISHED" };

  try {
    await publishProduct(tenantId, productId, actorId, { rightsConfirmed: readRightsConfirmed(formData) });
  } catch (error) {
    if (error instanceof AppError) return { ...appErrorToState(error), saved: true, productId, published: false };
    throw error;
  }
  revalidateProduct(tenantSlug, productId);
  return { ok: true, saved: true, productId, published: true };
}

/** Lưu thông tin sản phẩm (không đổi slug). ADR-027: có `visibility` trong FormData → áp chế độ hiển thị. */
export async function updateProductAction(
  tenantSlug: string,
  productId: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  return saveWithVisibility(tenantSlug, tenant.id, productId, formData, undefined, user.userId);
}

/**
 * "Lưu rồi xuất bản" (ADR-026 §5) — tương đương `updateProductAction` với `visibility=PUBLIC` (giữ lại cho
 * UI cũ). Nếu lưu lỗi → không xuất bản. Lưu xong mà chưa đủ điều kiện → `{ saved: true, publishReasons }`.
 * Gọi trên sản phẩm đã PUBLISHED = chỉ lưu.
 */
export async function saveAndPublishProductAction(
  tenantSlug: string,
  productId: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  return saveWithVisibility(tenantSlug, tenant.id, productId, formData, "PUBLIC", user.userId);
}

/**
 * ADR-027 §3 + ADR-028 — chữ ký upload Cloudinary cho ảnh bìa sản phẩm. Không cần `productId` (dùng được ở trang
 * Tạo). Chỉ thành viên quản lý tenant; public id ngẫu nhiên trong folder `<uploadFolder>/tenants/<tenantId>/products`,
 * định dạng và incoming transformation nằm trong chữ ký nên client không đổi được. Kiểm hạn mức ảnh của gói
 * (`IMAGE_QUOTA_EXCEEDED`). Sau upload: `registerTenantImageAction(tenantSlug, publicId, "PRODUCT_COVER")` → `url`
 * gửi ở field `coverImageUrl` của form Tạo/Sửa.
 */
export async function getProductCoverUploadSignatureAction(tenantSlug: string): Promise<CloudinarySignatureResult> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    return signatureOk(await createTenantImageUploadSignature(tenant.id, "PRODUCT_COVER"));
  } catch (error) {
    return signatureError(error);
  }
}

export async function removeProductFileAction(tenantSlug: string, productId: string, fileId: string): Promise<ProductActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  try {
    await removeProductFile(tenant.id, productId, fileId);
  } catch (error) {
    if (error instanceof AppError) return appErrorToState(error);
    throw error;
  }
  revalidateProduct(tenantSlug, productId);
  return { ok: true };
}

function linkInput(formData: FormData): { label: string; url: string } {
  const label = formData.get("label");
  const url = formData.get("url");
  return { label: typeof label === "string" ? label : "", url: typeof url === "string" ? url : "" };
}

function serializeLink(row: Parameters<typeof toEditorProductLink>[0]): ProductLinkState {
  const link = toEditorProductLink(row);
  return { ...link, createdAt: link.createdAt.toISOString() };
}

/** ADR-026 §3: thêm link tài liệu ngoài. FormData: `label`, `url`. Thành công → `{ ok, link }`. */
export async function addProductLinkAction(
  tenantSlug: string,
  productId: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  let link: ProductLinkState;
  try {
    link = serializeLink(await addProductExternalLink(tenant.id, productId, linkInput(formData)));
  } catch (error) {
    if (error instanceof AppError) return appErrorToState(error);
    throw error;
  }
  revalidateProduct(tenantSlug, productId);
  return { ok: true, link };
}

/** ADR-026 §3: sửa nhãn/URL link. FormData: `label`, `url`. Thành công → `{ ok, link }` (bản ghi sau sửa). */
export async function updateProductLinkAction(
  tenantSlug: string,
  productId: string,
  linkId: string,
  _prevState: ProductActionState,
  formData: FormData,
): Promise<ProductActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  let link: ProductLinkState;
  try {
    link = serializeLink(await updateProductExternalLink(tenant.id, productId, linkId, linkInput(formData)));
  } catch (error) {
    if (error instanceof AppError) return appErrorToState(error);
    throw error;
  }
  revalidateProduct(tenantSlug, productId);
  return { ok: true, link };
}

/** ADR-026 §3: gỡ mềm link (`removedAt`) — khách đã mua không còn thấy link này trong Thư viện. */
export async function removeProductLinkAction(tenantSlug: string, productId: string, linkId: string): Promise<ProductActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  try {
    await removeProductExternalLink(tenant.id, productId, linkId);
  } catch (error) {
    if (error instanceof AppError) return appErrorToState(error);
    throw error;
  }
  revalidateProduct(tenantSlug, productId);
  return { ok: true };
}

async function runStatusAction(
  tenantSlug: string,
  productId: string,
  fn: (tenantId: string, productId: string, actorId: string) => Promise<unknown>,
): Promise<ProductActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  let result: unknown;
  try {
    result = await fn(tenant.id, productId, user.userId);
  } catch (error) {
    if (error instanceof AppError) return appErrorToState(error);
    throw error;
  }
  revalidateProduct(tenantSlug, productId);
  if (result && typeof result === "object" && "isDeleted" in result) {
    const isDeleted = Boolean((result as { isDeleted?: boolean }).isDeleted);
    return { ok: true, deleted: isDeleted, message: (result as { archiveMessage?: string }).archiveMessage };
  }
  return { ok: true };
}

/**
 * Xuất bản từ danh sách/hàng thao tác. ADR-038 mục 7: client phải gửi `{ rightsConfirmed: true }` (ô cam kết bản quyền)
 * — thiếu → `{ error, fieldErrors: { rightsConfirmed } }`. Đang bị khoá kiểm duyệt → `{ error }` (CONTENT_MODERATION_LOCKED).
 */
export async function publishProductAction(
  tenantSlug: string,
  productId: string,
  options?: { rightsConfirmed?: boolean },
): Promise<ProductActionState> {
  const rightsConfirmed = options?.rightsConfirmed === true;
  return runStatusAction(tenantSlug, productId, (tenantId, id, actorId) => publishProduct(tenantId, id, actorId, { rightsConfirmed }));
}

export async function unpublishProductAction(tenantSlug: string, productId: string): Promise<ProductActionState> {
  return runStatusAction(tenantSlug, productId, unpublishProduct);
}

export async function archiveProductAction(tenantSlug: string, productId: string): Promise<ProductActionState> {
  return runStatusAction(tenantSlug, productId, archiveProduct);
}

export async function restoreProductAction(tenantSlug: string, productId: string): Promise<ProductActionState> {
  return runStatusAction(tenantSlug, productId, restoreProduct);
}

/**
 * Xoá vĩnh viễn tài liệu và xoá file dữ liệu trong storage service (MinIO/R2).
 * Chặn xoá tuyệt đối nếu tài liệu đang có người mua hoặc đã mua.
 */
export async function deleteProductAction(tenantSlug: string, productId: string): Promise<ProductActionState> {
  const { tenant, user } = await requireTenantMember(tenantSlug);
  try {
    await deleteProduct(tenant.id, productId, user.userId);
  } catch (error) {
    if (error instanceof AppError) return appErrorToState(error);
    throw error;
  }
  revalidateProduct(tenantSlug, productId);
  return { ok: true, deleted: true, message: "Đã xoá tài liệu và dọn dẹp dữ liệu trong bộ nhớ lưu trữ." };
}
