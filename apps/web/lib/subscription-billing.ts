import {
  AppError,
  computeRenewalPeriod,
  DISPLAY_TIME_ZONE,
  generateInvoiceCode,
  INVOICE_CODE_SUFFIX_LENGTH,
  internalError,
  logger,
  transitionSubscriptionStatus,
  type SubscriptionStatus,
} from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import type {
  PaymentProviderId as DbPaymentProviderId,
  SubscriptionInvoiceStatus as DbInvoiceStatus,
  SubscriptionStatus as DbSubscriptionStatus,
} from "@gieochu/db";
import {
  buildWebhookNotifyUrl,
  decryptSecret,
  extractSepayReferences,
  getProvider,
  isManualConfirmProvider,
  type PaymentProviderId,
  type SepayWebhookBody,
} from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { renderInvoiceAwaitingReconciliationEmail } from "@gieochu/email";
import { getSupportEmail, getSystemSettings } from "./system-settings";
import { sendEmailNow, type ScheduleAfterResponse } from "./email-dispatch";
import { audit } from "./audit";
import { getPlatformPaymentConfigRow } from "./platform-payment";
import { isMissingEnumValueError } from "./db-errors";

const INVOICE_CODE_RETRIES = 10;


/**
 * ADR-059 (B2): khoá dòng `subscriptions` của gian hàng trong transaction hiện tại — mọi thao tác tạo/áp/xác nhận hoá đơn gói
 * của cùng gian hàng xếp hàng qua khoá này (bảng L1, không RLS).
 */
async function lockSubscriptionRow(tx: Prisma.TransactionClient, tenantId: string): Promise<void> {
  await tx.$queryRaw`SELECT "id" FROM "subscriptions" WHERE "tenantId" = ${tenantId} FOR UPDATE`;
}

/** Tiền tố mặc định của mã hoá đơn gói (M3). Hoá đơn cũ luôn mang tiền tố này. */
export const DEFAULT_INVOICE_CODE_PREFIX = "SUB";

/**
 * ADR-059 bổ sung lần 2 (c): tiền tố mã hoá đơn = `paymentPrefix` admin đã điền cho SePay nền tảng (để SePay nhận diện "mã thanh
 * toán" đúng cấu hình). Chỉ nhận chữ/số 1–10 ký tự (sau khi viết hoa) — giá trị khác (có dấu, khoảng trắng...) không dùng được
 * làm mã chuyển khoản → về `SUB`. Không đổi mã hoá đơn đã có.
 */
export function normalizeInvoiceCodePrefix(value: unknown): string | null {
  const prefix = typeof value === "string" ? value.trim().toUpperCase() : "";
  return /^[A-Z0-9]{1,10}$/.test(prefix) ? prefix : null;
}

/**
 * ADR-059 bổ sung lần 2: mã hoá đơn đọc được từ payload SePay của cổng nền tảng — thử tiền tố đã cấu hình rồi `SUB` (hoá đơn tạo
 * trước khi đổi tiền tố), đúng độ dài mã hoá đơn. Dùng chung cho webhook và tab "Giao dịch cổng".
 */
export function sepayInvoiceReferenceCandidates(payload: unknown, configuredPrefix: unknown): string[] {
  const body = (typeof payload === "object" && payload !== null ? payload : {}) as SepayWebhookBody;
  const prefixes = [normalizeInvoiceCodePrefix(configuredPrefix), DEFAULT_INVOICE_CODE_PREFIX].filter((p): p is string => Boolean(p));
  return extractSepayReferences(body, prefixes, { codeLength: INVOICE_CODE_SUFFIX_LENGTH });
}

