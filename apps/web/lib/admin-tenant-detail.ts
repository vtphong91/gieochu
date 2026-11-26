import { auditActionLabel } from "@gieochu/core";
import {
  getPrismaClient,
  withSystemJob,
  type AbuseReportStatus,
  type AbuseReportType,
  type AbuseTargetType,
  type PaymentProviderId,
  type ProductStatus,
  type TenantStatus,
  type UserStatus,
} from "@gieochu/db";
import { isAuditTableMissing } from "./audit";
import { countOverdueRefundRequestsByTenant } from "./entitlement-remedy";
import { requireRole } from "./session";
import { addDays, isStatsTableMissing, vnDateString } from "./tenant-stats";

/**
 * ADR-072 — dữ liệu System Center cho danh sách `/admin/tenants` (cột GMV 30 ngày + chủ gian hàng) và trang chi tiết
 * `/admin/tenants/[tenantId]`. Cả hai hàm tự `requireRole("SYSTEM_ADMIN")` (không tin trang gọi).
 *
 * Ranh giới (§7.9 + ADR-072 mục 1–2):
 * - KHÔNG đọc `orders`, `tenant_customers`, `tenant_payment_transactions`. Số liệu kinh doanh chỉ từ `tenant_daily_stats` (L1).
 * - Ngoại lệ L2 duy nhất: `tenant_payment_configs` chỉ `select { provider, isEnabled }` qua `withSystemJob`.
 * - Đếm tài liệu theo trạng thái: `products` (L2) qua `withSystemJob`, chỉ `groupBy` số đếm.
 * - `abuse.recent` không có mô tả/email người báo cáo/bằng chứng/IP. Nhật ký chỉ gồm action trong {@link TENANT_AUDIT_ACTIONS}
 *   (không có action liên quan đơn hàng/khách của gian hàng).
 */

// ───────────────────────── Kiểu dữ liệu (contract Phong ↔ Hiếu, Quốc duyệt) ─────────────────────────

export type AdminTenantStatus = TenantStatus; // "ACTIVE" | "READ_ONLY" | "LOCKED"
export type AdminOwnerStatus = UserStatus; // "PENDING" | "ACTIVE" | "LOCKED"
export type AdminTenantPaymentProvider = PaymentProviderId; // "MANUAL_QR" | "SEPAY" | "MOMO" | "MOMO_MANUAL"
export type AdminAbuseType = AbuseReportType; // "COPYRIGHT" | "INAPPROPRIATE" | "SCAM" | "OTHER"
export type AdminAbuseStatus = AbuseReportStatus; // "OPEN" | "RESOLVED" | "REJECTED"
export type AdminAbuseTarget = AbuseTargetType; // "PRODUCT" | "REVIEW" | "POST"

export interface AdminTenantMetrics {
  gmvVnd: number;
  ordersPaid: number;
  newCustomers: number;
  downloads: number;
}

export type AdminTenantAuditKind =
  | "TENANT_CREATED"
  | "TENANT_LOCKED"
  | "TENANT_UNLOCKED"
  | "INVOICE_PAID"
  | "INVOICE_VOIDED"
  | "INVOICE_REOPENED"
  | "OTHER";

export interface AdminTenantAuditEntry {
  id: string;
  kind: AdminTenantAuditKind;
  action: string;
  actionLabel: string;
  createdAt: Date;
  /** SYSTEM = không có người làm (webhook/cron); OWNER = chủ gian hàng hiện tại; ADMIN = người khác (quản trị viên). */
  actor: { role: "ADMIN" | "OWNER" | "SYSTEM"; name: string | null; email: string | null };
  /** Chỉ TENANT_LOCKED/UNLOCKED (metadata.reason); null với bản ghi cũ. */
  reason: string | null;
  /** Khoá qua luồng báo cáo vi phạm. */
  source: "ABUSE_REPORT" | null;
  invoice: { code: string; amountVnd: number; provider: string } | null;
  statusChange: { from: string; to: string } | null;
  note: string | null;
}

