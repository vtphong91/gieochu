import {
  AppError,
  buildPostExcerpt,
  cloudinaryDeliveryUrl,
  countRichTextImages,
  firstRichTextImageSrc,
  htmlToPlainText,
  isCloudinaryImageUrl,
  normalizePostTitle,
  POST_BODY_MAX_LENGTH,
  POST_MAX_IMAGES,
  STOREFRONT_POSTS_LIMIT_MAX,
  STOREFRONT_POSTS_LIMIT_MIN,
  type StorefrontPostsData,
} from "@gieochu/core";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import { getPrismaClient, withPublic, withTenant, type PostStatus, type ProductStatus } from "@gieochu/db";
import { getPublicProductsByIds, type PublicProduct } from "./storefront";
import { getSystemCloudinaryCloudName } from "./system-cloudinary";
import { assertTenantCanWrite } from "./tenant-write-guard";

/**
 * ADR-029 mục 5–6 (M10b) — bài viết tối giản của tenant (`posts`, bảng L2, RLS tách theo lệnh — migration
 * `rls_m10b_posts`).
 *  - Studio: `withTenant` (đọc/ghi/xoá bài của chính tenant). Mọi thao tác ghi gọi `assertTenantCanWrite` như sản
 *    phẩm (READ_ONLY/LOCKED → `FORBIDDEN`). Tenant chỉ DRAFT ⇄ PUBLISHED; `HIDDEN` do hệ thống đặt (M12) —
 *    trigger `posts_guard_columns` chặn tenant đặt/gỡ, ở đây trả `POST_HIDDEN_LOCKED` sớm.
 *  - Public: `withPublic` — RLS chỉ cho PUBLISHED của tenant không LOCKED (cổng thật); WHERE ở đây chỉ khớp ý nghĩa.
 *  - Nội dung: `sanitizeRichTextHtml` theo cloud Cloudinary hệ thống khi LƯU và lại khi RENDER; ≤6 ảnh (đếm sau
 *    sanitize); `excerpt` văn bản thuần ≤300 sinh từ nội dung.
 *  - Không có hàm nào cho System Admin (§7.9).
 */

export const POST_ERROR_CODES = {
  NOT_FOUND: "POST_NOT_FOUND",
  BODY_REQUIRED: "POST_BODY_REQUIRED",
  BODY_TOO_LONG: "POST_BODY_TOO_LONG",
  TITLE_INVALID: "POST_TITLE_INVALID",
  TOO_MANY_IMAGES: "POST_TOO_MANY_IMAGES",
  PRODUCT_INVALID: "POST_PRODUCT_INVALID",
  HIDDEN_LOCKED: "POST_HIDDEN_LOCKED",
  PIN_CONFLICT: "POST_PIN_CONFLICT",
} as const;

/** Trạng thái tenant tự chọn được. */
export type TenantPostStatus = Extract<PostStatus, "DRAFT" | "PUBLISHED">;

export const TENANT_POSTS_PAGE_SIZE = 20;
export const PUBLIC_POSTS_PAGE_SIZE = 12;
export const PUBLIC_POSTS_PAGE_SIZE_MAX = 30;
/** Chiều rộng ảnh khi render nội dung bài (container-prose 768px × 2 cho màn hình mật độ cao, ≤1600). */
export const POST_BODY_IMAGE_WIDTH = 1536;
/** Chiều rộng ảnh minh hoạ trên thẻ bài viết (danh sách/section). */
export const POST_CARD_IMAGE_WIDTH = 640;
/** Chiều rộng ảnh thu nhỏ trong danh sách bài của Studio. */
export const POST_STUDIO_THUMB_WIDTH = 320;
const PRODUCT_PICKER_MAX = 200;
/** Id cuid2 hợp lệ (chặn chuỗi rác từ URL/FormData trước khi đưa vào truy vấn). */
const ID_PATTERN = /^[a-z0-9]{1,40}$/i;

function postError(code: string, message: string, httpStatus: number): AppError {
  return new AppError({ code, message, httpStatus });
}

function postNotFound(): AppError {
  return postError(POST_ERROR_CODES.NOT_FOUND, "Không tìm thấy bài viết.", 404);
}

function productInvalid(): AppError {
  return postError(POST_ERROR_CODES.PRODUCT_INVALID, "Tài liệu gắn kèm không hợp lệ hoặc không thuộc trang của bạn.", 400);
}