async function resolveUniqueInvoiceCode(prefix: string = DEFAULT_INVOICE_CODE_PREFIX): Promise<string> {
  const prisma = getPrismaClient();
  for (let attempt = 0; attempt < INVOICE_CODE_RETRIES; attempt += 1) {
    const code = generateInvoiceCode(prefix);
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

export interface CreateRenewalInvoiceOptions {
  /**
   * ADR-059: lên lịch email báo admin có hoá đơn QR thủ công chờ đối soát (Server Action truyền `after` của next/server).
   * Bỏ trống → không gửi (test, script).
   */
  scheduleNotification?: ScheduleAfterResponse;
}

/**
 * §"M3" sequence diagram. Reuses an existing not-yet-due PENDING invoice
 * instead of creating a second one (dedupe — avoids the owner generating
 * multiple invoices for the same period by refreshing/re-submitting).
 * ADR-059: chỉ hoá đơn VỪA TẠO (không phải hoá đơn chờ được dùng lại) mới lên lịch email báo admin → mỗi hoá đơn báo một lần.
 * ADR-059 (B2): bước kiểm tra "còn hoá đơn chờ" + tạo hoá đơn chạy trong MỘT transaction khoá dòng `subscriptions` của gian
 * hàng (`FOR UPDATE`, cùng khoá với xác nhận/áp hoá đơn) → hai lần tạo song song không sinh 2 hoá đơn, và không lọt kiểm tra
 * "hoá đơn mới hơn" của xác nhận trễ. Checkout (có thể gọi API cổng — MoMo) tạo TRƯỚC transaction để không giữ khoá qua mạng;
 * lần thua cuộc bỏ checkout đã tạo và trả hoá đơn của lần thắng.
 */
export async function createRenewalInvoice(tenantId: string, input: CreateRenewalInvoiceInput, options: CreateRenewalInvoiceOptions = {}) {
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

  // ADR-059 bổ sung lần 2 (c): hoá đơn SePay dùng đúng tiền tố đã cấu hình; cổng khác giữ `SUB`.
  const configuredPrefix =
    input.provider === "SEPAY" ? normalizeInvoiceCodePrefix((platformConfigRow.publicConfig as Record<string, unknown>).paymentPrefix) : null;
  if (input.provider === "SEPAY" && !configuredPrefix) {
    logger.warn({ tenantId }, "invoice: paymentPrefix SePay nền tảng không hợp lệ (chỉ chữ/số, ≤ 10 ký tự) — dùng tiền tố SUB");
  }
  const code = await resolveUniqueInvoiceCode(configuredPrefix ?? DEFAULT_INVOICE_CODE_PREFIX);
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

  const { invoice, created } = await prisma.$transaction(async (tx) => {
    await lockSubscriptionRow(tx, tenantId);
    const lockedNow = new Date();
    const pending = await tx.subscriptionInvoice.findFirst({
      where: { tenantId, status: "PENDING", dueAt: { gt: lockedNow } },
      orderBy: { createdAt: "desc" },
    });
    if (pending) return { invoice: pending, created: false };
    // Kỳ tính từ thuê bao đọc DƯỚI khoá (có thể vừa được gia hạn bởi lần áp hoá đơn khác).
    const locked = await tx.subscription.findUniqueOrThrow({ where: { tenantId } });
    const { periodStart, periodEnd } = computeRenewalPeriod(lockedNow, locked.currentPeriodEnd, plan);
    const row = await tx.subscriptionInvoice.create({
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
    return { invoice: row, created: true };
  });
  if (created && isManualConfirmProvider(invoice.provider) && options.scheduleNotification) {
    options.scheduleNotification(() => notifyAdminOfPendingManualInvoice(invoice.id));
  }
  return invoice;
}

function formatVnd(amountVnd: number): string {
  return `${amountVnd.toLocaleString("vi-VN")}đ`;
}

/**
 * ADR-059 mục 3 — email báo admin có hoá đơn gói QR thủ công chờ đối soát, gửi tới "Email hỗ trợ" (System Settings, đọc
 * động lúc gửi). Trống → bỏ qua + log, không lỗi. Chỉ dữ liệu L1 (hoá đơn gói, tên/slug gian hàng, gói) — §7.9.
 * Gọi sau response; lỗi chỉ log, không ném. Hoá đơn đã không còn chờ khi email chạy → bỏ qua.
 */
export async function notifyAdminOfPendingManualInvoice(invoiceId: string): Promise<void> {
  try {
    const supportEmail = await getSupportEmail();
    if (!supportEmail) {
      logger.warn({ invoiceId }, "invoice.pending_manual: chưa đặt Email hỗ trợ trong System Settings — bỏ qua email báo admin");
      return;
    }
    const invoice = await getPrismaClient().subscriptionInvoice.findUnique({
      where: { id: invoiceId },
      select: {
        code: true,
        provider: true,
        status: true,
        amountVnd: true,
        dueAt: true,
        tenant: { select: { name: true, slug: true } },
        plan: { select: { name: true } },
      },
    });
    if (!invoice || invoice.status !== "PENDING" || !isManualConfirmProvider(invoice.provider)) return;

    const rendered = renderInvoiceAwaitingReconciliationEmail({
      invoiceCode: invoice.code,
      tenantName: invoice.tenant.name,
      tenantSlug: invoice.tenant.slug,
      planName: invoice.plan.name,
      amountVndDisplay: formatVnd(invoice.amountVnd),
      methodLabel: invoice.provider === "MOMO_MANUAL" ? "chuyển tiền MoMo (xác nhận thủ công)" : "chuyển khoản QR thủ công",
      dueAtDisplay: invoice.dueAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE }),
      invoicesUrl: `${getEnv().APP_URL.replace(/\/+$/, "")}/admin/billing/invoices`,
    });
    const result = await sendEmailNow({ type: "invoice_pending_manual", to: supportEmail, ...rendered });
    if (!result.ok) logger.warn({ invoiceId, error: result.error }, "invoice.pending_manual: gửi email báo admin thất bại");
  } catch (error) {
    logger.warn({ invoiceId, err: error }, "invoice.pending_manual: lỗi khi gửi email báo admin");
  }
}

/**
 * Applies a PAID invoice: advances the subscription to the invoice's period
 * (switches plan immediately if the invoice was for a different one, no
 * proration — §"M3"), clears the grace/reminder state, and lifts a
 * billing-driven READ_ONLY back to ACTIVE (never touches LOCKED — that's an
 * admin decision, not a billing one). Idempotent: a second call on an
 * already-PAID invoice is a no-op, so the webhook route can call this
 * without worrying about double-processing beyond the webhook_events guard.
 * ADR-059 (B2): chỉ áp hoá đơn đang PENDING, nguyên tử — một transaction khoá dòng `subscriptions`, đọc lại hoá đơn dưới khoá,
 * cập nhật có điều kiện `status = PENDING`. Webhook và admin chạy cùng lúc → lần sau no-op, chỉ 1 audit. Hoá đơn EXPIRED đi
 * `confirmExpiredManualInvoice` (admin, MANUAL_QR); trạng thái khác → no-op.
 */
export type InvoicePaidSource = "PLATFORM_WEBHOOK" | "ADMIN_MANUAL_CONFIRM";

export async function markInvoicePaid(
  invoiceId: string,
  options: { source: InvoicePaidSource; actorId?: string | null } = { source: "PLATFORM_WEBHOOK" },
): Promise<void> {
  const prisma = getPrismaClient();
  const applied = await prisma.$transaction(async (tx) => {
    const head = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { tenantId: true } });
    await lockSubscriptionRow(tx, head.tenantId);
    const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { plan: true } });
    // ADR-041 B: hoá đơn đã hoàn tiền không bao giờ được áp lại (webhook/xác nhận tay đến muộn). PAID → idempotent.
    if (invoice.status !== "PENDING") return null;
    const result = await applyInvoicePaymentLocked(tx, invoice, { recomputePeriod: false });
    return result ? { invoice, result } : null;
  });
  if (!applied) return;
  const { invoice, result } = applied;
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
      previousPlanId: result.previousPlanId,
      amountVnd: invoice.amountVnd,
      periodEnd: invoice.periodEnd,
      reactivated: result.reactivated,
    },
  });
}

