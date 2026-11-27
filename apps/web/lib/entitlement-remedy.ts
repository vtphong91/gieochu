import {
  AppError,
  ENTITLEMENT_REMEDY_ERROR_CODES,
  logger,
  normalizeExternalDocumentUrl,
  notFound,
  REMEDY_REFUND_SLA_DAYS,
  type EntitlementRemedyStatusValue,
} from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, withCustomer, withSystemJob, withTenant, type Tx } from "@gieochu/db";
import { renderPurchaseRemedyCustomerEmail, renderPurchaseRemedyTenantEmail, renderRefundRequestedEmail } from "@gieochu/email";
import { audit } from "./audit";
import { getEffectiveBrand } from "./branding";
import { sendEmailNow } from "./email-dispatch";
import { requireRole, type CurrentUser } from "./session";

/**
 * ADR-039 — quyền lợi người mua khi tài liệu bị admin lưu trữ do vi phạm.
 *
 * Lớp dữ liệu (`entitlements`, L2/L3, RLS ADR-029):
 *  - Mở quyền chọn: chạy TRONG transaction `withSystemJob` của `resolveAbuseReport` (cùng lúc lưu trữ sản phẩm).
 *  - Khách chọn: RLS customer chỉ cho SELECT → đọc + kiểm sở hữu dưới `withCustomer(userId)`, rồi UPDATE dưới
 *    `withSystemJob` với điều kiện `id + userId + remedyStatus = 'PENDING_CHOICE' + revokedAt IS NULL` trong chính câu
 *    lệnh (2 tab bấm cùng lúc → chỉ 1 thắng; không đổi được sau khi chọn).
 *  - Tenant: đọc/đếm dưới `withTenant`; `markOrderRefunded` chuyển REFUND_REQUESTED → REFUNDED (ngoại lệ duy nhất mà
 *    trigger `entitlements_guard_remedy` cho phép ngoài system_job).
 *  - Admin: chỉ SỐ ĐẾM yêu cầu quá hạn theo tenant (§7.9) — không id đơn/khách.
 */

const ID_PATTERN = /^[a-z0-9]{1,40}$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

function appBaseUrl(): string {
  return getEnv().APP_URL.replace(/\/+$/, "");
}

function formatVnd(amountVnd: number): string {
  return `${amountVnd.toLocaleString("vi-VN")}đ`;
}

// ───────────────────────── Mở quyền chọn (admin lưu trữ tài liệu) ─────────────────────────

export interface OpenPurchaseRemediesInput {
  tenantId: string;
  productId: string;
  reportId: string;
  now: Date;
}

/**
 * Gọi trong transaction `withSystemJob` của `resolveAbuseReport` (quyết định ARCHIVE_PRODUCT). Mọi entitlement CHƯA thu
 * hồi và đang NONE của sản phẩm → PENDING_CHOICE (kể cả đơn 0đ — đơn 0đ chỉ được chọn tải lần cuối, server chặn hoàn
 * tiền). Entitlement đã có remedy từ lần lưu trữ trước giữ nguyên (ADR-039 mục 4: không hoàn tác lựa chọn). Trả số dòng.
 */
export async function openPurchaseRemedies(tx: Tx, input: OpenPurchaseRemediesInput): Promise<number> {
  const result = await tx.entitlement.updateMany({
    where: { tenantId: input.tenantId, productId: input.productId, revokedAt: null, remedyStatus: "NONE" },
    data: { remedyStatus: "PENDING_CHOICE", remedyRequestedAt: input.now, remedyReportId: input.reportId },
  });
  return result.count;
}

export interface PurchaseRemedyNotification {
  reportId: string;
  tenantId: string;
  productId: string;
}

/**
 * Sau commit (gọi trong `after()` qua `notifyAbuseReportResolution`): email từng khách bị ảnh hưởng + 1 email tổng hợp
 * cho chủ gian hàng. Danh sách người nhận nạp lại ở đây dưới `withSystemJob` — không đi qua kết quả trả về cho admin.
 * Không bao giờ ném: lỗi gửi chỉ log.
 */