function hiddenLocked(): AppError {
  return postError(
    POST_ERROR_CODES.HIDDEN_LOCKED,
    "Bài viết đang bị ẩn do vi phạm nên không thể chỉnh sửa, đăng lại hay ghim. Bạn vẫn có thể xoá bài.",
    403,
  );
}

export function isValidPostId(value: unknown): value is string {
  return typeof value === "string" && ID_PATTERN.test(value);
}

/** Prisma unique violation (P2002) — partial unique index `posts_tenantId_pinned_key`. */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/** RLS WITH CHECK hoặc trigger `posts_guard_*` từ chối (SQLSTATE 42501). */
function isPermissionDenied(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /row-level security|42501|posts: /i.test(text);
}

async function requireWritableTenant(tenantId: string): Promise<void> {
  const tenant = await getPrismaClient().tenant.findUniqueOrThrow({ where: { id: tenantId }, select: { status: true } });
  assertTenantCanWrite(tenant);
}

interface OwnedPost {
  id: string;
  status: PostStatus;
  productId: string | null;
  publishedAt: Date | null;
}

async function requireOwnedPost(tenantId: string, postId: string): Promise<OwnedPost> {
  if (!isValidPostId(postId)) throw postNotFound();
  const post = await withTenant(tenantId, (tx) =>
    tx.post.findFirst({ where: { id: postId, tenantId }, select: { id: true, status: true, productId: true, publishedAt: true } }),
  );
  if (!post) throw postNotFound();
  return post;
}

// ───────────────────────── Chuẩn hoá nội dung ─────────────────────────

interface PreparedContent {
  body: string;
  excerpt: string;
}

/**
 * Sanitize theo cloud hệ thống (ảnh ngoài bị loại), rồi kiểm: không rỗng (có chữ hoặc ≥1 ảnh), ≤6 ảnh, ≤100k ký tự.
 * Ném AppError `POST_BODY_REQUIRED` / `POST_BODY_TOO_LONG` / `POST_TOO_MANY_IMAGES`.
 */
export async function preparePostBody(rawBody: string): Promise<PreparedContent> {
  if (rawBody.length > POST_BODY_MAX_LENGTH) {
    throw postError(POST_ERROR_CODES.BODY_TOO_LONG, "Nội dung bài viết quá dài.", 400);
  }
  const body = sanitizeRichTextHtml(rawBody, { imageCloudName: await getSystemCloudinaryCloudName() });
  const imageCount = countRichTextImages(body);
  if (imageCount > POST_MAX_IMAGES) {
    throw postError(
      POST_ERROR_CODES.TOO_MANY_IMAGES,
      `Mỗi bài viết có tối đa ${POST_MAX_IMAGES} ảnh (hiện có ${imageCount}). Hãy bớt ảnh rồi lưu lại.`,
      400,
    );
  }
  if (body === "" || (imageCount === 0 && htmlToPlainText(body) === "")) {
    throw postError(POST_ERROR_CODES.BODY_REQUIRED, "Vui lòng nhập nội dung bài viết.", 400);
  }
  if (body.length > POST_BODY_MAX_LENGTH) {
    throw postError(POST_ERROR_CODES.BODY_TOO_LONG, "Nội dung bài viết quá dài.", 400);
  }
  return { body, excerpt: buildPostExcerpt(body) };
}

function prepareTitle(rawTitle: string | null): string | null {
  const title = normalizePostTitle(rawTitle);
  if (!title.ok) throw postError(POST_ERROR_CODES.TITLE_INVALID, title.message, 400);
  return title.value;
}

/** Sản phẩm gắn kèm: phải thuộc tenant (đọc qua withTenant) và chưa lưu trữ. DB trigger là lớp thứ hai. */
async function assertAttachableProduct(tenantId: string, productId: string): Promise<void> {
  if (!isValidPostId(productId)) throw productInvalid();
  const product = await withTenant(tenantId, (tx) =>
    tx.product.findFirst({ where: { id: productId, tenantId }, select: { status: true } }),
  );
  if (!product || product.status === "ARCHIVED") throw productInvalid();
}

// ───────────────────────── Tenant (Studio) — ghi ─────────────────────────

export interface CreatePostInput {
  title: string | null;
  body: string;
  productId: string | null;
  status: TenantPostStatus;
}

