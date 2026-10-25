import {
  AppError,
  computeRenewalPeriod,
  generateInvoiceCode,
  internalError,
  transitionSubscriptionStatus,
  type SubscriptionStatus,
} from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import type {
  PaymentProviderId as DbPaymentProviderId,
  SubscriptionInvoiceStatus as DbInvoiceStatus,
  SubscriptionStatus as DbSubscriptionStatus,
} from "@gieochu/db";
import { buildWebhookNotifyUrl, decryptSecret, getProvider, type PaymentProviderId } from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { getSystemSettings } from "./system-settings";
import { audit } from "./audit";
import { getPlatformPaymentConfigRow } from "./platform-payment";

const INVOICE_CODE_RETRIES = 10;

async function resolveUniqueInvoiceCode(): Promise<string> {
  const prisma = getPrismaClient();
  for (let attempt = 0; attempt < INVOICE_CODE_RETRIES; attempt += 1) {
    const code = generateInvoiceCode();
    const existing = await prisma.subscriptionInvoice.findUnique({ where: { code } });
    if (!existing) return code;
  }
  throw internalError("Không tạo được mã hoá đơn, vui lòng thử lại.");
}

export async function getSubscriptionOverview(tenantId: string) {
  const prisma = getPrismaClient();
  const [subscription, invoices] = await Promise.all([
    prisma.subscription.findUniqueOrThrow({ where: { tenantId }, include: { plan: true } }),
    prisma.subscriptionInvoice.findMany({ where: { tenantId }, orderBy: { createdAt: "desc" }, take: 20 }),
  ]);
  return { subscription, invoices };
}

export interface CreateRenewalInvoiceInput {
  /** Omit to renew the current plan; set to switch plans (applies on payment, no proration — §"M3"). */
  planId?: string;
  provider: PaymentProviderId;
}

/**
 * §"M3" sequence diagram. Reuses an existing not-yet-due PENDING invoice
 * instead of creating a second one (dedupe — avoids the owner generating
 * multiple invoices for the same period by refreshing/re-submitting).
 */