export async function notifyPurchaseRemedyOpened(n: PurchaseRemedyNotification, supportEmail: string | null): Promise<void> {
  try {
    const data = await withSystemJob(async (tx) => {
      const [entitlements, product, tenant] = await Promise.all([
        tx.entitlement.findMany({
          where: { tenantId: n.tenantId, productId: n.productId, remedyReportId: n.reportId },
          select: { user: { select: { email: true } }, orderItem: { select: { order: { select: { totalVnd: true } } } } },
        }),
        tx.product.findFirst({ where: { id: n.productId, tenantId: n.tenantId }, select: { title: true } }),
        tx.tenant.findUnique({ where: { id: n.tenantId }, select: { name: true, slug: true, owner: { select: { email: true } } } }),
      ]);
      return { entitlements, product, tenant };
    });
    if (!data.tenant || !data.product || data.entitlements.length === 0) return;

    const brand = await getEffectiveBrand();
    const libraryUrl = `${appBaseUrl()}/account/library`;
    // 1 email / khách (1 khách có thể có >1 entitlement cùng sản phẩm nếu mua lại sau hoàn tiền — gộp theo email).
    const byEmail = new Map<string, boolean>();
    for (const e of data.entitlements) {
      const email = e.user.email.toLowerCase();
      byEmail.set(email, (byEmail.get(email) ?? false) || e.orderItem.order.totalVnd > 0);
    }
    for (const [to, refundAvailable] of byEmail) {
      const rendered = renderPurchaseRemedyCustomerEmail({
        appName: brand.name,
        tenantName: data.tenant.name,
        productTitle: data.product.title,
        refundAvailable,
        libraryUrl,
        supportEmail,
      });
      const result = await sendEmailNow({ type: "entitlement_remedy_customer", to, ...rendered }, { tenantId: n.tenantId });
      if (!result.ok) logger.warn({ tenantId: n.tenantId, error: result.error }, "entitlement_remedy: gửi email cho khách thất bại");
    }

    const rendered = renderPurchaseRemedyTenantEmail({
      appName: brand.name,
      tenantName: data.tenant.name,
      productTitle: data.product.title,
      affectedCount: data.entitlements.length,
      refundEligibleCount: data.entitlements.filter((e) => e.orderItem.order.totalVnd > 0).length,
      refundSlaDays: REMEDY_REFUND_SLA_DAYS,
      ordersUrl: `${appBaseUrl()}/studio/${data.tenant.slug}/orders?remedy=REFUND_REQUESTED`,
      supportEmail,
    });
    const result = await sendEmailNow({ type: "entitlement_remedy_tenant", to: data.tenant.owner.email, ...rendered }, { tenantId: n.tenantId });
    if (!result.ok) logger.warn({ tenantId: n.tenantId, error: result.error }, "entitlement_remedy: gửi email cho chủ gian hàng thất bại");
  } catch (error) {
    logger.error({ err: error, tenantId: n.tenantId }, "entitlement_remedy: lỗi khi gửi email mở quyền chọn");
  }
}

async function loadSupportEmail(): Promise<string | null> {
  try {
    const row = await getPrismaClient().systemSettings.findUnique({ where: { id: "default" }, select: { supportEmail: true } });
    return row?.supportEmail?.trim() || null;
  } catch (error) {
    logger.warn({ err: error }, "entitlement_remedy: không đọc được email hỗ trợ");
    return null;
  }
}

/**
 * ADR-039 bổ sung — đơn thanh toán muộn cho tài liệu đã bị lưu trữ do vi phạm: `markOrderPaid` sinh entitlement ở
 * PENDING_CHOICE; sau commit (`sendOrderPaidEmails`) gửi khách cùng template 2 lựa chọn. Chỉ entitlement của đơn này
 * còn PENDING_CHOICE + chưa thu hồi. Đọc dưới `withSystemJob`. Không bao giờ ném.
 */
