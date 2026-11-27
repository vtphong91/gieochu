import {
  AppError,
  computeRatingAverage,
  formatReviewerDisplayName,
  isTenantReviewHideReason,
  logger,
  normalizeReviewText,
  parseReviewRating,
  rateLimited,
  REVIEW_BODY_MAX_LENGTH,
  REVIEW_REPLY_MAX_LENGTH,
  STOREFRONT_REVIEWS_LIMIT_MAX,
  type StorefrontReviewsData,
  type TenantReviewHideReason,
} from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import {
  getPrismaClient,
  withCustomer,
  withPublic,
  withSystemJob,
  withTenant,
  type ReviewHiddenReason,
  type ReviewStatus,
  type Tx,
} from "@gieochu/db";
import { renderNewReviewEmail } from "@gieochu/email";
import { sendEmailNow } from "./email-dispatch";
import { checkRateLimit } from "./rate-limit";
import { audit } from "./audit";
import { contentModerationLocked } from "./moderation";

/**
 * ADR-029 (M10a) — đánh giá sản phẩm (`reviews`, bảng L2 có RLS tách theo lệnh, migration `rls_m10a_reviews`).
 *  - Khách: `withCustomer` (RLS INSERT/UPDATE đòi đơn FULFILLED + entitlement chưa thu hồi — kiểm lại ở đây trước
 *    để trả lỗi rõ ràng; DB là cổng thật). Trigger `reviews_guard_columns` chặn khách đổi cột kiểm duyệt/trả lời.
 *  - Tenant (Studio): `withTenant` — chỉ ẩn/khôi phục/trả lời (trigger chặn đổi nội dung của khách).
 *  - Public: `withPublic` — chỉ VISIBLE của sản phẩm PUBLISHED.
 *  - Điểm cache `products.ratingSum/ratingCount`: `recomputeProductRatings` dưới `withSystemJob`, luôn SUM/COUNT
 *    lại toàn phần (idempotent). Không có hàm nào cho System Admin (§7.9).
 */

export const REVIEW_ERROR_CODES = {
  NOT_ELIGIBLE: "REVIEW_NOT_ELIGIBLE",
  NOT_FOUND: "REVIEW_NOT_FOUND",
  ALREADY_EXISTS: "REVIEW_ALREADY_EXISTS",
  REFUNDED_LOCKED: "REVIEW_REFUNDED_LOCKED",
  INVALID_REASON: "REVIEW_INVALID_HIDE_REASON",
} as const;

const WRITE_LIMIT = 5;
const WRITE_WINDOW_MS = 10 * 60 * 1000;

export const PRODUCT_REVIEWS_PAGE_SIZE = 10;
export const PRODUCT_REVIEWS_PAGE_SIZE_MAX = 50;
export const TENANT_REVIEWS_PAGE_SIZE = 20;
const STOREFRONT_REVIEW_PICKER_MAX = 200;

function reviewNotFound(): AppError {
  return new AppError({ code: REVIEW_ERROR_CODES.NOT_FOUND, message: "Không tìm thấy đánh giá.", httpStatus: 404 });
}

function notEligible(): AppError {
  return new AppError({
    code: REVIEW_ERROR_CODES.NOT_ELIGIBLE,
    message: "Chỉ khách đã mua và đang sở hữu tài liệu này mới đánh giá được.",
    httpStatus: 403,
  });
}

function validationError(message: string): AppError {
  return new AppError({ code: "VALIDATION_ERROR", message, httpStatus: 400 });
}

/** Prisma unique violation (P2002). */
function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/** RLS WITH CHECK hoặc trigger `reviews_guard_columns` từ chối (SQLSTATE 42501). */
function isPermissionDenied(error: unknown): boolean {
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /row-level security|42501|reviews: /i.test(text);
}

// ───────────────────────── Điểm trung bình ─────────────────────────

/**
 * ADR-029 mục 3: tính lại `ratingSum/ratingCount` từ review VISIBLE (SUM/COUNT toàn phần → idempotent, không cộng
 * dồn). Chạy dưới `system_job` vì customer/public không có quyền UPDATE `products` (ADR-029 mục 0). Advisory lock
 * theo sản phẩm tuần tự hoá các lần tính lại đồng thời để lần cuối luôn thấy mọi đánh giá đã commit. Raw SQL để
 * không chạm `products.updatedAt`. Lỗi chỉ log — đánh giá đã lưu; lần ghi sau sẽ tự sửa cache.
 */