type InvoiceWithPlan = Prisma.SubscriptionInvoiceGetPayload<{ include: { plan: true } }>;

interface AppliedInvoicePayment {
  previousPlanId: string;
  reactivated: boolean;
  periodStart: Date;
  periodEnd: Date;
}

/**
 * Áp thanh toán cho hoá đơn — gọi TRONG transaction đã `lockSubscriptionRow`. Cập nhật hoá đơn có điều kiện theo trạng thái đã
 * đọc dưới khoá (PENDING/EXPIRED) → trả `null` nếu lần chạy khác đã đổi trước. `recomputePeriod` (xác nhận trễ, ADR-059 bổ sung):
 * kỳ tính lại từ lúc xác nhận và ghi đè kỳ trên hoá đơn; ngược lại dùng kỳ đã lưu lúc tạo (hành vi M3).
 */
async function applyInvoicePaymentLocked(
  tx: Prisma.TransactionClient,
  invoice: InvoiceWithPlan,
  options: { recomputePeriod: boolean },
): Promise<AppliedInvoicePayment | null> {
  const [subscription, tenant] = await Promise.all([
    tx.subscription.findUniqueOrThrow({ where: { tenantId: invoice.tenantId } }),
    tx.tenant.findUniqueOrThrow({ where: { id: invoice.tenantId } }),
  ]);
  // PAST_DUE is declared on the DB enum but M3's state machine never assigns it (see schema.prisma).
  const nextStatus = transitionSubscriptionStatus(subscription.status as SubscriptionStatus, "INVOICE_PAID");
  const now = new Date();
  const { periodStart, periodEnd } = options.recomputePeriod
    ? computeRenewalPeriod(now, subscription.currentPeriodEnd, invoice.plan)
    : { periodStart: invoice.periodStart, periodEnd: invoice.periodEnd };

  const { count } = await tx.subscriptionInvoice.updateMany({
    where: { id: invoice.id, status: invoice.status },
    data: { status: "PAID", paidAt: now, ...(options.recomputePeriod ? { periodStart, periodEnd } : {}) },
  });
  if (count === 0) return null;
  await tx.subscription.update({
    where: { id: subscription.id },
    data: {
      status: nextStatus,
      planId: invoice.planId,
      currentPeriodStart: periodStart,
      currentPeriodEnd: periodEnd,
      graceEndsAt: null,
      periodEndReminderStage: null,
    },
  });
  if (tenant.status === "READ_ONLY") {
    await tx.tenant.update({ where: { id: tenant.id }, data: { status: "ACTIVE" } });
  }
  return { previousPlanId: subscription.planId, reactivated: tenant.status === "READ_ONLY", periodStart, periodEnd };
}