export interface AdminTenantDetail {
  id: string;
  slug: string;
  name: string;
  status: AdminTenantStatus;
  createdAt: Date;
  orderCodePrefix: string | null;
  previousSlugs: { slug: string; changedAt: Date }[];
  /** `fullName` null khi tài khoản chưa có hồ sơ (`user_profiles` không bắt buộc); `joinedAt` = ngày tạo tài khoản. */
  owner: { id: string; fullName: string | null; email: string; status: AdminOwnerStatus; joinedAt: Date };
  subscription: {
    id: string;
    status: string;
    plan: { name: string; isFree: boolean; priceVnd: number; storageMb: number; maxProducts: number };
    currentPeriodStart: Date;
    currentPeriodEnd: Date;
    graceEndsAt: Date | null;
    latestInvoice: { code: string; status: string; amountVnd: number; provider: string; createdAt: Date } | null;
  } | null;
  /** Chỉ cổng isEnabled=true, thứ tự MANUAL_QR, MOMO_MANUAL, SEPAY, MOMO. */
  paymentMethods: AdminTenantPaymentProvider[];
  stats: { window: { from: string; to: string }; last30d: AdminTenantMetrics; allTime: AdminTenantMetrics; asOf: Date | null };
  content: {
    products: { PUBLISHED: number; DRAFT: number; ARCHIVED: number; total: number };
    storageUsedBytes: number;
    storageLimitMb: number | null;
    maxProducts: number | null;
  };
  abuse: {
    counts: Record<string, number>;
    recent: { id: string; type: string; status: string; targetType: string; createdAt: Date }[];
    overdueRefundRequests: number;
  };
  audit: { entries: AdminTenantAuditEntry[]; total: number };
}

export interface AdminTenantListItem {
  id: string;
  name: string;
  slug: string;
  status: AdminTenantStatus;
  storageUsedBytes: number;
  planName: string | null;
  productCount: number;
  /** Tổng `gmvVnd` (tenant_daily_stats) trong {@link adminStatsWindow} — 0 khi không có dòng. */
  gmv30dVnd: number;
  owner: { fullName: string | null; email: string };
}

// ───────────────────────── Cửa sổ thống kê dùng chung ─────────────────────────

export const ADMIN_TENANT_STATS_DAYS = 30;

/**
 * Cửa sổ 30 ngày giờ VN dùng CHUNG cho cột GMV danh sách và phần "30 ngày gần nhất" ở trang chi tiết. Kết thúc ở **hôm qua**
 * (giờ VN), cùng quy ước dashboard System Admin (ADR-037 mục 5 — cron 03:00, số của hôm nay chưa đủ ngày).
 */
export function adminStatsWindow(now: Date = new Date()): { from: string; to: string } {
  const to = addDays(vnDateString(now), -1);
  return { from: addDays(to, -(ADMIN_TENANT_STATS_DAYS - 1)), to };
}

function toDbDate(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

const ID_PATTERN = /^[a-z0-9]{1,40}$/i;

// ───────────────────────── Danh sách ─────────────────────────

/** ADR-072 mục 4 — 1 trang danh sách gian hàng: chủ (tên + email), gói, số tài liệu, GMV 30 ngày (một `groupBy` cho cả trang). */
export async function listAdminTenants(input: { skip: number; take: number; now?: Date }): Promise<{ items: AdminTenantListItem[]; total: number }> {
  await requireRole("SYSTEM_ADMIN");
  const prisma = getPrismaClient();
  const [tenants, total] = await Promise.all([
    prisma.tenant.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: input.skip,
      take: input.take,
      select: {
        id: true,
        name: true,
        slug: true,
        status: true,
        storageUsedBytes: true,
        subscription: { select: { plan: { select: { name: true } } } },
        owner: { select: { email: true, profile: { select: { fullName: true } } } },
      },
    }),
    prisma.tenant.count(),
  ]);
  if (tenants.length === 0) return { items: [], total };
  const ids = tenants.map((t) => t.id);
  const window = adminStatsWindow(input.now);

  const [gmvRows, productRows] = await Promise.all([
    prisma.tenantDailyStat
      .groupBy({
        by: ["tenantId"],
        where: { tenantId: { in: ids }, date: { gte: toDbDate(window.from), lte: toDbDate(window.to) } },
        _sum: { gmvVnd: true },
      })
      .catch((error: unknown) => {
        if (isStatsTableMissing(error)) return [];
        throw error;
      }),
    // `products` là bảng L2 (RLS) — đếm qua withSystemJob; client thường ngoài phiên RLS sẽ thấy 0 dòng.
    withSystemJob((tx) => tx.product.groupBy({ by: ["tenantId"], where: { tenantId: { in: ids } }, _count: { _all: true } })),
  ]);
  const gmvById = new Map(gmvRows.map((row) => [row.tenantId, Number(row._sum.gmvVnd ?? 0n)]));
  const productsById = new Map(productRows.map((row) => [row.tenantId, row._count._all]));

  return {
    total,
    items: tenants.map((t) => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      storageUsedBytes: t.storageUsedBytes,
      planName: t.subscription?.plan.name ?? null,
      productCount: productsById.get(t.id) ?? 0,
      gmv30dVnd: gmvById.get(t.id) ?? 0,
      owner: { fullName: t.owner.profile?.fullName ?? null, email: t.owner.email },
    })),
  };
}