export async function recomputeProductRatings(productIds: readonly string[]): Promise<void> {
  for (const productId of new Set(productIds)) {
    try {
      await withSystemJob(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`product-rating:${productId}`}))`;
        await tx.$executeRaw`
          UPDATE "products" SET
            "ratingSum" = COALESCE((SELECT SUM("rating") FROM "reviews" WHERE "productId" = ${productId} AND "status" = 'VISIBLE'), 0),
            "ratingCount" = (SELECT COUNT(*) FROM "reviews" WHERE "productId" = ${productId} AND "status" = 'VISIBLE')
          WHERE "id" = ${productId}
        `;
      });
    } catch (error) {
      logger.error({ err: error, productId }, "review: tính lại điểm sản phẩm thất bại");
    }
  }
}

// ───────────────────────── Khách hàng ─────────────────────────

export interface MyReview {
  id: string;
  productId: string;
  rating: number;
  body: string | null;
  displayName: string;
  status: ReviewStatus;
  /** Chỉ có khi `status = HIDDEN` — người viết thấy nhãn "đã bị ẩn". */
  hiddenReason: ReviewHiddenReason | null;
  reply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MY_REVIEW_SELECT = {
  id: true,
  productId: true,
  rating: true,
  body: true,
  displayName: true,
  status: true,
  hiddenReason: true,
  reply: true,
  repliedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

export interface ReviewEligibility {
  /** Khách đang có quyền viết/sửa (đơn FULFILLED + entitlement chưa thu hồi). */
  canReview: boolean;
  /** Đánh giá hiện có của khách cho sản phẩm (kể cả HIDDEN), null = chưa viết. */
  existing: MyReview | null;
  /** Tên sẽ hiển thị công khai nếu gửi bây giờ ("Minh N."). */
  displayNamePreview: string;
}

interface EligibleItem {
  orderItemId: string;
  tenantId: string;
}

/** Dòng đơn chứng minh quyền đánh giá: entitlement chưa thu hồi của chính khách, đơn FULFILLED (mới nhất). */
async function findEligibleItem(tx: Tx, userId: string, productId: string): Promise<EligibleItem | null> {
  const entitlement = await tx.entitlement.findFirst({
    where: { userId, productId, revokedAt: null, orderItem: { order: { status: "FULFILLED", customerId: userId } } },
    select: { orderItemId: true, tenantId: true },
    orderBy: { createdAt: "desc" },
  });
  return entitlement;
}

async function loadDisplayName(userId: string): Promise<string> {
  // user_profiles là bảng L1 (không RLS) — đọc trực tiếp như các luồng hồ sơ khác.
  const profile = await getPrismaClient().userProfile.findUnique({ where: { userId }, select: { fullName: true } });
  return formatReviewerDisplayName(profile?.fullName);
}

export async function getReviewEligibility(userId: string, productId: string): Promise<ReviewEligibility> {
  const [state, displayNamePreview] = await Promise.all([
    withCustomer(userId, async (tx) => {
      const [item, existing] = await Promise.all([
        findEligibleItem(tx, userId, productId),
        tx.review.findUnique({ where: { productId_userId: { productId, userId } }, select: MY_REVIEW_SELECT }),
      ]);
      return { canReview: item !== null, existing };
    }),
    loadDisplayName(userId),
  ]);
  return { ...state, displayNamePreview };
}

export interface UpsertMyReviewInput {
  rating: unknown;
  body: unknown;
}

export interface UpsertMyReviewResult {
  review: MyReview;
  created: boolean;
  tenantId: string;
}

/**
 * Tạo hoặc sửa đánh giá của chính khách (1 đánh giá/khách/sản phẩm — unique `productId+userId`). Sửa cập nhật
 * `orderItemId` về dòng đơn đang đủ điều kiện và làm mới `displayName`. Đánh giá đang HIDDEN(REFUNDED) mà khách
 * đã mua lại (đủ điều kiện trở lại) → khôi phục VISIBLE (lý do ẩn không còn đúng). Ẩn do tenant thì giữ nguyên.
 */
export async function upsertMyReview(userId: string, productId: string, input: UpsertMyReviewInput): Promise<UpsertMyReviewResult> {
  const rating = parseReviewRating(input.rating);
  if (rating === null) throw validationError("Vui lòng chọn số sao từ 1 đến 5.");
  const body = normalizeReviewText(typeof input.body === "string" ? input.body : "", REVIEW_BODY_MAX_LENGTH, "Nội dung đánh giá");
  if (!body.ok) throw validationError(body.message);

  if (!checkRateLimit(`review-write:${userId}`, WRITE_LIMIT, WRITE_WINDOW_MS)) {
    throw rateLimited("Bạn đã gửi/sửa đánh giá khá nhiều lần trong ít phút. Vui lòng thử lại sau khoảng 10 phút nhé.");
  }

  const displayName = await loadDisplayName(userId);

  let outcome: { review: MyReview; created: boolean; tenantId: string; restoreRefunded: boolean };
  try {
    outcome = await withCustomer(userId, async (tx) => {
      const item = await findEligibleItem(tx, userId, productId);
      if (!item) throw notEligible();
      // ADR-040: chỉ gian hàng ACTIVE nhận đánh giá mới/sửa đánh giá (tenants là L1, không RLS).
      const tenant = await tx.tenant.findUnique({ where: { id: item.tenantId }, select: { status: true } });
      if (!tenant || tenant.status !== "ACTIVE") {
        throw new AppError({ code: "TENANT_NOT_ACTIVE", message: "Gian hàng đang tạm ngưng hoạt động.", httpStatus: 409 });
      }

      const existing = await tx.review.findUnique({
        where: { productId_userId: { productId, userId } },
        select: { id: true, status: true, hiddenReason: true, moderationLockedAt: true },
      });
      if (existing) {
        const review = await tx.review.update({
          where: { id: existing.id },
          data: { rating, body: body.value, displayName, orderItemId: item.orderItemId },
          select: MY_REVIEW_SELECT,
        });
        // ADR-038: đánh giá đang bị khoá kiểm duyệt không tự hiện lại khi khách mua lại.
        const restoreRefunded = existing.status === "HIDDEN" && existing.hiddenReason === "REFUNDED" && existing.moderationLockedAt === null;
        return { review, created: false, tenantId: item.tenantId, restoreRefunded };
      }

      const review = await tx.review.create({
        data: { tenantId: item.tenantId, productId, userId, orderItemId: item.orderItemId, rating, body: body.value, displayName },
        select: MY_REVIEW_SELECT,
      });
      return { review, created: true, tenantId: item.tenantId, restoreRefunded: false };
    });
  } catch (error) {
    if (error instanceof AppError) throw error;
    if (isUniqueViolation(error)) {
      throw new AppError({ code: REVIEW_ERROR_CODES.ALREADY_EXISTS, message: "Bạn đã đánh giá tài liệu này. Vui lòng tải lại trang để sửa.", httpStatus: 409 });
    }
    if (isPermissionDenied(error)) throw notEligible();
    throw error;
  }

  let review = outcome.review;
  if (outcome.restoreRefunded) {
    review = await withSystemJob((tx) =>
      tx.review.update({
        where: { id: review.id },
        data: { status: "VISIBLE", hiddenReason: null, hiddenAt: null },
        select: MY_REVIEW_SELECT,
      }),
    );
    logger.info({ reviewId: review.id, productId }, "REVIEW_RESTORED_AFTER_REPURCHASE");
    await audit.log({
      actorId: userId,
      scope: "CUSTOMER",
      tenantId: outcome.tenantId,
      action: "REVIEW_RESTORED",
      targetType: "Review",
      targetId: review.id,
      metadata: { productId, reason: "REPURCHASE" },
    });
  }

  await recomputeProductRatings([productId]);
  return { review, created: outcome.created, tenantId: outcome.tenantId };
}

/** Khách tự xoá đánh giá của mình (xoá thật) rồi tính lại điểm. */
export async function deleteMyReview(userId: string, reviewId: string): Promise<{ productId: string }> {
  const productId = await withCustomer(userId, async (tx) => {
    const review = await tx.review.findFirst({ where: { id: reviewId, userId }, select: { productId: true } });
    if (!review) throw reviewNotFound();
    const result = await tx.review.deleteMany({ where: { id: reviewId, userId } });
    if (result.count === 0) throw reviewNotFound();
    return review.productId;
  });
  await recomputeProductRatings([productId]);
  return { productId };
}

/**
 * Email báo chủ tenant có đánh giá mới — gọi trong `after()` sau khi đã lưu; lỗi chỉ log, không ném. Loại
 * `review_new` không ghi EmailSendLog (§7.9, xem email-dispatch.ts). Không email cho khách ở GĐ1 (ADR-029).
 */
export async function notifyTenantOwnerOfReview(input: { tenantId: string; productId: string; reviewId: string }): Promise<void> {
  try {
    const prisma = getPrismaClient();
    const tenant = await prisma.tenant.findUnique({
      where: { id: input.tenantId },
      select: { name: true, slug: true, owner: { select: { email: true } } },
    });
    if (!tenant) return;
    const review = await withTenant(input.tenantId, (tx) =>
      tx.review.findFirst({
        where: { id: input.reviewId, tenantId: input.tenantId },
        select: { rating: true, body: true, displayName: true, product: { select: { title: true } } },
      }),
    );
    if (!review) return;
    const manageUrl = `${getEnv().APP_URL.replace(/\/+$/, "")}/studio/${tenant.slug}/reviews`;
    const rendered = renderNewReviewEmail({
      tenantName: tenant.name,
      productTitle: review.product.title,
      rating: review.rating,
      displayName: review.displayName,
      body: review.body,
      manageUrl,
    });
    const result = await sendEmailNow({ type: "review_new", to: tenant.owner.email, ...rendered }, { tenantId: input.tenantId });
    if (!result.ok) logger.warn({ tenantId: input.tenantId, error: result.error }, "review: gửi email báo chủ trang thất bại");
  } catch (error) {
    logger.warn({ tenantId: input.tenantId, err: error }, "review: lỗi khi gửi email báo chủ trang");
  }
}

/** Trạng thái đánh giá theo sản phẩm cho Thư viện khách (1 truy vấn, dưới scope customer). */
export async function getMyReviewsByProduct(
  userId: string,
  productIds: readonly string[],
): Promise<Map<string, { id: string; rating: number; status: ReviewStatus }>> {
  if (productIds.length === 0) return new Map();
  const rows = await withCustomer(userId, (tx) =>
    tx.review.findMany({ where: { userId, productId: { in: [...new Set(productIds)] } }, select: { id: true, productId: true, rating: true, status: true } }),
  );
  return new Map(rows.map((r) => [r.productId, { id: r.id, rating: r.rating, status: r.status }]));
}

// ───────────────────────── Tenant (Studio) ─────────────────────────

export interface TenantReviewFilter {
  status?: ReviewStatus;
  productId?: string;
  rating?: number;
}

export interface TenantReviewItem {
  id: string;
  productId: string;
  productTitle: string;
  productSlug: string;
  rating: number;
  body: string | null;
  displayName: string;
  status: ReviewStatus;
  hiddenReason: ReviewHiddenReason | null;
  hiddenAt: Date | null;
  reply: string | null;
  repliedAt: Date | null;
  /** ADR-038: khác null = admin đã ẩn do vi phạm — tenant không bỏ ẩn được (UI hiện nhãn "Bị khoá kiểm duyệt"). */
  moderationLockedAt: Date | null;
  /** Nhãn loại vi phạm (không chứa danh tính người báo cáo). */
  moderationReason: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Studio → Đánh giá: mới nhất trước, cursor = id của mục cuối trang trước. */
export async function listTenantReviews(
  tenantId: string,
  filter: TenantReviewFilter = {},
  cursor?: string | null,
): Promise<{ items: TenantReviewItem[]; nextCursor: string | null }> {
  const rating = filter.rating !== undefined ? parseReviewRating(filter.rating) : null;
  const rows = await withTenant(tenantId, (tx) =>
    tx.review.findMany({
      where: {
        tenantId,
        ...(filter.status ? { status: filter.status } : {}),
        ...(filter.productId ? { productId: filter.productId } : {}),
        ...(rating !== null ? { rating } : {}),
      },
      select: {
        id: true,
        productId: true,
        rating: true,
        body: true,
        displayName: true,
        status: true,
        hiddenReason: true,
        hiddenAt: true,
        reply: true,
        repliedAt: true,
        moderationLockedAt: true,
        moderationReason: true,
        createdAt: true,
        updatedAt: true,
        product: { select: { title: true, slug: true } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: TENANT_REVIEWS_PAGE_SIZE + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  );
  const page = rows.slice(0, TENANT_REVIEWS_PAGE_SIZE);
  return {
    items: page.map(({ product, ...r }) => ({ ...r, productTitle: product.title, productSlug: product.slug })),
    nextCursor: rows.length > TENANT_REVIEWS_PAGE_SIZE ? (page[page.length - 1]?.id ?? null) : null,
  };
}

/** Badge sidebar Studio "Đánh giá (N)": số đánh giá VISIBLE của tenant chưa có trả lời. */
export async function countReviewsNeedingAttention(tenantId: string): Promise<number> {
  return withTenant(tenantId, (tx) => tx.review.count({ where: { tenantId, status: "VISIBLE", reply: null } }));
}

/** Ô "Đánh giá mới" ở Tổng quan Studio: số đánh giá tạo trong 7 ngày gần nhất (mọi trạng thái). */
export async function countNewTenantReviews(tenantId: string, days = 7): Promise<number> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return withTenant(tenantId, (tx) => tx.review.count({ where: { tenantId, createdAt: { gte: since } } }));
}

/** Trả lời (1 trả lời/đánh giá, sửa được). Chuỗi rỗng = xoá trả lời. */
export async function replyToReview(tenantId: string, reviewId: string, replyInput: string): Promise<void> {
  const reply = normalizeReviewText(replyInput, REVIEW_REPLY_MAX_LENGTH, "Nội dung trả lời");
  if (!reply.ok) throw validationError(reply.message);
  const result = await withTenant(tenantId, (tx) =>
    tx.review.updateMany({
      where: { id: reviewId, tenantId },
      data: { reply: reply.value, repliedAt: reply.value ? new Date() : null },
    }),
  );
  if (result.count === 0) throw reviewNotFound();
}

/** Ẩn với lý do bắt buộc (không nhận REFUNDED). Đánh giá đã ẩn do hoàn tiền không đổi lý do được. */
export async function hideReview(tenantId: string, reviewId: string, reason: unknown, actorId: string | null = null): Promise<void> {
  if (!isTenantReviewHideReason(reason)) {
    throw new AppError({ code: REVIEW_ERROR_CODES.INVALID_REASON, message: "Vui lòng chọn lý do ẩn đánh giá.", httpStatus: 400 });
  }
  const hideReason: TenantReviewHideReason = reason;
  const productId = await withTenant(tenantId, async (tx) => {
    const review = await tx.review.findFirst({ where: { id: reviewId, tenantId }, select: { productId: true, hiddenReason: true, moderationLockedAt: true } });
    if (!review) throw reviewNotFound();
    if (review.moderationLockedAt) throw contentModerationLocked();
    if (review.hiddenReason === "REFUNDED") throw refundedLocked();
    await tx.review.updateMany({ where: { id: reviewId, tenantId }, data: { status: "HIDDEN", hiddenReason: hideReason, hiddenAt: new Date() } });
    return review.productId;
  });
  await audit.log({
    actorId,
    scope: "TENANT",
    tenantId,
    action: "REVIEW_HIDDEN",
    targetType: "Review",
    targetId: reviewId,
    metadata: { productId, reason: hideReason },
  });
  await recomputeProductRatings([productId]);
}

function refundedLocked(): AppError {
  return new AppError({
    code: REVIEW_ERROR_CODES.REFUNDED_LOCKED,
    message: "Đánh giá này đã tự ẩn vì đơn hàng được hoàn tiền / thu hồi quyền tải.",
    httpStatus: 409,
  });
}

export async function unhideReview(tenantId: string, reviewId: string, actorId: string | null = null): Promise<void> {
  const productId = await withTenant(tenantId, async (tx) => {
    const review = await tx.review.findFirst({
      where: { id: reviewId, tenantId },
      select: { productId: true, status: true, hiddenReason: true, moderationLockedAt: true },
    });
    if (!review) throw reviewNotFound();
    if (review.moderationLockedAt) throw contentModerationLocked();
    if (review.hiddenReason === "REFUNDED") throw refundedLocked();
    if (review.status === "VISIBLE") return null;
    await tx.review.updateMany({ where: { id: reviewId, tenantId }, data: { status: "VISIBLE", hiddenReason: null, hiddenAt: null } });
    return review.productId;
  });
  if (!productId) return;
  await audit.log({
    actorId,
    scope: "TENANT",
    tenantId,
    action: "REVIEW_RESTORED",
    targetType: "Review",
    targetId: reviewId,
    metadata: { productId, reason: "TENANT_UNHIDE" },
  });
  await recomputeProductRatings([productId]);
}

/**
 * Hoàn tiền / thu hồi entitlement (ADR-029 mục 2): trong CÙNG transaction của caller (scope tenant hoặc
 * system_job) chuyển đánh giá gắn với các dòng đơn đó sang HIDDEN(REFUNDED) — ghi đè lý do ẩn cũ. Trả về
 * productId cần tính lại điểm; caller gọi `recomputeProductRatings` SAU khi transaction commit.
 */
export async function hideReviewsForRevokedItems(tx: Tx, tenantId: string, orderItemIds: readonly string[]): Promise<string[]> {
  if (orderItemIds.length === 0) return [];
  const affected = await tx.review.findMany({
    // ADR-038: bỏ qua đánh giá đang bị khoá kiểm duyệt (đã HIDDEN; trigger reviews_guard_moderation chặn scope tenant
    // đổi status/lý do của chúng — để lại sẽ làm hỏng cả transaction hoàn tiền).
    where: {
      tenantId,
      orderItemId: { in: [...orderItemIds] },
      moderationLockedAt: null,
      OR: [{ hiddenReason: null }, { hiddenReason: { not: "REFUNDED" } }],
    },
    select: { id: true, productId: true },
  });
  if (affected.length === 0) return [];
  await tx.review.updateMany({
    where: { id: { in: affected.map((r) => r.id) } },
    data: { status: "HIDDEN", hiddenReason: "REFUNDED", hiddenAt: new Date() },
  });
  logger.info({ tenantId, reviewIds: affected.map((r) => r.id) }, "REVIEW_HIDDEN_REFUNDED");
  return [...new Set(affected.map((r) => r.productId))];
}

export interface StorefrontReviewOption {
  id: string;
  rating: number;
  displayName: string;
  body: string | null;
  productTitle: string;
  createdAt: Date;
}

/** Ô chọn "ghim đánh giá" trong editor storefront (Studio): đánh giá VISIBLE của tenant, mới nhất trước. */
export async function listStorefrontReviewOptions(tenantId: string): Promise<StorefrontReviewOption[]> {
  const rows = await withTenant(tenantId, (tx) =>
    tx.review.findMany({
      where: { tenantId, status: "VISIBLE", product: { status: "PUBLISHED" } },
      select: { id: true, rating: true, displayName: true, body: true, createdAt: true, product: { select: { title: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: STOREFRONT_REVIEW_PICKER_MAX,
    }),
  );
  return rows.map(({ product, ...r }) => ({ ...r, productTitle: product.title }));
}

// ───────────────────────── Public ─────────────────────────

export interface PublicReview {
  id: string;
  rating: number;
  body: string | null;
  displayName: string;
  /** Luôn true — chỉ người đã mua mới viết được (nhãn "Đã mua"). */
  verifiedPurchase: true;
  reply: string | null;
  repliedAt: Date | null;
  createdAt: Date;
}

const PUBLIC_REVIEW_SELECT = {
  id: true,
  rating: true,
  body: true,
  displayName: true,
  reply: true,
  repliedAt: true,
  createdAt: true,
} as const;

function toPublicReview(row: { id: string; rating: number; body: string | null; displayName: string; reply: string | null; repliedAt: Date | null; createdAt: Date }): PublicReview {
  return { ...row, verifiedPurchase: true };
}

/** Trang chi tiết sản phẩm: đánh giá VISIBLE mới nhất trước, kèm trả lời; cursor = id mục cuối trang trước. */
export async function getProductReviews(
  productId: string,
  cursor?: string | null,
  limit = PRODUCT_REVIEWS_PAGE_SIZE,
): Promise<{ items: PublicReview[]; nextCursor: string | null }> {
  const take = Math.min(Math.max(Math.trunc(limit) || PRODUCT_REVIEWS_PAGE_SIZE, 1), PRODUCT_REVIEWS_PAGE_SIZE_MAX);
  const rows = await withPublic((tx) =>
    tx.review.findMany({
      where: { productId, status: "VISIBLE" },
      select: PUBLIC_REVIEW_SELECT,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: take + 1,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    }),
  );
  const page = rows.slice(0, take);
  return { items: page.map(toPublicReview), nextCursor: rows.length > take ? (page[page.length - 1]?.id ?? null) : null };
}

export interface ProductRatingSummary {
  /** Làm tròn 1 chữ số thập phân; null khi chưa có đánh giá. */
  average: number | null;
  count: number;
  /** Số đánh giá VISIBLE theo từng mức sao. */
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

/** Điểm từ cache số nguyên + phân bố sao (1 truy vấn groupBy trên index `(productId, status, createdAt)`). */
export async function getProductRatingSummary(product: { id: string; ratingSum: number; ratingCount: number }): Promise<ProductRatingSummary> {
  const distribution: ProductRatingSummary["distribution"] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (product.ratingCount > 0) {
    const groups = await withPublic((tx) =>
      tx.review.groupBy({ by: ["rating"], where: { productId: product.id, status: "VISIBLE" }, _count: { _all: true } }),
    );
    for (const g of groups) {
      if (g.rating >= 1 && g.rating <= 5) distribution[g.rating as 1 | 2 | 3 | 4 | 5] = g._count._all;
    }
  }
  return { average: computeRatingAverage(product.ratingSum, product.ratingCount), count: product.ratingCount, distribution };
}

export interface StorefrontReviewItem extends PublicReview {
  productTitle: string;
  productSlug: string;
}

/**
 * Section `reviews` của storefront (ADR-029 mục 4 + bổ sung M10a): đánh giá ghim trước (đúng thứ tự tenant chọn, bỏ
 * id không còn hiệu lực — không VISIBLE/không thuộc tenant/sản phẩm không PUBLISHED; không áp minRating/requireBody),
 * rồi tự bù đánh giá mới nhất `rating ≥ minRating` (có nội dung nếu `requireBody`) cho đủ `limit`, không trùng.
 * Mảng rỗng → trang không render section. Cả 2 truy vấn trong cùng 1 `withPublic` (RLS là cổng thật).
 */
export async function getStorefrontReviews(tenantId: string, data: StorefrontReviewsData): Promise<StorefrontReviewItem[]> {
  const limit = Math.min(Math.max(Math.trunc(data.limit) || 0, 1), STOREFRONT_REVIEWS_LIMIT_MAX);
  const pinnedIds = [...new Set(data.pinnedReviewIds)].slice(0, limit);
  const select = { ...PUBLIC_REVIEW_SELECT, product: { select: { title: true, slug: true } } } as const;

  const rows = await withPublic(async (tx) => {
    const pinned = pinnedIds.length
      ? await tx.review.findMany({ where: { tenantId, status: "VISIBLE", id: { in: pinnedIds } }, select })
      : [];
    const order = new Map(pinnedIds.map((id, index) => [id, index]));
    pinned.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));

    const remaining = limit - pinned.length;
    const auto =
      remaining > 0
        ? await tx.review.findMany({
            where: {
              tenantId,
              status: "VISIBLE",
              rating: { gte: data.minRating },
              ...(data.requireBody ? { body: { not: null } } : {}),
              ...(pinned.length ? { id: { notIn: pinned.map((r) => r.id) } } : {}),
            },
            select,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            take: remaining,
          })
        : [];
    return [...pinned, ...auto];
  });
  return rows.map(({ product, ...r }) => ({ ...toPublicReview(r), productTitle: product.title, productSlug: product.slug }));
}