/** §"M3" admin console: pending manual-transfer invoices waiting for reconciliation. No order/customer data — just billing-of-the-tenant, allowed under §7.9. */
export async function listPendingManualInvoices() {
  const prisma = getPrismaClient();
  return prisma.subscriptionInvoice.findMany({
    // ADR-059 bổ sung lần 3: mọi cổng xác nhận tay (MANUAL_QR, MOMO_MANUAL). Viết bằng `notIn` các cổng tự đối soát để câu
    // truy vấn không chứa giá trị enum `MOMO_MANUAL` — chạy được cả khi DB chưa áp migration thêm giá trị đó.
    where: { status: "PENDING", provider: { notIn: ["SEPAY", "MOMO"] } },
    include: { tenant: { select: { name: true, slug: true } }, plan: { select: { name: true } } },
    orderBy: { createdAt: "asc" },
  });
}

/**
 * Admin reconciles a MANUAL_QR invoice against the bank statement by hand — SePay/MoMo are only ever marked PAID by their own webhook
 * (hoặc qua một giao dịch cụ thể — {@link confirmInvoiceFromPlatformTransaction}).
 * ADR-059 bổ sung: hoá đơn đã EXPIRED đi nhánh riêng {@link confirmExpiredManualInvoice} (chặn khi có hoá đơn mới hơn, tính lại kỳ);
 * hoá đơn PENDING giữ nguyên hành vi cũ (`markInvoicePaid`, kỳ đã lưu).
 */