export async function notifyPurchaseRemedyForOrder(orderId: string): Promise<void> {
  try {
    const rows = await withSystemJob((tx) =>
      tx.entitlement.findMany({
        where: { orderItem: { orderId }, remedyStatus: "PENDING_CHOICE", revokedAt: null },
        select: {
          tenantId: true,
          user: { select: { email: true } },
          product: { select: { title: true } },
          tenant: { select: { name: true } },
          orderItem: { select: { order: { select: { totalVnd: true } } } },
        },
      }),
    );
    if (rows.length === 0) return;
    const [brand, supportEmail] = await Promise.all([getEffectiveBrand(), loadSupportEmail()]);
    const libraryUrl = `${appBaseUrl()}/account/library`;
    for (const row of rows) {
      const rendered = renderPurchaseRemedyCustomerEmail({
        appName: brand.name,
        tenantName: row.tenant.name,
        productTitle: row.product.title,
        refundAvailable: row.orderItem.order.totalVnd > 0,
        libraryUrl,
        supportEmail,
      });
      const result = await sendEmailNow({ type: "entitlement_remedy_customer", to: row.user.email, ...rendered }, { tenantId: row.tenantId });
      if (!result.ok) logger.warn({ tenantId: row.tenantId, error: result.error }, "entitlement_remedy: gửi email cho khách (đơn muộn) thất bại");
    }
  } catch (error) {
    logger.error({ err: error, orderId }, "entitlement_remedy: lỗi khi gửi email cho đơn thanh toán muộn");
  }
}

// ───────────────────────── Khách chọn ─────────────────────────

interface OwnedRemedyEntitlement {
  id: string;
  tenantId: string;
  productId: string;
  remedyStatus: EntitlementRemedyStatusValue;
  revokedAt: Date | null;
  productTitle: string;
  order: { id: string; code: string; totalVnd: number };
}

function notPending(): AppError {
  return new AppError({
    code: ENTITLEMENT_REMEDY_ERROR_CODES.NOT_PENDING,
    message: "Tài liệu này không còn chờ bạn lựa chọn (bạn đã chọn trước đó hoặc quyền tải đã thay đổi).",
    httpStatus: 409,
  });
}

/** Đọc entitlement dưới `withCustomer` (RLS: chỉ dòng của chính user) — không thấy = không phải của user → 404. */
async function loadOwnedEntitlement(userId: string, entitlementId: unknown): Promise<OwnedRemedyEntitlement> {
  if (typeof entitlementId !== "string" || !ID_PATTERN.test(entitlementId)) throw notFound("Không tìm thấy tài liệu.");
  const row = await withCustomer(userId, (tx) =>
    tx.entitlement.findFirst({
      where: { id: entitlementId, userId },
      select: {
        id: true,
        tenantId: true,
        productId: true,
        remedyStatus: true,
        revokedAt: true,
        product: { select: { title: true } },
        orderItem: { select: { order: { select: { id: true, code: true, totalVnd: true } } } },
      },
    }),
  );
  if (!row) throw notFound("Không tìm thấy tài liệu.");
  return {
    id: row.id,
    tenantId: row.tenantId,
    productId: row.productId,
    remedyStatus: row.remedyStatus,
    revokedAt: row.revokedAt,
    productTitle: row.product.title,
    order: row.orderItem.order,
  };
}

/**
 * Số tệp khách tải được của sản phẩm — cùng điều kiện với Thư viện (`listLibraryEntitlements`) và luồng tải: không phải
 * bản xem trước, chưa gỡ, tệp CLEAN hoặc link ngoài còn qua allowlist. Đọc dưới `withCustomer` (RLS product_files
 * customer: chỉ khi có entitlement chưa thu hồi).
 */
async function countDeliverableFiles(userId: string, productId: string): Promise<number> {
  const files = await withCustomer(userId, (tx) =>
    tx.productFile.findMany({
      where: {
        productId,
        isPreview: false,
        removedAt: null,
        OR: [{ sourceKind: "FILE", scanStatus: "CLEAN" }, { sourceKind: "EXTERNAL_URL" }],
      },
      select: { sourceKind: true, externalUrl: true },
    }),
  );
  return files.filter((f) => f.sourceKind === "FILE" || (f.externalUrl != null && normalizeExternalDocumentUrl(f.externalUrl) !== null)).length;
}

/**
 * Lựa chọn A — tải lần cuối: PENDING_CHOICE → FINAL_DOWNLOAD, `downloadLimit = downloadsUsed + max(1, số tệp khả dụng)`
 * (mỗi tệp tải được 1 lần; cộng vào `downloadsUsed` ngay trong câu UPDATE — không dựa số đọc trước),
 * `remedyChosenAt = now`. Không đổi được sau khi chọn.
 */