export async function createPost(tenantId: string, input: CreatePostInput): Promise<{ id: string; status: PostStatus }> {
  await requireWritableTenant(tenantId);
  const title = prepareTitle(input.title);
  const content = await preparePostBody(input.body);
  if (input.productId) await assertAttachableProduct(tenantId, input.productId);

  try {
    return await withTenant(tenantId, (tx) =>
      tx.post.create({
        data: {
          tenantId,
          title,
          body: content.body,
          excerpt: content.excerpt,
          productId: input.productId,
          status: input.status,
          publishedAt: input.status === "PUBLISHED" ? new Date() : null,
        },
        select: { id: true, status: true },
      }),
    );
  } catch (error) {
    if (isPermissionDenied(error)) throw productInvalid();
    throw error;
  }
}

/** Field `undefined` = giữ nguyên giá trị cũ. */
export interface UpdatePostInput {
  title?: string | null;
  body?: string;
  productId?: string | null;
  status?: TenantPostStatus;
}

export async function updatePost(tenantId: string, postId: string, input: UpdatePostInput): Promise<{ id: string; status: PostStatus }> {
  await requireWritableTenant(tenantId);
  const existing = await requireOwnedPost(tenantId, postId);
  if (existing.status === "HIDDEN") throw hiddenLocked();

  const title = input.title === undefined ? undefined : prepareTitle(input.title);
  const content = input.body === undefined ? undefined : await preparePostBody(input.body);
  // Chỉ kiểm lại sản phẩm khi đổi — bài cũ gắn sản phẩm đã lưu trữ vẫn sửa được nội dung.
  if (input.productId && input.productId !== existing.productId) await assertAttachableProduct(tenantId, input.productId);

  const publishing = input.status === "PUBLISHED";
  try {
    return await withTenant(tenantId, (tx) =>
      tx.post.update({
        where: { id: postId },
        data: {
          ...(title !== undefined ? { title } : {}),
          ...(content ? { body: content.body, excerpt: content.excerpt } : {}),
          ...(input.productId !== undefined ? { productId: input.productId } : {}),
          ...(input.status ? { status: input.status } : {}),
          // Giữ mốc xuất bản đầu tiên khi gỡ về nháp rồi đăng lại.
          ...(publishing && !existing.publishedAt ? { publishedAt: new Date() } : {}),
        },
        select: { id: true, status: true },
      }),
    );
  } catch (error) {
    if (isPermissionDenied(error)) throw productInvalid();
    throw error;
  }
}

export async function deletePost(tenantId: string, postId: string): Promise<void> {
  await requireWritableTenant(tenantId);
  await requireOwnedPost(tenantId, postId);
  await withTenant(tenantId, (tx) => tx.post.deleteMany({ where: { id: postId, tenantId } }));
}

/**
 * Ghim / bỏ ghim. Ghim bài mới tự bỏ ghim bài cũ trong CÙNG transaction (partial unique index
 * `posts_tenantId_pinned_key` là cổng cuối — hai lần ghim đồng thời: lần thua nhận `POST_PIN_CONFLICT`).
 * Ghim được bài ở mọi trạng thái trừ HIDDEN; trang công khai chỉ thấy bài ghim khi bài đó PUBLISHED.
 */