export async function confirmManualInvoicePayment(invoiceId: string, actorId: string | null = null): Promise<void> {
  const prisma = getPrismaClient();
  const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  if (!isManualConfirmProvider(invoice.provider)) {
    throw new AppError({ code: "NOT_MANUAL_INVOICE", message: "Chỉ xác nhận thủ công cho hoá đơn chuyển khoản thủ công (QR ngân hàng / MoMo).", httpStatus: 400 });
  }
  if (invoice.status === "EXPIRED") {
    await confirmExpiredManualInvoice(invoiceId, actorId);
    return;
  }
  if (invoice.status === "PAID") return;
  if (invoice.status !== "PENDING") throw invoiceNotConfirmableError();
  await markInvoicePaid(invoiceId, { source: "ADMIN_MANUAL_CONFIRM", actorId });
}

const invoiceNotConfirmableError = () =>
  new AppError({ code: "INVOICE_NOT_CONFIRMABLE", message: "Hoá đơn không ở trạng thái có thể xác nhận thủ công.", httpStatus: 409 });

const newerInvoiceError = () =>
  new AppError({
    code: "NEWER_INVOICE_EXISTS",
    message: "Gian hàng đã có hoá đơn mới hơn — hoàn tiền hoá đơn này ngoài hệ thống",
    httpStatus: 409,
  });

/** ADR-059 bổ sung (1): chặn xác nhận trễ khi gian hàng có hoá đơn TẠO SAU đang PENDING (kể cả đã quá hạn, chưa sweep) hoặc PAID. */
async function assertNoNewerInvoiceLocked(tx: Prisma.TransactionClient, invoice: InvoiceWithPlan): Promise<void> {
  const newer = await tx.subscriptionInvoice.count({
    where: { tenantId: invoice.tenantId, id: { not: invoice.id }, createdAt: { gt: invoice.createdAt }, status: { in: ["PENDING", "PAID"] } },
  });
  if (newer > 0) throw newerInvoiceError();
}

/** Metadata audit chung cho xác nhận trễ — ghi rõ hoá đơn đã hết hạn và kỳ được tính lại (cũ → mới). */
function lateConfirmationMetadata(invoice: InvoiceWithPlan, applied: AppliedInvoicePayment): Record<string, unknown> {
  return {
    previousInvoiceStatus: "EXPIRED",
    lateConfirmation: true,
    dueAt: invoice.dueAt,
    storedPeriodStart: invoice.periodStart,
    storedPeriodEnd: invoice.periodEnd,
    periodRecomputed: true,
    periodStart: applied.periodStart,
    periodEnd: applied.periodEnd,
  };
}

/**
 * ADR-059 bổ sung — admin xác nhận tay hoá đơn MANUAL_QR đã EXPIRED (tiền về trễ):
 * 1. Chặn nếu gian hàng có hoá đơn TẠO SAU hoá đơn này đang PENDING hoặc PAID (tránh trả 2 lần / lùi gói) → admin hoàn tiền
 *    ngoài hệ thống.
 * 2. Kỳ tính lại theo lúc xác nhận: `computeRenewalPeriod(now, currentPeriodEnd, plan)` (không dùng kỳ lưu lúc tạo), ghi đè
 *    `periodStart/periodEnd` của hoá đơn cho khớp. `paidAt` = lúc xác nhận → vẫn là "lần thanh toán đầu" cho hoàn tiền 7 ngày
 *    (ADR-041) nếu đúng là hoá đơn trả đầu tiên.
 * Nguyên tử: một transaction khoá dòng `subscriptions` của gian hàng (`FOR UPDATE`) rồi đọc lại hoá đơn, kiểm tra và ghi; cập nhật
 * hoá đơn có điều kiện `status = EXPIRED`. Hai admin bấm cùng lúc → lần sau thấy hoá đơn đã PAID → no-op, không gia hạn hai lần.
 */