// ───────────────────────── Chi tiết ─────────────────────────

const PAYMENT_METHOD_ORDER: readonly PaymentProviderId[] = ["MANUAL_QR", "MOMO_MANUAL", "SEPAY", "MOMO"];
const ABUSE_STATUSES: readonly AbuseReportStatus[] = ["OPEN", "RESOLVED", "REJECTED"];
const RECENT_ABUSE_LIMIT = 5;
const AUDIT_LIMIT = 50;

/**
 * Action hiện ở "Nhật ký quản trị" của gian hàng — chỉ thao tác L1 của quản trị viên/chủ gian hàng/hệ thống trên gian hàng,
 * gói dịch vụ và kiểm duyệt. KHÔNG có action liên quan đơn hàng/khách (vd ORDER_PAYMENT_EMAIL_SENT, COUPON_OVERUSED — §7.9).
 */
export const TENANT_AUDIT_ACTIONS = [
  "TENANT_CREATED",
  "TENANT_LOCKED",
  "TENANT_UNLOCKED",
  "TENANT_SLUG_CHANGED",
  "SUBSCRIPTION_INVOICE_CREATED",
  "SUBSCRIPTION_PAID",
  "SUBSCRIPTION_INVOICE_VOIDED",
  "SUBSCRIPTION_INVOICE_REOPENED",
  "SUBSCRIPTION_REFUND_REQUESTED",
  "SUBSCRIPTION_REFUNDED",
  "SUBSCRIPTION_REFUND_REJECTED",
  "CONTENT_MODERATION_LOCKED",
  "CONTENT_MODERATION_UNLOCKED",
] as const;

const AUDIT_KIND_BY_ACTION: Record<string, AdminTenantAuditKind> = {
  TENANT_CREATED: "TENANT_CREATED",
  TENANT_LOCKED: "TENANT_LOCKED",
  TENANT_UNLOCKED: "TENANT_UNLOCKED",
  SUBSCRIPTION_PAID: "INVOICE_PAID",
  SUBSCRIPTION_INVOICE_VOIDED: "INVOICE_VOIDED",
  SUBSCRIPTION_INVOICE_REOPENED: "INVOICE_REOPENED",
};

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function emptyMetrics(): AdminTenantMetrics {
  return { gmvVnd: 0, ordersPaid: 0, newCustomers: 0, downloads: 0 };
}

function toMetrics(sum: { gmvVnd: bigint | null; ordersPaid: number | null; newCustomers: number | null; downloads: number | null }): AdminTenantMetrics {
  return {
    gmvVnd: Number(sum.gmvVnd ?? 0n),
    ordersPaid: sum.ordersPaid ?? 0,
    newCustomers: sum.newCustomers ?? 0,
    downloads: sum.downloads ?? 0,
  };
}

async function loadStats(tenantId: string, now: Date): Promise<AdminTenantDetail["stats"]> {
  const window = adminStatsWindow(now);
  const prisma = getPrismaClient();
  const sumFields = { gmvVnd: true, ordersPaid: true, newCustomers: true, downloads: true } as const;
  try {
    const [last30d, allTime, latest] = await Promise.all([
      prisma.tenantDailyStat.aggregate({
        where: { tenantId, date: { gte: toDbDate(window.from), lte: toDbDate(window.to) } },
        _sum: sumFields,
      }),
      // "Từ trước tới nay" cùng mốc cuối với cửa sổ 30 ngày (hết hôm qua) — hai con số luôn so được với nhau.
      prisma.tenantDailyStat.aggregate({ where: { tenantId, date: { lte: toDbDate(window.to) } }, _sum: sumFields }),
      // Lần tổng hợp gần nhất của cả bảng (gian hàng không có hoạt động thì không có dòng riêng — ADR-037).
      prisma.tenantDailyStat.aggregate({ _max: { updatedAt: true } }),
    ]);
    return { window, last30d: toMetrics(last30d._sum), allTime: toMetrics(allTime._sum), asOf: latest._max.updatedAt ?? null };
  } catch (error) {
    if (isStatsTableMissing(error)) return { window, last30d: emptyMetrics(), allTime: emptyMetrics(), asOf: null };
    throw error;
  }
}