export async function createRenewalInvoice(tenantId: string, input: CreateRenewalInvoiceInput) {
  const prisma = getPrismaClient();
  const env = getEnv();
  const now = new Date();

  const existingPending = await prisma.subscriptionInvoice.findFirst({
    where: { tenantId, status: "PENDING", dueAt: { gt: now } },
    orderBy: { createdAt: "desc" },
  });
  if (existingPending) return existingPending;

  const [subscription, tenant] = await Promise.all([
    prisma.subscription.findUniqueOrThrow({ where: { tenantId } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: tenantId } }),
  ]);

  const plan = await prisma.plan.findUniqueOrThrow({ where: { id: input.planId ?? subscription.planId } });
  if (!plan.isActive) {
    throw new AppError({ code: "PLAN_INACTIVE", message: "Gói dịch vụ này hiện không khả dụng.", httpStatus: 400 });
  }

  const platformConfigRow = await getPlatformPaymentConfigRow(input.provider);
  if (!platformConfigRow?.isEnabled) {
    throw new AppError({ code: "PROVIDER_NOT_AVAILABLE", message: "Phương thức thanh toán này chưa sẵn sàng.", httpStatus: 400 });
  }

  const secrets = JSON.parse(decryptSecret(platformConfigRow.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>;
  const cfg = { ...(platformConfigRow.publicConfig as Record<string, unknown>), ...secrets };

  const { periodStart, periodEnd } = computeRenewalPeriod(now, subscription.currentPeriodEnd, plan);
  const code = await resolveUniqueInvoiceCode();
  const { invoicePendingTtlHours } = await getSystemSettings();
  const dueAt = new Date(now.getTime() + invoicePendingTtlHours * 60 * 60 * 1000);

  const checkout = await getProvider(input.provider).createCheckout({
    scope: { kind: "PLATFORM" },
    cfg: cfg as never,
    reference: code,
    amountVnd: plan.priceVnd,
    description: `Thanh toan goi ${plan.name} - ${tenant.name}`,
    returnUrl: `${env.APP_URL}/studio/${tenant.slug}/billing`,
    notifyUrl: buildWebhookNotifyUrl(env.APP_URL, { kind: "PLATFORM" }, input.provider),
  });

  return prisma.subscriptionInvoice.create({
    data: {
      tenantId,
      planId: plan.id,
      code,
      provider: input.provider,
      status: "PENDING",
      amountVnd: plan.priceVnd,
      periodStart,
      periodEnd,
      dueAt,
      checkoutPayload: checkout as unknown as Prisma.InputJsonValue,
    },
  });
}

/**
 * Applies a PAID invoice: advances the subscription to the invoice's period
 * (switches plan immediately if the invoice was for a different one, no
 * proration — §"M3"), clears the grace/reminder state, and lifts a
 * billing-driven READ_ONLY back to ACTIVE (never touches LOCKED — that's an
 * admin decision, not a billing one). Idempotent: a second call on an
 * already-PAID invoice is a no-op, so the webhook route can call this
 * without worrying about double-processing beyond the webhook_events guard.
 */
export type InvoicePaidSource = "PLATFORM_WEBHOOK" | "ADMIN_MANUAL_CONFIRM";

export async function markInvoicePaid(
  invoiceId: string,
  options: { source: InvoicePaidSource; actorId?: string | null } = { source: "PLATFORM_WEBHOOK" },
): Promise<void> {
  const prisma = getPrismaClient();
  const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  // ADR-041 B: hoá đơn đã hoàn tiền không bao giờ được áp lại (webhook/xác nhận tay đến muộn).
  if (invoice.status === "PAID" || invoice.status === "REFUNDED") return;

  const [subscription, tenant] = await Promise.all([
    prisma.subscription.findUniqueOrThrow({ where: { tenantId: invoice.tenantId } }),
    prisma.tenant.findUniqueOrThrow({ where: { id: invoice.tenantId } }),
  ]);
  // PAST_DUE is declared on the DB enum but M3's state machine never assigns it (see schema.prisma).
  const nextStatus = transitionSubscriptionStatus(subscription.status as SubscriptionStatus, "INVOICE_PAID");
  const now = new Date();

  await prisma.$transaction([
    prisma.subscriptionInvoice.update({ where: { id: invoiceId }, data: { status: "PAID", paidAt: now } }),
    prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: nextStatus,
        planId: invoice.planId,
        currentPeriodStart: invoice.periodStart,
        currentPeriodEnd: invoice.periodEnd,
        graceEndsAt: null,
        periodEndReminderStage: null,
      },
    }),
    ...(tenant.status === "READ_ONLY" ? [prisma.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" as const } })] : []),
  ]);
  // ADR-037: thanh toán gói là L1 (PaymentScope PLATFORM) nhưng gắn tenantId để owner thấy ở /studio/{slug}/activity.
  await audit.log({
    actorId: options.actorId ?? null,
    scope: "SYSTEM",
    tenantId: invoice.tenantId,
    action: "SUBSCRIPTION_PAID",
    targetType: "SubscriptionInvoice",
    targetId: invoice.id,
    metadata: {
      source: options.source,
      provider: invoice.provider,
      planId: invoice.planId,
      previousPlanId: subscription.planId,
      amountVnd: invoice.amountVnd,
      periodEnd: invoice.periodEnd,
      reactivated: tenant.status === "READ_ONLY",
    },
  });
}