export async function setPostPinned(tenantId: string, postId: string, pinned: boolean): Promise<void> {
  await requireWritableTenant(tenantId);
  const existing = await requireOwnedPost(tenantId, postId);
  if (existing.status === "HIDDEN") throw hiddenLocked();

  try {
    await withTenant(tenantId, async (tx) => {
      if (pinned) {
        await tx.post.updateMany({ where: { tenantId, isPinned: true, id: { not: postId } }, data: { isPinned: false } });
      }
      await tx.post.update({ where: { id: postId }, data: { isPinned: pinned } });
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      throw postError(POST_ERROR_CODES.PIN_CONFLICT, "Có thao tác ghim khác vừa diễn ra — vui lòng tải lại trang và thử lại.", 409);
    }
    throw error;
  }
}

// ───────────────────────── Tenant (Studio) — đọc ─────────────────────────

export interface TenantPostListItem {
  id: string;
  title: string | null;
  excerpt: string;
  status: PostStatus;
  hiddenReason: string | null;
  isPinned: boolean;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
  /** Ảnh Cloudinary (cloud hệ thống) đầu tiên trong nội dung, tối ưu rộng 320; null nếu không có. */
  imageUrl: string | null;
  /** Sản phẩm gắn kèm (mọi trạng thái — tenant thấy sản phẩm của mình); null = không gắn / đã bị xoá. */
  product: { id: string; title: string; status: ProductStatus } | null;
}

/** Studio → Bài viết: bài ghim trước, rồi mới tạo trước; cursor = id mục cuối trang trước. */
export async function listTenantPosts(
  tenantId: string,
  filter: { status?: PostStatus } = {},
  cursor?: string | null,
): Promise<{ items: TenantPostListItem[]; nextCursor: string | null }> {
  const validCursor = cursor && isValidPostId(cursor) ? cursor : null;
  const rows = await withTenant(tenantId, (tx) =>
    tx.post.findMany({
      where: { tenantId, ...(filter.status ? { status: filter.status } : {}) },
      select: {
        id: true,
        title: true,
        excerpt: true,
        status: true,
        hiddenReason: true,
        isPinned: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        body: true,
        product: { select: { id: true, title: true, status: true } },
      },
      orderBy: [{ isPinned: "desc" }, { createdAt: "desc" }, { id: "desc" }],
      take: TENANT_POSTS_PAGE_SIZE + 1,
      ...(validCursor ? { cursor: { id: validCursor }, skip: 1 } : {}),
    }),
  );
  const page = rows.slice(0, TENANT_POSTS_PAGE_SIZE);
  const cloudName = page.length > 0 ? await getSystemCloudinaryCloudName() : null;
  return {
    items: page.map(({ body, ...item }) => ({ ...item, imageUrl: firstPostImageUrl(body, cloudName, POST_STUDIO_THUMB_WIDTH) })),
    nextCursor: rows.length > TENANT_POSTS_PAGE_SIZE ? (page[page.length - 1]?.id ?? null) : null,
  };
}

export interface PostProductOption {
  id: string;
  title: string;
  status: ProductStatus;
}

/** Ô chọn "Gắn tài liệu" trong editor bài viết: sản phẩm chưa lưu trữ của tenant (mới cập nhật trước). */
export async function listPostProductOptions(tenantId: string): Promise<PostProductOption[]> {
  return withTenant(tenantId, (tx) =>
    tx.product.findMany({
      where: { tenantId, status: { not: "ARCHIVED" } },
      select: { id: true, title: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: PRODUCT_PICKER_MAX,
    }),
  );
}

export interface PostEditorData {
  post: {
    id: string;
    title: string | null;
    /** HTML đã sanitize lúc lưu — nạp thẳng vào TiptapEditor. */
    body: string;
    /**
     * `body` sanitize LẠI lúc đọc theo cloud hệ thống (lớp phòng thủ thứ hai, giống `getPublishedPost`) — dùng khi
     * render HTML trực tiếp (vd xem bài HIDDEN) bằng dangerouslySetInnerHTML. Không nạp vào editor.
     */
    bodyHtml: string;
    excerpt: string;
    productId: string | null;
    status: PostStatus;
    hiddenReason: string | null;
    isPinned: boolean;
    publishedAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  };
  /** `listPostProductOptions` + sản phẩm đang gắn (kể cả đã lưu trữ) để ô chọn hiển thị đúng giá trị hiện tại. */
  productOptions: PostProductOption[];
}

/** Editor bài viết (Studio). Không có / không thuộc tenant → `POST_NOT_FOUND` (404). */
export async function getPostForEditor(tenantId: string, postId: string): Promise<PostEditorData> {
  if (!isValidPostId(postId)) throw postNotFound();
  const [post, options] = await Promise.all([
    withTenant(tenantId, (tx) =>
      tx.post.findFirst({
        where: { id: postId, tenantId },
        select: {
          id: true,
          title: true,
          body: true,
          excerpt: true,
          productId: true,
          status: true,
          hiddenReason: true,
          isPinned: true,
          publishedAt: true,
          createdAt: true,
          updatedAt: true,
          product: { select: { id: true, title: true, status: true } },
        },
      }),
    ),
    listPostProductOptions(tenantId),
  ]);
  if (!post) throw postNotFound();
  const { product, ...rest } = post;
  const productOptions = product && !options.some((o) => o.id === product.id) ? [product, ...options] : options;
  const bodyHtml = sanitizeRichTextHtml(rest.body, { imageCloudName: await getSystemCloudinaryCloudName(), imageWidth: POST_BODY_IMAGE_WIDTH });
  return { post: { ...rest, bodyHtml }, productOptions };
}

// ───────────────────────── Public (trang hệ thống ADR-025 + section storefront) ─────────────────────────

/** Thẻ sản phẩm gắn trong bài — chỉ khi sản phẩm còn PUBLISHED; giá/ảnh bìa hiệu lực tính ở server. */
export type PublicPostProduct = Pick<PublicProduct, "id" | "slug" | "title" | "priceVnd" | "effectivePriceVnd" | "onSale" | "coverUrl">;

export interface PublicPostSummary {
  id: string;
  title: string | null;
  /** Văn bản thuần ≤300 ký tự; "" = bài chỉ có ảnh. */
  excerpt: string;
  /** Ảnh đầu tiên trong bài (URL Cloudinary đã tối ưu, rộng 640) hoặc null. */
  imageUrl: string | null;
  isPinned: boolean;
  publishedAt: Date;
  product: PublicPostProduct | null;
}

export interface PublicPostDetail extends Omit<PublicPostSummary, "imageUrl"> {
  /** HTML đã sanitize LẠI lúc render (ảnh viết lại qua transformation tối ưu) — render bằng dangerouslySetInnerHTML. */
  bodyHtml: string;
  updatedAt: Date;
}

const PUBLIC_POST_SUMMARY_SELECT = {
  id: true,
  title: true,
  excerpt: true,
  body: true,
  isPinned: true,
  publishedAt: true,
  productId: true,
} as const;

interface PublicPostRow {
  id: string;
  title: string | null;
  excerpt: string;
  body: string;
  isPinned: boolean;
  publishedAt: Date | null;
  productId: string | null;
}

function toPublicPostProduct(product: PublicProduct): PublicPostProduct {
  return {
    id: product.id,
    slug: product.slug,
    title: product.title,
    priceVnd: product.priceVnd,
    effectivePriceVnd: product.effectivePriceVnd,
    onSale: product.onSale,
    coverUrl: product.coverUrl,
  };
}

async function loadPostProducts(tenantId: string, rows: readonly PublicPostRow[]): Promise<Map<string, PublicPostProduct>> {
  const ids = rows.map((r) => r.productId).filter((id): id is string => Boolean(id));
  const products = await getPublicProductsByIds(tenantId, ids);
  return new Map(products.map((p) => [p.id, toPublicPostProduct(p)]));
}

/** Ảnh ĐẦU TIÊN đúng cloud hệ thống trong nội dung (bỏ qua ảnh không hợp lệ) → URL tối ưu (f_auto,q_auto,c_limit,w_N); ngược lại null. */
function firstPostImageUrl(body: string, cloudName: string | null, width: number): string | null {
  const src = firstRichTextImageSrc(body, (candidate) => isCloudinaryImageUrl(candidate, cloudName));
  return src ? cloudinaryDeliveryUrl(src, { width }) : null;
}

async function toPublicSummaries(tenantId: string, rows: readonly PublicPostRow[]): Promise<PublicPostSummary[]> {
  if (rows.length === 0) return [];
  const [products, cloudName] = await Promise.all([loadPostProducts(tenantId, rows), getSystemCloudinaryCloudName()]);
  return rows.map((row) => {
    return {
      id: row.id,
      title: row.title,
      excerpt: row.excerpt,
      imageUrl: firstPostImageUrl(row.body, cloudName, POST_CARD_IMAGE_WIDTH),
      isPinned: row.isPinned,
      // CHECK posts_published_at_shape: PUBLISHED luôn có publishedAt.
      publishedAt: row.publishedAt ?? new Date(0),
      product: row.productId ? (products.get(row.productId) ?? null) : null,
    };
  });
}

function clampLimit(value: number | undefined, fallback: number, min: number, max: number): number {
  const n = Math.trunc(value ?? fallback);
  return Math.min(Math.max(Number.isFinite(n) ? n : fallback, min), max);
}

/**
 * Danh sách bài PUBLISHED (mới đăng trước). `pinnedFirst`: trang đầu (không cursor) đặt bài ghim lên đầu và luồng
 * còn lại bỏ bài ghim để không trùng; cursor = id bài (không ghim) cuối trang trước.
 */
async function queryPublishedPosts(
  tenantId: string,
  options: { cursor: string | null; limit: number; pinnedFirst: boolean },
): Promise<{ rows: PublicPostRow[]; nextCursor: string | null }> {
  const { cursor, limit, pinnedFirst } = options;
  return withPublic(async (tx) => {
    const pinned =
      pinnedFirst && !cursor
        ? await tx.post.findFirst({ where: { tenantId, status: "PUBLISHED", isPinned: true }, select: PUBLIC_POST_SUMMARY_SELECT })
        : null;
    // Luôn lấy ≥1 bài không ghim để cursor trang sau có điểm neo (limit = 1 + có bài ghim → trang đầu có 2 bài).
    const take = Math.max(limit - (pinned ? 1 : 0), 1);
    const rest = await tx.post.findMany({
      where: { tenantId, status: "PUBLISHED", ...(pinnedFirst ? { isPinned: false } : {}) },
      select: PUBLIC_POST_SUMMARY_SELECT,
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    const page = rest.slice(0, take);
    return {
      rows: pinned ? [pinned, ...page] : page,
      nextCursor: rest.length > take ? (page[page.length - 1]?.id ?? null) : null,
    };
  });
}

/** `/[tenantSlug]/posts`: bài ghim đứng đầu trang 1; mặc định 12 bài/trang (tối đa 30). */
export async function listPublishedPosts(
  tenantId: string,
  cursor?: string | null,
  limit?: number,
): Promise<{ items: PublicPostSummary[]; nextCursor: string | null }> {
  const validCursor = cursor && isValidPostId(cursor) ? cursor : null;
  const { rows, nextCursor } = await queryPublishedPosts(tenantId, {
    cursor: validCursor,
    limit: clampLimit(limit, PUBLIC_POSTS_PAGE_SIZE, 1, PUBLIC_POSTS_PAGE_SIZE_MAX),
    pinnedFirst: true,
  });
  return { items: await toPublicSummaries(tenantId, rows), nextCursor };
}

/** Section `posts` trên storefront (ADR-023): `limit` 3–9; rỗng → trang không render section. */
export async function getStorefrontPosts(tenantId: string, data: StorefrontPostsData): Promise<PublicPostSummary[]> {
  const { rows } = await queryPublishedPosts(tenantId, {
    cursor: null,
    limit: clampLimit(data.limit, STOREFRONT_POSTS_LIMIT_MIN, STOREFRONT_POSTS_LIMIT_MIN, STOREFRONT_POSTS_LIMIT_MAX),
    pinnedFirst: data.showPinnedFirst,
  });
  return toPublicSummaries(tenantId, rows);
}

/** `/[tenantSlug]/posts/[postId]`: null khi không có / không PUBLISHED / tenant LOCKED (RLS) → trang gọi notFound(). */
export async function getPublishedPost(tenantId: string, postId: string): Promise<PublicPostDetail | null> {
  if (!isValidPostId(postId)) return null;
  const row = await withPublic((tx) =>
    tx.post.findFirst({
      where: { id: postId, tenantId, status: "PUBLISHED" },
      select: { ...PUBLIC_POST_SUMMARY_SELECT, updatedAt: true },
    }),
  );
  if (!row) return null;
  const [products, cloudName] = await Promise.all([loadPostProducts(tenantId, [row]), getSystemCloudinaryCloudName()]);
  return {
    id: row.id,
    title: row.title,
    excerpt: row.excerpt,
    bodyHtml: sanitizeRichTextHtml(row.body, { imageCloudName: cloudName, imageWidth: POST_BODY_IMAGE_WIDTH }),
    isPinned: row.isPinned,
    publishedAt: row.publishedAt ?? new Date(0),
    updatedAt: row.updatedAt,
    product: row.productId ? (products.get(row.productId) ?? null) : null,
  };
}

/** `generateMetadata` của trang chi tiết: truy vấn nhẹ (không đọc body). null = không công khai. */
export async function getPublishedPostMeta(tenantId: string, postId: string): Promise<{ title: string | null; excerpt: string } | null> {
  if (!isValidPostId(postId)) return null;
  return withPublic((tx) =>
    tx.post.findFirst({ where: { id: postId, tenantId, status: "PUBLISHED" }, select: { title: true, excerpt: true } }),
  );
}

/** Tiêu đề hiển thị/metadata: tiêu đề bài, không có thì ~60 ký tự đầu của trích đoạn, không có nữa thì "Bài viết". */
export function postDisplayTitle(post: { title: string | null; excerpt: string }): string {
  if (post.title) return post.title;
  const chars = Array.from(post.excerpt);
  if (chars.length === 0) return "Bài viết";
  return chars.length > 60 ? `${chars.slice(0, 59).join("").trimEnd()}…` : post.excerpt;
}