export async function chooseFinalDownload(user: CurrentUser, entitlementId: unknown): Promise<void> {
  const ent = await loadOwnedEntitlement(user.userId, entitlementId);
  if (ent.revokedAt || ent.remedyStatus !== "PENDING_CHOICE") throw notPending();

  const grant = Math.max(1, await countDeliverableFiles(user.userId, ent.productId));
  const now = new Date();
  const updated = await withSystemJob(
    (tx) => tx.$executeRaw`
      UPDATE "entitlements"
      SET "remedyStatus" = 'FINAL_DOWNLOAD', "downloadLimit" = "downloadsUsed" + ${grant}, "remedyChosenAt" = ${now}
      WHERE "id" = ${ent.id} AND "userId" = ${user.userId} AND "remedyStatus" = 'PENDING_CHOICE' AND "revokedAt" IS NULL
    `,
  );
  if (updated === 0) throw notPending();

  // Scope CUSTOMER + tenantId (quy ước M12a, như REVIEW_RESTORED): chủ gian hàng thấy ở Studio → Hoạt động. Metadata
  // chỉ id — không email khách.
  await audit.log({
    actorId: user.userId,
    scope: "CUSTOMER",
    tenantId: ent.tenantId,
    action: "REMEDY_FINAL_DOWNLOAD_CHOSEN",
    targetType: "Entitlement",
    targetId: ent.id,
    metadata: { productId: ent.productId, orderId: ent.order.id, grantedDownloads: grant },
  });
}

export interface RefundRequestedNotification {
  tenantId: string;
  orderId: string;
  orderCode: string;
  totalVnd: number;
  productTitle: string;
}

/**
 * Lựa chọn B — yêu cầu hoàn tiền: PENDING_CHOICE → REFUND_REQUESTED (chặn tải vĩnh viễn), chỉ khi đơn > 0đ (đọc
 * `totalVnd` từ DB, không nhận từ client). Trả dữ liệu để caller gửi email tenant sau response
 * (`after(() => notifyRefundRequested(result))`). Nền tảng KHÔNG tự hoàn tiền — tenant hoàn rồi bấm "Hoàn tiền".
 */
export async function requestRefund(user: CurrentUser, entitlementId: unknown): Promise<RefundRequestedNotification> {
  const ent = await loadOwnedEntitlement(user.userId, entitlementId);
  if (ent.revokedAt || ent.remedyStatus !== "PENDING_CHOICE") throw notPending();
  if (ent.order.totalVnd <= 0) {
    throw new AppError({
      code: ENTITLEMENT_REMEDY_ERROR_CODES.REFUND_NOT_AVAILABLE,
      message: "Đơn hàng 0đ không có lựa chọn hoàn tiền — bạn chỉ có thể chọn tải lần cuối.",
      httpStatus: 409,
    });
  }

  const now = new Date();
  const updated = await withSystemJob((tx) =>
    tx.entitlement.updateMany({
      where: { id: ent.id, userId: user.userId, remedyStatus: "PENDING_CHOICE", revokedAt: null },
      data: { remedyStatus: "REFUND_REQUESTED", remedyChosenAt: now },
    }),
  );
  if (updated.count === 0) throw notPending();

  await audit.log({
    actorId: user.userId,
    scope: "CUSTOMER",
    tenantId: ent.tenantId,
    action: "REMEDY_REFUND_REQUESTED",
    targetType: "Entitlement",
    targetId: ent.id,
    metadata: { productId: ent.productId, orderId: ent.order.id },
  });

  return { tenantId: ent.tenantId, orderId: ent.order.id, orderCode: ent.order.code, totalVnd: ent.order.totalVnd, productTitle: ent.productTitle };
}