/** §"M3" admin console: pending manual-transfer invoices waiting for reconciliation. No order/customer data — just billing-of-the-tenant, allowed under §7.9. */
export async function listPendingManualInvoices() {
  const prisma = getPrismaClient();
  return prisma.subscriptionInvoice.findMany({
    where: { status: "PENDING", provider: "MANUAL_QR" },
    include: { tenant: { select: { name: true, slug: true } }, plan: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/** Admin reconciles a MANUAL_QR invoice against the bank statement by hand — SePay/MoMo are only ever marked PAID by their own webhook. */
export async function confirmManualInvoicePayment(invoiceId: string, actorId: string | null = null): Promise<void> {
  const prisma = getPrismaClient();
  const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (invoice.provider !== "MANUAL_QR") {
    throw new AppError({ code: "NOT_MANUAL_INVOICE", message: "Chỉ xác nhận thủ công cho hoá đơn QR thủ công.", httpStatus: 400 });
  }
  await markInvoicePaid(invoiceId, { source: "ADMIN_MANUAL_CONFIRM", actorId });
}

// ADR-056 — System Center: lịch sử hoá đơn gói (tab "Tất cả") và trang Thuê bao. Chỉ đọc bảng L1
// (subscription_invoices, subscriptions, plans) + tên/slug gian hàng — không đơn hàng/khách hàng của tenant (§7.9).

export const ADMIN_INVOICE_STATUSES = ["PENDING", "PAID", "EXPIRED", "VOID", "REFUNDED"] as const satisfies readonly DbInvoiceStatus[];
export const ADMIN_INVOICE_PROVIDERS = ["MANUAL_QR", "SEPAY", "MOMO"] as const satisfies readonly DbPaymentProviderId[];
export const ADMIN_SUBSCRIPTION_STATUSES = ["TRIALING", "ACTIVE", "PAST_DUE", "GRACE", "EXPIRED", "CANCELED"] as const satisfies readonly DbSubscriptionStatus[];

export type AdminInvoiceStatus = (typeof ADMIN_INVOICE_STATUSES)[number];
export type AdminInvoiceProvider = (typeof ADMIN_INVOICE_PROVIDERS)[number];
export type AdminSubscriptionStatus = (typeof ADMIN_SUBSCRIPTION_STATUSES)[number];

/** Giá trị query string không hợp lệ → undefined (bỏ lọc), không ném lỗi. */
export function parseEnumParam<T extends string>(allowed: readonly T[], value: string | undefined): T | undefined {
  return value !== undefined && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export interface ListSubscriptionInvoicesInput {
  status?: AdminInvoiceStatus;
  provider?: AdminInvoiceProvider;
  page: number;
  pageSize: number;
}

/** ADR-056 mục 1 — mọi hoá đơn gói (mọi trạng thái/cổng), mới nhất trước, phân trang. */
export async function listSubscriptionInvoices(input: ListSubscriptionInvoicesInput) {
  const prisma = getPrismaClient();
  const page = Math.max(1, Math.trunc(input.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize) || 20));
  const where: Prisma.SubscriptionInvoiceWhereInput = {
    ...(input.status ? { status: input.status } : {}),
    ...(input.provider ? { provider: input.provider } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.subscriptionInvoice.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        provider: true,
        status: true,
        amountVnd: true,
        createdAt: true,
        paidAt: true,
        dueAt: true,
        tenant: { select: { id: true, name: true, slug: true } },
        plan: { select: { code: true, name: true } },
      },
    }),
    prisma.subscriptionInvoice.count({ where }),
  ]);
  return { items, total, page, pageSize };
}

export interface ListSubscriptionsInput {
  planCode?: string;
  status?: AdminSubscriptionStatus;
  page: number;
  pageSize?: number;
}

/**
 * ADR-056 mục 2 — danh sách thuê bao cho /admin/subscriptions. Sắp theo ngày hết hạn tăng dần; thuê bao gói miễn phí
 * (không có hạn — currentPeriodEnd = currentPeriodStart) xếp sau các gói trả phí.
 */
export async function listSubscriptions(input: ListSubscriptionsInput) {
  const prisma = getPrismaClient();
  const page = Math.max(1, Math.trunc(input.page) || 1);
  const pageSize = Math.min(100, Math.max(1, Math.trunc(input.pageSize ?? 20) || 20));
  const where: Prisma.SubscriptionWhereInput = {
    ...(input.planCode ? { plan: { code: input.planCode } } : {}),
    ...(input.status ? { status: input.status } : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.subscription.findMany({
      where,
      orderBy: [{ plan: { isFree: "asc" } }, { currentPeriodEnd: "asc" }, { id: "asc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        status: true,
        currentPeriodStart: true,
        currentPeriodEnd: true,
        graceEndsAt: true,
        plan: { select: { code: true, name: true, isFree: true } },
        tenant: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscriptionInvoices: { orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 1, select: { code: true, status: true } },
          },
        },
      },
    }),
    prisma.subscription.count({ where }),
  ]);
  const items = rows.map(({ tenant: { subscriptionInvoices, ...tenant }, ...row }) => ({
    ...row,
    tenant,
    latestInvoice: subscriptionInvoices[0] ?? null,
  }));
  return { items, total, page, pageSize };
}

/** Lựa chọn cho bộ lọc gói ở /admin/subscriptions (kể cả gói đã ngừng bán — thuê bao cũ vẫn có thể đang dùng). */
export async function listPlanFilterOptions() {
  const prisma = getPrismaClient();
  return prisma.plan.findMany({ orderBy: [{ priceVnd: "asc" }, { code: "asc" }], select: { code: true, name: true } });
}