async function confirmExpiredManualInvoice(invoiceId: string, actorId: string | null): Promise<void> {
  const prisma = getPrismaClient();
  const result = await prisma.$transaction(async (tx) => {
    const head = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { tenantId: true } });
    await lockSubscriptionRow(tx, head.tenantId);

    const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { plan: true } });
    // Lần bấm song song đã xác nhận xong (hoặc đã hoàn tiền) — idempotent như markInvoicePaid.
    if (invoice.status === "PAID" || invoice.status === "REFUNDED") return null;
    if (invoice.status !== "EXPIRED" || !isManualConfirmProvider(invoice.provider)) throw invoiceNotConfirmableError();
    await assertNoNewerInvoiceLocked(tx, invoice);
    const applied = await applyInvoicePaymentLocked(tx, invoice, { recomputePeriod: true });
    return applied ? { invoice, applied } : null;
  });
  if (!result) return;

  // ADR-037 + ADR-059: cùng action SUBSCRIPTION_PAID, metadata ghi rõ hoá đơn đã hết hạn và kỳ được tính lại (cũ → mới).
  await audit.log({
    actorId,
    scope: "SYSTEM",
    tenantId: result.invoice.tenantId,
    action: "SUBSCRIPTION_PAID",
    targetType: "SubscriptionInvoice",
    targetId: result.invoice.id,
    metadata: {
      source: "ADMIN_MANUAL_CONFIRM",
      provider: result.invoice.provider,
      planId: result.invoice.planId,
      previousPlanId: result.applied.previousPlanId,
      amountVnd: result.invoice.amountVnd,
      reactivated: result.applied.reactivated,
      ...lateConfirmationMetadata(result.invoice, result.applied),
    },
  });
}

/**
 * ADR-059 bổ sung lần 2 (a)(b) — admin xác nhận tay hoá đơn TỪ MỘT GIAO DỊCH SePay của cổng thu phí gói (tab "Giao dịch cổng").
 * - Admin chọn rõ hoá đơn (nhập/xác nhận mã hoá đơn); giao dịch phải là tiền vào qua SePay.
 * - Thiếu tiền (số nhận < số tiền hoá đơn) → chặn. Thừa hoặc đúng → cho xác nhận; phần thừa admin hoàn ngoài hệ thống, audit ghi
 *   số chênh.
 * - Hoá đơn PENDING → áp như webhook (kỳ đã lưu). Hoá đơn EXPIRED (mọi cổng, kể cả SEPAY — chỉ qua đường này) → cùng luật xác nhận
 *   trễ: chặn nếu có hoá đơn mới hơn, tính lại kỳ.
 * - Mỗi giao dịch chỉ dùng một lần: dưới khoá (`subscriptions` của gian hàng + dòng giao dịch `FOR UPDATE`) giao dịch phải chưa gắn
 *   hoá đơn nào, hoặc đang gắn đúng hoá đơn này mà hoá đơn chưa thanh toán (webhook đã khớp nhưng hoá đơn hết hạn). Gắn
 *   `matchedInvoiceId` có điều kiện trong cùng transaction.
 */