async function loadAudit(tenantId: string, ownerId: string): Promise<AdminTenantDetail["audit"]> {
  const prisma = getPrismaClient();
  const where = { tenantId, action: { in: [...TENANT_AUDIT_ACTIONS] } };
  let rows: { id: string; action: string; actorId: string | null; targetType: string | null; targetId: string | null; metadata: unknown; createdAt: Date }[];
  let total: number;
  try {
    [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: AUDIT_LIMIT,
        select: { id: true, action: true, actorId: true, targetType: true, targetId: true, metadata: true, createdAt: true },
      }),
      prisma.auditLog.count({ where }),
    ]);
  } catch (error) {
    if (isAuditTableMissing(error)) return { entries: [], total: 0 };
    throw error;
  }

  const actorIds = [...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
  const invoiceIds = [...new Set(rows.flatMap((row) => (row.targetType === "SubscriptionInvoice" && row.targetId ? [row.targetId] : [])))];
  const [actors, invoices] = await Promise.all([
    actorIds.length > 0
      ? prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true, profile: { select: { fullName: true } } } })
      : [],
    // Hoá đơn gói (L1) của chính gian hàng — mã/số tiền/cổng lấy từ DB, không tin metadata.
    invoiceIds.length > 0
      ? prisma.subscriptionInvoice.findMany({
          where: { id: { in: invoiceIds }, tenantId },
          select: { id: true, code: true, amountVnd: true, provider: true },
        })
      : [],
  ]);
  const actorById = new Map(actors.map((user) => [user.id, user]));
  const invoiceById = new Map(invoices.map((invoice) => [invoice.id, invoice]));

  const entries = rows.map((row): AdminTenantAuditEntry => {
    const meta = asRecord(row.metadata);
    const kind = AUDIT_KIND_BY_ACTION[row.action] ?? "OTHER";
    const user = row.actorId ? actorById.get(row.actorId) : undefined;
    const actor: AdminTenantAuditEntry["actor"] = !row.actorId
      ? { role: "SYSTEM", name: null, email: null }
      : { role: row.actorId === ownerId ? "OWNER" : "ADMIN", name: user?.profile?.fullName ?? null, email: user?.email ?? null };
    const invoiceRow = row.targetType === "SubscriptionInvoice" && row.targetId ? invoiceById.get(row.targetId) : undefined;

    let statusChange: AdminTenantAuditEntry["statusChange"] = null;
    const previousStatus = metaString(meta, "previousStatus");
    if (kind === "TENANT_LOCKED") {
      statusChange = previousStatus ? { from: previousStatus, to: "LOCKED" } : null;
    } else if (kind === "TENANT_UNLOCKED") {
      statusChange = { from: previousStatus ?? "LOCKED", to: "ACTIVE" };
    } else if (kind === "INVOICE_PAID") {
      // `SUBSCRIPTION_PAID` không ghi fromStatus → suy ra như trang chi tiết đơn hàng gói (ADR-071).
      const late = meta.lateConfirmation === true || metaString(meta, "previousInvoiceStatus") === "EXPIRED";
      statusChange = { from: late ? "EXPIRED" : "PENDING", to: "PAID" };
    } else {
      const from = metaString(meta, "fromStatus");
      const to = metaString(meta, "toStatus");
      statusChange = from && to ? { from, to } : null;
    }

    const isLockEntry = kind === "TENANT_LOCKED" || kind === "TENANT_UNLOCKED";
    return {
      id: row.id,
      kind,
      action: row.action,
      actionLabel: auditActionLabel(row.action),
      createdAt: row.createdAt,
      actor,
      reason: isLockEntry ? metaString(meta, "reason") : null,
      source: kind === "TENANT_LOCKED" && meta.source === "ABUSE_REPORT" ? "ABUSE_REPORT" : null,
      invoice: invoiceRow ? { code: invoiceRow.code, amountVnd: invoiceRow.amountVnd, provider: invoiceRow.provider } : null,
      statusChange,
      note: isLockEntry ? null : metaString(meta, "note"),
    };
  });
  return { entries, total };
}

/**
 * ADR-072 mục 1 — dữ liệu trang `/admin/tenants/[tenantId]`. null khi id sai định dạng hoặc gian hàng không tồn tại.
 */
