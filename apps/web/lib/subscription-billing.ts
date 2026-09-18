import {
  AppError,
  computeRenewalPeriod,
  generateInvoiceCode,
  internalError,
  transitionSubscriptionStatus,
  type SubscriptionStatus,
} from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { buildWebhookNotifyUrl, decryptSecret, getProvider, type PaymentProviderId } from "@gieochu/payments";
import { getEnv } from "@gieochu/config";

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

  const platformConfigRow = await prisma.platformPaymentConfig.findUnique({ where: { provider: input.provider } });
  if (!platformConfigRow?.isEnabled) {
    throw new AppError({ code: "PROVIDER_NOT_AVAILABLE", message: "Phương thức thanh toán này chưa sẵn sàng.", httpStatus: 400 });
  }

  const secrets = JSON.parse(decryptSecret(platformConfigRow.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as Record<string, string>;
  const cfg = { ...(platformConfigRow.publicConfig as Record<string, unknown>), ...secrets };

  const { periodStart, periodEnd } = computeRenewalPeriod(now, subscription.currentPeriodEnd, plan);
  const code = await resolveUniqueInvoiceCode();
  const dueAt = new Date(now.getTime() + env.INVOICE_PENDING_TTL_HOURS * 60 * 60 * 1000);

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
export async function markInvoicePaid(invoiceId: string): Promise<void> {
  const prisma = getPrismaClient();
  const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (invoice.status === "PAID") return;

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
export async function confirmManualInvoicePayment(invoiceId: string): Promise<void> {
  const prisma = getPrismaClient();
  const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (invoice.provider !== "MANUAL_QR") {
    throw new AppError({ code: "NOT_MANUAL_INVOICE", message: "Chỉ xác nhận thủ công cho hoá đơn QR thủ công.", httpStatus: 400 });
  }
  await markInvoicePaid(invoiceId);
}