/** Email chủ gian hàng: 1 yêu cầu hoàn tiền mới (mã đơn + link Studio). Không bao giờ ném. */
export async function notifyRefundRequested(n: RefundRequestedNotification): Promise<void> {
  try {
    // tenants/users là L1 (không RLS).
    const tenant = await getPrismaClient().tenant.findUnique({
      where: { id: n.tenantId },
      select: { name: true, slug: true, owner: { select: { email: true } } },
    });
    if (!tenant) return;
    const brand = await getEffectiveBrand();
    const rendered = renderRefundRequestedEmail({
      appName: brand.name,
      tenantName: tenant.name,
      productTitle: n.productTitle,
      orderCode: n.orderCode,
      totalVndDisplay: formatVnd(n.totalVnd),
      refundSlaDays: REMEDY_REFUND_SLA_DAYS,
      orderUrl: `${appBaseUrl()}/studio/${tenant.slug}/orders/${n.orderId}`,
    });
    const result = await sendEmailNow({ type: "remedy_refund_requested", to: tenant.owner.email, ...rendered }, { tenantId: n.tenantId });
    if (!result.ok) logger.warn({ tenantId: n.tenantId, error: result.error }, "entitlement_remedy: gửi email yêu cầu hoàn tiền thất bại");
  } catch (error) {
    logger.error({ err: error, tenantId: n.tenantId }, "entitlement_remedy: lỗi khi gửi email yêu cầu hoàn tiền");
  }
}

// ───────────────────────── Tenant ─────────────────────────

export interface PendingRefundRequestCounts {
  /** Yêu cầu hoàn tiền đang chờ tenant xử lý. */
  pending: number;
  /** Trong đó quá hạn REMEDY_REFUND_SLA_DAYS ngày. */
  overdue: number;
}

/**
 * Số yêu cầu hoàn tiền đang chờ của 1 tenant (badge sidebar / dashboard Studio). Caller đã kiểm quyền thành viên
 * (`requireTenantMember*`) — hàm chỉ chạy dưới `withTenant(tenantId)`. 1 entitlement = 1 đơn (mỗi đơn 1 sản phẩm).
 */
export async function countPendingRefundRequests(tenantId: string): Promise<PendingRefundRequestCounts> {
  const overdueBefore = new Date(Date.now() - REMEDY_REFUND_SLA_DAYS * DAY_MS);
  return withTenant(tenantId, async (tx) => {
    const [pending, overdue] = await Promise.all([
      tx.entitlement.count({ where: { tenantId, remedyStatus: "REFUND_REQUESTED" } }),
      tx.entitlement.count({ where: { tenantId, remedyStatus: "REFUND_REQUESTED", remedyChosenAt: { lt: overdueBefore } } }),
    ]);
    return { pending, overdue };
  });
}

// ───────────────────────── Admin (chỉ số đếm) ─────────────────────────

export interface OverdueRefundRequestCount {
  tenantId: string;
  name: string;
  slug: string;
  count: number;
}

/**
 * ADR-039 mục 3 + §7.9: số yêu cầu hoàn tiền quá hạn (REFUND_REQUESTED, chọn cách đây > 7 ngày) theo tenant — CHỈ số
 * đếm, không id đơn/khách. `tenantId` tuỳ chọn để trang chi tiết tenant/báo cáo lọc 1 tenant. Sắp xếp số đếm giảm dần.
 */
export async function countOverdueRefundRequestsByTenant(options: { tenantId?: string } = {}): Promise<OverdueRefundRequestCount[]> {
  await requireRole("SYSTEM_ADMIN");
  if (options.tenantId !== undefined && !ID_PATTERN.test(options.tenantId)) return [];
  const overdueBefore = new Date(Date.now() - REMEDY_REFUND_SLA_DAYS * DAY_MS);
  const groups = await withSystemJob((tx) =>
    tx.entitlement.groupBy({
      by: ["tenantId"],
      where: {
        remedyStatus: "REFUND_REQUESTED",
        remedyChosenAt: { lt: overdueBefore },
        ...(options.tenantId ? { tenantId: options.tenantId } : {}),
      },
      _count: { _all: true },
    }),
  );
  if (groups.length === 0) return [];
  const tenants = await getPrismaClient().tenant.findMany({
    where: { id: { in: groups.map((g) => g.tenantId) } },
    select: { id: true, name: true, slug: true },
  });
  const byId = new Map(tenants.map((t) => [t.id, t]));
  return groups
    .flatMap((g) => {
      const t = byId.get(g.tenantId);
      return t ? [{ tenantId: t.id, name: t.name, slug: t.slug, count: g._count._all }] : [];
    })
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, "vi"));
}