export async function getAdminTenantDetail(tenantId: string, options: { now?: Date } = {}): Promise<AdminTenantDetail | null> {
  await requireRole("SYSTEM_ADMIN");
  if (typeof tenantId !== "string" || !ID_PATTERN.test(tenantId)) return null;
  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: {
      id: true,
      slug: true,
      name: true,
      status: true,
      createdAt: true,
      orderCodePrefix: true,
      storageUsedBytes: true,
      ownerId: true,
      owner: { select: { id: true, email: true, status: true, createdAt: true, profile: { select: { fullName: true } } } },
      slugHistory: { orderBy: { changedAt: "desc" }, select: { oldSlug: true, changedAt: true } },
      subscription: {
        select: {
          id: true,
          status: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          graceEndsAt: true,
          plan: { select: { name: true, isFree: true, priceVnd: true, storageMb: true, maxProducts: true } },
        },
      },
    },
  });
  if (!tenant) return null;
  const now = options.now ?? new Date();

  const [latestInvoice, paymentRows, productRows, stats, abuseGroups, recentAbuse, overdue, audit] = await Promise.all([
    tenant.subscription
      ? prisma.subscriptionInvoice.findFirst({
          where: { tenantId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          select: { code: true, status: true, amountVnd: true, provider: true, createdAt: true },
        })
      : null,
    // ADR-072 mục 2 — ngoại lệ L2: CHỈ provider + isEnabled (không publicConfig/encryptedSecrets/webhookSecretHash).
    withSystemJob((tx) =>
      tx.tenantPaymentConfig.findMany({ where: { tenantId, isEnabled: true }, select: { provider: true, isEnabled: true } }),
    ),
    withSystemJob((tx) => tx.product.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } })),
    loadStats(tenantId, now),
    prisma.abuseReport.groupBy({ by: ["status"], where: { tenantId }, _count: { _all: true } }),
    prisma.abuseReport.findMany({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: RECENT_ABUSE_LIMIT,
      select: { id: true, type: true, status: true, targetType: true, createdAt: true },
    }),
    countOverdueRefundRequestsByTenant({ tenantId }),
    loadAudit(tenantId, tenant.ownerId),
  ]);

  const enabled = new Set(paymentRows.filter((row) => row.isEnabled).map((row) => row.provider));
  const products: Record<ProductStatus, number> = { PUBLISHED: 0, DRAFT: 0, ARCHIVED: 0 };
  for (const row of productRows) products[row.status] = row._count._all;
  const abuseCounts: Record<string, number> = Object.fromEntries(ABUSE_STATUSES.map((status) => [status, 0]));
  for (const row of abuseGroups) abuseCounts[row.status] = row._count._all;
  const plan = tenant.subscription?.plan ?? null;

  return {
    id: tenant.id,
    slug: tenant.slug,
    name: tenant.name,
    status: tenant.status,
    createdAt: tenant.createdAt,
    orderCodePrefix: tenant.orderCodePrefix || null,
    previousSlugs: tenant.slugHistory.map((row) => ({ slug: row.oldSlug, changedAt: row.changedAt })),
    owner: {
      id: tenant.owner.id,
      fullName: tenant.owner.profile?.fullName ?? null,
      email: tenant.owner.email,
      status: tenant.owner.status,
      joinedAt: tenant.owner.createdAt,
    },
    subscription: tenant.subscription
      ? {
          id: tenant.subscription.id,
          status: tenant.subscription.status,
          plan: tenant.subscription.plan,
          currentPeriodStart: tenant.subscription.currentPeriodStart,
          currentPeriodEnd: tenant.subscription.currentPeriodEnd,
          graceEndsAt: tenant.subscription.graceEndsAt,
          latestInvoice: latestInvoice ?? null,
        }
      : null,
    paymentMethods: PAYMENT_METHOD_ORDER.filter((provider) => enabled.has(provider)),
    stats,
    content: {
      products: { ...products, total: products.PUBLISHED + products.DRAFT + products.ARCHIVED },
      storageUsedBytes: tenant.storageUsedBytes,
      storageLimitMb: plan?.storageMb ?? null,
      maxProducts: plan?.maxProducts ?? null,
    },
    abuse: {
      counts: abuseCounts,
      recent: recentAbuse,
      overdueRefundRequests: overdue[0]?.count ?? 0,
    },
    audit,
  };
}