export async function confirmInvoiceFromPlatformTransaction(
  transactionId: string,
  invoiceCode: string,
  actorId: string | null = null,
): Promise<void> {
  const prisma = getPrismaClient();
  const code = invoiceCode.trim().toUpperCase();
  if (!code) throw new AppError({ code: "INVOICE_CODE_REQUIRED", message: "Vui lòng nhập mã hoá đơn cần xác nhận.", httpStatus: 400 });
  const target = await prisma.subscriptionInvoice.findUnique({ where: { code }, select: { id: true, tenantId: true } });
  if (!target) throw new AppError({ code: "INVOICE_NOT_FOUND", message: `Không tìm thấy hoá đơn mã ${code}.`, httpStatus: 404 });

  const result = await prisma.$transaction(async (tx) => {
    await lockSubscriptionRow(tx, target.tenantId);
    const lockedTxn = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "platform_payment_transactions" WHERE "id" = ${transactionId} FOR UPDATE
    `;
    if (lockedTxn.length === 0) throw new AppError({ code: "TRANSACTION_NOT_FOUND", message: "Không tìm thấy giao dịch.", httpStatus: 404 });
    const txn = await tx.platformPaymentTransaction.findUniqueOrThrow({ where: { id: transactionId } });
    const raw = (typeof txn.rawPayload === "object" && txn.rawPayload !== null ? txn.rawPayload : {}) as Record<string, unknown>;
    if (txn.provider !== "SEPAY" || raw.transferType !== "in") {
      throw new AppError({ code: "TRANSACTION_NOT_USABLE", message: "Chỉ xác nhận được từ giao dịch tiền vào qua SePay.", httpStatus: 400 });
    }

    const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: target.id }, include: { plan: true } });
    if (txn.matchedInvoiceId !== null && txn.matchedInvoiceId !== invoice.id) {
      throw new AppError({ code: "TRANSACTION_ALREADY_USED", message: "Giao dịch này đã được gắn với một hoá đơn khác.", httpStatus: 409 });
    }
    if (invoice.status === "PAID" || invoice.status === "REFUNDED") {
      throw new AppError({ code: "INVOICE_ALREADY_PAID", message: `Hoá đơn ${invoice.code} đã được thanh toán.`, httpStatus: 409 });
    }
    if (invoice.status !== "PENDING" && invoice.status !== "EXPIRED") throw invoiceNotConfirmableError();
    if (txn.amountVnd < invoice.amountVnd) {
      throw new AppError({
        code: "TRANSACTION_UNDERPAID",
        message: `Giao dịch thiếu ${formatVnd(invoice.amountVnd - txn.amountVnd)} so với hoá đơn ${invoice.code} — không xác nhận được.`,
        httpStatus: 409,
      });
    }
    const late = invoice.status === "EXPIRED";
    if (late) await assertNoNewerInvoiceLocked(tx, invoice);

    const linked = await tx.platformPaymentTransaction.updateMany({
      where: { id: txn.id, OR: [{ matchedInvoiceId: null }, { matchedInvoiceId: invoice.id }] },
      data: { matchedInvoiceId: invoice.id },
    });
    if (linked.count === 0) {
      throw new AppError({ code: "TRANSACTION_ALREADY_USED", message: "Giao dịch này đã được gắn với một hoá đơn khác.", httpStatus: 409 });
    }
    const applied = await applyInvoicePaymentLocked(tx, invoice, { recomputePeriod: late });
    if (!applied) throw invoiceNotConfirmableError();
    return { invoice, applied, txn, late };
  });

  await audit.log({
    actorId,
    scope: "SYSTEM",
    tenantId: result.invoice.tenantId,
    action: "SUBSCRIPTION_PAID",
    targetType: "SubscriptionInvoice",
    targetId: result.invoice.id,
    metadata: {
      source: "ADMIN_TRANSACTION_CONFIRM",
      provider: result.invoice.provider,
      transactionId: result.txn.id,
      transactionProvider: result.txn.provider,
      receivedAmountVnd: result.txn.amountVnd,
      amountVnd: result.invoice.amountVnd,
      differenceVnd: result.txn.amountVnd - result.invoice.amountVnd,
      planId: result.invoice.planId,
      previousPlanId: result.applied.previousPlanId,
      reactivated: result.applied.reactivated,
      ...(result.late ? lateConfirmationMetadata(result.invoice, result.applied) : { periodEnd: result.invoice.periodEnd }),
    },
  });
}

// ADR-056 — System Center: lịch sử hoá đơn gói (tab "Tất cả") và trang Thuê bao. Chỉ đọc bảng L1
// (subscription_invoices, subscriptions, plans) + tên/slug gian hàng — không đơn hàng/khách hàng của tenant (§7.9).

export const ADMIN_INVOICE_STATUSES = ["PENDING", "PAID", "EXPIRED", "VOID", "REFUNDED"] as const satisfies readonly DbInvoiceStatus[];
export const ADMIN_INVOICE_PROVIDERS = ["MANUAL_QR", "SEPAY", "MOMO", "MOMO_MANUAL"] as const satisfies readonly DbPaymentProviderId[];
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
  // ADR-059 bổ sung lần 3: lọc `MOMO_MANUAL` khi DB chưa áp migration thêm giá trị enum → Postgres báo "invalid input value
  // for enum" → coi như không có hoá đơn nào, không làm hỏng trang.
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
  ]).catch((error: unknown) => {
    if (input.provider && isMissingEnumValueError(error)) return [[], 0] as const;
    throw error;
  });
  return { items: [...items], total, page, pageSize };
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
