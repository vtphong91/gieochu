import {
  AppError,
  auditActionLabel,
  computeRenewalPeriod,
  DISPLAY_TIME_ZONE,
  generateInvoiceCode,
  internalError,
  logger,
  normalizePaymentCodePrefix,
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
  extractSepayPaymentCodes,
  getProvider,
  isManualConfirmProvider,
  type PaymentProviderId,
  type SepayWebhookBody,
} from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { renderInvoiceAwaitingReconciliationEmail } from "@gieochu/email";
import { getSupportEmail, getSystemSettings } from "./system-settings";
import { sendEmailNow, type ScheduleAfterResponse } from "./email-dispatch";
import { audit, isAuditTableMissing } from "./audit";
import { getPlatformPaymentConfigRow } from "./platform-payment";
import { isMissingEnumValueError } from "./db-errors";
import { notifyOwnerOfInvoiceStatus } from "./payment-status-notify";

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
 * ADR-059 bổ sung lần 2 (c) + ADR-065: tiền tố mã hoá đơn = `paymentPrefix` admin đã điền cho SePay nền tảng. Chỉ nhận 2–5 chữ
 * cái (giới hạn ô "Tiền tố" của SePay) — giá trị khác không dùng được làm mã thanh toán → về `SUB`. Không đổi mã hoá đơn đã có.
 */
export function normalizeInvoiceCodePrefix(value: unknown): string | null {
  return normalizePaymentCodePrefix(value);
}

/**
 * ADR-065: mã hoá đơn đọc được từ payload SePay của cổng nền tảng — tiền tố đã cấu hình rồi `SUB` (hoá đơn cổng khác / tiền tố cấu
 * hình không hợp lệ), hậu tố 8 chữ số. Dùng chung cho webhook và tab "Giao dịch cổng".
 */
export function sepayInvoiceReferenceCandidates(payload: unknown, configuredPrefix: unknown): string[] {
  const body = (typeof payload === "object" && payload !== null ? payload : {}) as SepayWebhookBody;
  return extractSepayPaymentCodes(body, [configuredPrefix, DEFAULT_INVOICE_CODE_PREFIX]);
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
  /** ADR-071: người bấm gia hạn (ghi vào audit `SUBSCRIPTION_INVOICE_CREATED`). Bỏ trống → null (script/test). */
  actorId?: string | null;
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
    logger.warn({ tenantId }, "invoice: paymentPrefix SePay nền tảng không hợp lệ (cần 2–5 chữ cái) — dùng tiền tố SUB");
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
  if (created) {
    // ADR-071 (2A): mốc "Tạo hoá đơn" — CHỈ khi lần này thật sự tạo (dùng lại hoá đơn chờ cũ → không ghi). Sau commit (ADR-037).
    await audit.log({
      actorId: options.actorId ?? null,
      scope: "SYSTEM",
      tenantId,
      action: "SUBSCRIPTION_INVOICE_CREATED",
      targetType: "SubscriptionInvoice",
      targetId: invoice.id,
      metadata: { code: invoice.code, planId: invoice.planId, provider: invoice.provider, amountVnd: invoice.amountVnd },
    });
  }
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
  options: {
    source: InvoicePaidSource;
    actorId?: string | null;
    note?: string | null;
    /**
     * ADR-070 A1: lên lịch email "thanh toán thành công" sau response (webhook truyền vào để trả 2xx nhanh). Bỏ trống → gửi ngay
     * tại chỗ (Server Action của admin). Chỉ gọi khi lần này thật sự áp hoá đơn.
     */
    scheduleNotification?: ScheduleAfterResponse;
  } = { source: "PLATFORM_WEBHOOK" },
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
      ...(options.note ? { note: options.note } : {}),
    },
  });
  // ADR-070 A1 — chỉ tới đây khi lần này áp hoá đơn (cập nhật có điều kiện PENDING → PAID) → một email mỗi hoá đơn.
  const notifyPaid = () => notifyOwnerOfInvoiceStatus(invoice.id, "PAID");
  if (options.scheduleNotification) options.scheduleNotification(notifyPaid);
  else await notifyPaid();
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

/** Ghi chú admin khi xác nhận tay (không bắt buộc) — chỉ ghi vào audit; trống → null, cắt 500 ký tự. */
export const MANUAL_CONFIRM_NOTE_MAX = 500;

function normalizeConfirmNote(note: string | null | undefined): string | null {
  const trimmed = (note ?? "").trim();
  return trimmed ? trimmed.slice(0, MANUAL_CONFIRM_NOTE_MAX) : null;
}

/**
 * Admin xác nhận tay một hoá đơn gói đã nhận tiền, đối chiếu sao kê — ADR-066: **mọi cổng** (QR thủ công, MoMo cá nhân, SePay,
 * MoMo). SePay/MoMo bình thường tự xác nhận qua webhook; đây là đường cứu khi tiền đã về mà webhook không tới (VD mã thanh toán
 * SePay không nhận diện được). Ghi chú không bắt buộc, ghi vào audit `SUBSCRIPTION_PAID` (`source: ADMIN_MANUAL_CONFIRM`).
 * ADR-059 bổ sung: hoá đơn đã EXPIRED đi nhánh riêng {@link confirmExpiredManualInvoice} (chặn khi có hoá đơn mới hơn, tính lại kỳ);
 * hoá đơn PENDING giữ nguyên hành vi cũ (`markInvoicePaid`, kỳ đã lưu).
 */
export async function confirmManualInvoicePayment(invoiceId: string, actorId: string | null = null, note: string | null = null): Promise<void> {
  const prisma = getPrismaClient();
  const invoice = await prisma.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId } });
  const confirmNote = normalizeConfirmNote(note);
  if (invoice.status === "EXPIRED") {
    await confirmExpiredManualInvoice(invoiceId, actorId, confirmNote);
    return;
  }
  if (invoice.status === "PAID") return;
  if (invoice.status !== "PENDING") throw invoiceNotConfirmableError();
  await markInvoicePaid(invoiceId, { source: "ADMIN_MANUAL_CONFIRM", actorId, note: confirmNote });
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
 * ADR-059 bổ sung — admin xác nhận tay hoá đơn đã EXPIRED (tiền về trễ; ADR-066: mọi cổng):
 * 1. Chặn nếu gian hàng có hoá đơn TẠO SAU hoá đơn này đang PENDING hoặc PAID (tránh trả 2 lần / lùi gói) → admin hoàn tiền
 *    ngoài hệ thống.
 * 2. Kỳ tính lại theo lúc xác nhận: `computeRenewalPeriod(now, currentPeriodEnd, plan)` (không dùng kỳ lưu lúc tạo), ghi đè
 *    `periodStart/periodEnd` của hoá đơn cho khớp. `paidAt` = lúc xác nhận → vẫn là "lần thanh toán đầu" cho hoàn tiền 7 ngày
 *    (ADR-041) nếu đúng là hoá đơn trả đầu tiên.
 * Nguyên tử: một transaction khoá dòng `subscriptions` của gian hàng (`FOR UPDATE`) rồi đọc lại hoá đơn, kiểm tra và ghi; cập nhật
 * hoá đơn có điều kiện `status = EXPIRED`. Hai admin bấm cùng lúc → lần sau thấy hoá đơn đã PAID → no-op, không gia hạn hai lần.
 */
async function confirmExpiredManualInvoice(invoiceId: string, actorId: string | null, note: string | null): Promise<void> {
  const prisma = getPrismaClient();
  const result = await prisma.$transaction(async (tx) => {
    const head = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, select: { tenantId: true } });
    await lockSubscriptionRow(tx, head.tenantId);

    const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { plan: true } });
    // Lần bấm song song đã xác nhận xong (hoặc đã hoàn tiền) — idempotent như markInvoicePaid.
    if (invoice.status === "PAID" || invoice.status === "REFUNDED") return null;
    if (invoice.status !== "EXPIRED") throw invoiceNotConfirmableError();
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
      ...(note ? { note } : {}),
    },
  });
  // ADR-070 A1 — chỉ khi lần này áp (hai lần bấm song song: lần sau return null ở trên, không gửi lại).
  await notifyOwnerOfInvoiceStatus(result.invoice.id, "PAID");
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
  // ADR-070 A1 — giao dịch chỉ gắn/áp một lần (dưới khoá); lần sau ném lỗi trước khi tới đây.
  await notifyOwnerOfInvoiceStatus(result.invoice.id, "PAID");
}

// ADR-067 — "Đổi trạng thái" hoá đơn gói (System Admin, mọi cổng). Bảng L1 (subscription_invoices, subscriptions) — mọi thao
// tác ghi chạy trong transaction khoá dòng `subscriptions` của gian hàng (cùng khoá với tạo/áp/xác nhận hoá đơn).

/** Trạng thái đích admin chọn được trong hộp "Đổi trạng thái…". */
export type InvoiceStatusTarget = "PAID" | "PENDING" | "VOID";

/**
 * ADR-067 — bảng chuyển trạng thái (thứ tự hiển thị PAID, PENDING, VOID). PAID/REFUNDED không chuyển được (hoá đơn đã trả đi
 * luồng hoàn tiền ADR-041). Chỉ dùng để quyết định UI hiện lựa chọn nào — server luôn kiểm lại dưới khoá khi thực hiện.
 */
const INVOICE_STATUS_TRANSITIONS: Record<DbInvoiceStatus, readonly InvoiceStatusTarget[]> = {
  PENDING: ["PAID", "VOID"],
  EXPIRED: ["PAID", "PENDING", "VOID"],
  VOID: ["PENDING"],
  PAID: [],
  REFUNDED: [],
};

export function invoiceStatusTargets(status: DbInvoiceStatus): InvoiceStatusTarget[] {
  return [...(INVOICE_STATUS_TRANSITIONS[status] ?? [])];
}

const invoiceNotFoundError = () =>
  new AppError({ code: "INVOICE_NOT_FOUND", message: "Không tìm thấy hoá đơn.", httpStatus: 404 });

/** Đọc `tenantId` của hoá đơn (trước khi khoá) — hoá đơn không tồn tại → 404 rõ ràng thay vì lỗi Prisma. */
async function invoiceTenantIdOrThrow(tx: Prisma.TransactionClient, invoiceId: string): Promise<string> {
  const head = await tx.subscriptionInvoice.findUnique({ where: { id: invoiceId }, select: { tenantId: true } });
  if (!head) throw invoiceNotFoundError();
  return head.tenantId;
}

/**
 * ADR-067 mục 1 — huỷ hoá đơn chưa trả (PENDING/EXPIRED → VOID). Không đổi thuê bao/gói; gian hàng tạo được hoá đơn mới ngay
 * (hoá đơn VOID không chặn dedupe của `createRenewalInvoice`). Cập nhật có điều kiện dưới khoá → webhook/xác nhận chạy song song
 * đã đổi trạng thái trước thì báo 409, không ghi đè. Ghi chú (không bắt buộc) chỉ vào audit.
 */
export async function voidSubscriptionInvoice(invoiceId: string, actorId: string | null, note?: string | null): Promise<void> {
  const prisma = getPrismaClient();
  const voidNote = normalizeConfirmNote(note);
  const invoice = await prisma.$transaction(async (tx) => {
    const tenantId = await invoiceTenantIdOrThrow(tx, invoiceId);
    await lockSubscriptionRow(tx, tenantId);
    const locked = await tx.subscriptionInvoice.findUniqueOrThrow({
      where: { id: invoiceId },
      select: { id: true, tenantId: true, code: true, provider: true, status: true, amountVnd: true },
    });
    if (locked.status !== "PENDING" && locked.status !== "EXPIRED") throw invoiceNotVoidableError();
    const { count } = await tx.subscriptionInvoice.updateMany({
      where: { id: invoiceId, status: { in: ["PENDING", "EXPIRED"] } },
      data: { status: "VOID" },
    });
    if (count === 0) throw invoiceNotVoidableError();
    return locked;
  });

  await audit.log({
    actorId,
    scope: "SYSTEM",
    tenantId: invoice.tenantId,
    action: "SUBSCRIPTION_INVOICE_VOIDED",
    targetType: "SubscriptionInvoice",
    targetId: invoice.id,
    metadata: {
      code: invoice.code,
      provider: invoice.provider,
      amountVnd: invoice.amountVnd,
      fromStatus: invoice.status,
      toStatus: "VOID",
      ...(voidNote ? { note: voidNote } : {}),
    },
  });
  // ADR-070 A5 — chỉ sau lần huỷ thành công (cập nhật có điều kiện). Email KHÔNG chứa ghi chú của admin.
  await notifyOwnerOfInvoiceStatus(invoice.id, "VOIDED");
}

const invoiceNotVoidableError = () =>
  new AppError({
    code: "INVOICE_NOT_VOIDABLE",
    message: "Hoá đơn đã đổi trạng thái — chỉ huỷ được hoá đơn đang chờ thanh toán hoặc đã hết hạn.",
    httpStatus: 409,
  });

const invoiceNotReopenableError = () =>
  new AppError({
    code: "INVOICE_NOT_REOPENABLE",
    message: "Hoá đơn đã đổi trạng thái — chỉ mở lại được hoá đơn đã huỷ hoặc đã hết hạn.",
    httpStatus: 409,
  });

/**
 * ADR-067 mục 2 — mở lại hoá đơn đã huỷ/hết hạn (EXPIRED/VOID → PENDING). Dưới khoá dòng `subscriptions` của gian hàng:
 * - gói của hoá đơn phải đang bán (`plan.isActive`) — ADR-067 bổ sung;
 * - hoá đơn phải là hoá đơn MỚI NHẤT của gian hàng (createdAt desc, id desc);
 * - gian hàng không có hoá đơn PENDING khác (kể cả PENDING đã quá hạn chưa sweep);
 * - `dueAt` = bây giờ + `invoicePendingTtlHours`; kỳ tính lại `computeRenewalPeriod(now, currentPeriodEnd, plan)` (ghi đè kỳ đã
 *   lưu) để lần thanh toán sau (`markInvoicePaid`, dùng kỳ đã lưu) áp đúng kỳ.
 * Giữ nguyên mã, số tiền, cổng, `checkoutPayload`. Cập nhật có điều kiện theo trạng thái đã đọc dưới khoá.
 */
export async function reopenSubscriptionInvoice(invoiceId: string, actorId: string | null, note?: string | null): Promise<void> {
  const prisma = getPrismaClient();
  const reopenNote = normalizeConfirmNote(note);
  // Đọc cấu hình TRƯỚC transaction — không giữ khoá dòng qua truy vấn không liên quan.
  const { invoicePendingTtlHours } = await getSystemSettings();

  const result = await prisma.$transaction(async (tx) => {
    const tenantId = await invoiceTenantIdOrThrow(tx, invoiceId);
    await lockSubscriptionRow(tx, tenantId);
    const invoice = await tx.subscriptionInvoice.findUniqueOrThrow({ where: { id: invoiceId }, include: { plan: true } });
    if (invoice.status !== "EXPIRED" && invoice.status !== "VOID") throw invoiceNotReopenableError();
    // ADR-067 bổ sung (2026-11-25): không mở lại hoá đơn của gói đã ngừng bán — cùng ý với chặn ở createRenewalInvoice.
    if (!invoice.plan.isActive) {
      throw new AppError({
        code: "PLAN_INACTIVE",
        message: "Gói dịch vụ của hoá đơn này đã ngừng bán — không mở lại được; tạo hoá đơn mới cho gói đang bán.",
        httpStatus: 409,
      });
    }

    const latest = await tx.subscriptionInvoice.findFirst({
      where: { tenantId },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      select: { id: true },
    });
    if (latest?.id !== invoice.id) {
      throw new AppError({ code: "INVOICE_NOT_LATEST", message: "Chỉ mở lại được hoá đơn mới nhất của gian hàng", httpStatus: 409 });
    }
    const otherPending = await tx.subscriptionInvoice.count({ where: { tenantId, status: "PENDING", id: { not: invoice.id } } });
    if (otherPending > 0) {
      throw new AppError({
        code: "PENDING_INVOICE_EXISTS",
        message: "Gian hàng đang có hoá đơn chờ thanh toán khác — huỷ hoá đơn đó trước khi mở lại.",
        httpStatus: 409,
      });
    }

    const subscription = await tx.subscription.findUniqueOrThrow({ where: { tenantId } });
    const now = new Date();
    const dueAt = new Date(now.getTime() + invoicePendingTtlHours * 60 * 60 * 1000);
    const { periodStart, periodEnd } = computeRenewalPeriod(now, subscription.currentPeriodEnd, invoice.plan);
    const { count } = await tx.subscriptionInvoice.updateMany({
      where: { id: invoice.id, status: invoice.status },
      data: { status: "PENDING", dueAt, periodStart, periodEnd },
    });
    if (count === 0) throw invoiceNotReopenableError();
    return { invoice, dueAt, periodStart, periodEnd };
  });

  await audit.log({
    actorId,
    scope: "SYSTEM",
    tenantId: result.invoice.tenantId,
    action: "SUBSCRIPTION_INVOICE_REOPENED",
    targetType: "SubscriptionInvoice",
    targetId: result.invoice.id,
    metadata: {
      code: result.invoice.code,
      provider: result.invoice.provider,
      amountVnd: result.invoice.amountVnd,
      fromStatus: result.invoice.status,
      toStatus: "PENDING",
      dueAt: result.dueAt,
      periodStart: result.periodStart,
      periodEnd: result.periodEnd,
      ...(reopenNote ? { note: reopenNote } : {}),
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
        // ADR-069: id thuê bao của gian hàng — menu "Xem chi tiết" ở tab "Tất cả".
        tenant: { select: { id: true, name: true, slug: true, subscription: { select: { id: true } } } },
        plan: { select: { code: true, name: true } },
      },
    }),
    prisma.subscriptionInvoice.count({ where }),
  ]).catch((error: unknown) => {
    if (input.provider && isMissingEnumValueError(error)) return [[], 0] as const;
    throw error;
  });
  // ADR-067: trạng thái đích hợp lệ tính ở server, truyền xuống hộp "Đổi trạng thái…".
  return {
    items: items.map(({ tenant: { subscription, ...tenant }, ...item }) => ({
      ...item,
      tenant,
      subscriptionId: subscription?.id ?? null,
      statusTargets: invoiceStatusTargets(item.status),
    })),
    total,
    page,
    pageSize,
  };
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
            // ADR-066: đủ dữ liệu cho cột "Hoá đơn gần nhất" (mã/trạng thái/số tiền/cổng) + nút xác nhận tay ở cột "Thao tác".
            subscriptionInvoices: {
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: 1,
              select: { id: true, code: true, status: true, amountVnd: true, provider: true },
            },
          },
        },
      },
    }),
    prisma.subscription.count({ where }),
  ]);
  const items = rows.map(({ tenant: { subscriptionInvoices, ...tenant }, ...row }) => {
    const latest = subscriptionInvoices[0];
    return {
      ...row,
      tenant,
      // ADR-067: kèm trạng thái đích hợp lệ cho nút "Đổi trạng thái…" (điều kiện "mới nhất / không có PENDING khác" của mở lại
      // chỉ kiểm ở server lúc thực hiện).
      latestInvoice: latest ? { ...latest, statusTargets: invoiceStatusTargets(latest.status) } : null,
    };
  });
  return { items, total, page, pageSize };
}

// ───────────────────────── ADR-069 + ADR-071 (2A): chi tiết đơn hàng gói (System Center) ─────────────────────────

export type SubscriptionActivityKind = "INVOICE_CREATED" | "PAYMENT" | "INVOICE_VOIDED" | "INVOICE_REOPENED" | "EMAIL" | "OTHER";
export type SubscriptionPaymentSource = "AUTO_SEPAY" | "AUTO_MOMO" | "AUTO_OTHER" | "ADMIN_MANUAL" | "ADMIN_FROM_TRANSACTION";
export type SubscriptionEmailKind = "INVOICE_PAID" | "INVOICE_EXPIRED" | "INVOICE_AMOUNT_MISMATCH" | "INVOICE_PAYMENT_FAILED" | "INVOICE_VOIDED";
export interface AdminSubscriptionActivityEntry {
  id: string;                       // id audit | "created:{invoiceId}" (suy ra) | "email:{logId}"
  kind: SubscriptionActivityKind;
  action: string | null;            // mã audit gốc; null với dòng suy ra/email
  actionLabel: string;              // auditActionLabel — UI dùng cho OTHER
  createdAt: Date;
  inferred: boolean;                // dòng tạo hoá đơn suy ra từ invoice.createdAt
  actor: { label: string; role: "SYSTEM_ADMIN" | "TENANT_OWNER" | "OTHER" } | null; // null = tự động / không rõ
  invoice: { code: string; amountVnd: number; provider: PaymentProviderId } | null;
  planName: string | null;          // chỉ INVOICE_CREATED
  paymentSource: SubscriptionPaymentSource | null;   // chỉ PAYMENT
  lateConfirmation: boolean;
  receivedVnd: number | null;       // receivedAmountVnd (từ giao dịch) hoặc tổng GD khớp (webhook); null nếu không biết
  differenceVnd: number | null;     // receivedVnd − invoice.amountVnd
  bankTransactions: Array<{ provider: PaymentProviderId; reference: string | null; occurredAt: Date | null; contentExcerpt: string | null; amountVnd: number }>; // chỉ PAYMENT; [] nếu không có
  fromStatus: string | null;        // PAYMENT luôn có: suy ra PENDING, EXPIRED khi xác nhận trễ
  toStatus: string | null;
  note: string | null;
  email: { kind: SubscriptionEmailKind; status: "SENT" | "FAILED"; recipientIsCurrentOwner: boolean; recipientMasked: string | null } | null; // chỉ EMAIL
}

export interface AdminSubscriptionDetail {
  id: string; status: DbSubscriptionStatus; currentPeriodStart: Date; currentPeriodEnd: Date; graceEndsAt: Date | null;
  plan: { code: string; name: string; isFree: boolean; priceVnd: number };
  tenant: { id: string; name: string; slug: string; status: string };
  invoices: Array<{ id: string; code: string; status: DbInvoiceStatus; provider: DbPaymentProviderId; amountVnd: number;
    periodStart: Date; periodEnd: Date; createdAt: Date; dueAt: Date; paidAt: Date | null; statusTargets: InvoiceStatusTarget[] }>;
  activity: AdminSubscriptionActivityEntry[];
}

/** Trần số dòng đọc cho trang chi tiết (an toàn hiệu năng — một gian hàng thực tế có vài chục hoá đơn). */
const ADMIN_DETAIL_INVOICE_LIMIT = 500;
const ADMIN_DETAIL_ACTIVITY_LIMIT = 100;
const BANK_CONTENT_EXCERPT_MAX = 80;

/** ADR-070/071: loại email hoá đơn gói (ghi EmailSendLog) → loại hiển thị trong nhật ký. Email nhắc hạn/ân hạn KHÔNG đưa vào. */
const INVOICE_EMAIL_KIND_BY_TYPE: Record<string, SubscriptionEmailKind> = {
  subscription_invoice_paid: "INVOICE_PAID",
  subscription_invoice_expired: "INVOICE_EXPIRED",
  subscription_invoice_amount_mismatch: "INVOICE_AMOUNT_MISMATCH",
  subscription_invoice_payment_failed: "INVOICE_PAYMENT_FAILED",
  subscription_invoice_voided: "INVOICE_VOIDED",
};

const ACTIVITY_KIND_BY_ACTION: Record<string, SubscriptionActivityKind> = {
  SUBSCRIPTION_INVOICE_CREATED: "INVOICE_CREATED",
  SUBSCRIPTION_PAID: "PAYMENT",
  SUBSCRIPTION_INVOICE_VOIDED: "INVOICE_VOIDED",
  SUBSCRIPTION_INVOICE_REOPENED: "INVOICE_REOPENED",
};

function metadataString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function metadataNumber(meta: Record<string, unknown>, key: string): number | null {
  const value = meta[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

/** ADR-071: nguồn thanh toán từ `metadata.source` + cổng của hoá đơn. */
function paymentSourceOf(source: string | null, provider: PaymentProviderId | null): SubscriptionPaymentSource {
  if (source === "ADMIN_MANUAL_CONFIRM") return "ADMIN_MANUAL";
  if (source === "ADMIN_TRANSACTION_CONFIRM") return "ADMIN_FROM_TRANSACTION";
  if (provider === "SEPAY") return "AUTO_SEPAY";
  if (provider === "MOMO") return "AUTO_MOMO";
  return "AUTO_OTHER";
}

/** Email người nhận khác chủ hiện tại → che dạng "ng•••@gmail.com" (không lộ đầy đủ). */
function maskRecipient(email: string): string {
  const at = email.lastIndexOf("@");
  if (at <= 0) return "•••";
  return `${email.slice(0, Math.min(2, at))}•••${email.slice(at)}`;
}

/** SePay `transactionDate` "YYYY-MM-DD HH:mm:ss" là giờ Việt Nam → UTC (+07:00). Sai định dạng → null. */
function parseSepayTransactionDate(value: unknown): Date | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2})?)$/.exec(value.trim());
  if (!match) return null;
  const date = new Date(`${match[1]}T${match[2]}+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function contentExcerpt(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const line = value.replace(/\s+/g, " ").trim();
  if (!line) return null;
  return line.length > BANK_CONTENT_EXCERPT_MAX ? `${line.slice(0, BANK_CONTENT_EXCERPT_MAX)}…` : line;
}

/**
 * ADR-071: chỉ trích mã GD, thời điểm, nội dung CK (một dòng, ≤ 80 ký tự) và số tiền từ `rawPayload` — KHÔNG trả payload thô.
 * SePay: `id` (mã giao dịch SePay; thiếu thì `referenceCode`), `transactionDate` (giờ VN), `content`. MoMo: `transId`,
 * `responseTime` (ms), `orderInfo`.
 */
function bankTransactionView(txn: { provider: PaymentProviderId; amountVnd: number; rawPayload: unknown }): AdminSubscriptionActivityEntry["bankTransactions"][number] {
  const raw = asRecord(txn.rawPayload);
  const idOf = (value: unknown) => (typeof value === "string" || typeof value === "number") && String(value).trim() ? String(value).trim() : null;
  if (txn.provider === "SEPAY") {
    return {
      provider: txn.provider,
      reference: idOf(raw.id) ?? idOf(raw.referenceCode),
      occurredAt: parseSepayTransactionDate(raw.transactionDate),
      contentExcerpt: contentExcerpt(raw.content),
      amountVnd: txn.amountVnd,
    };
  }
  if (txn.provider === "MOMO") {
    const responseTime = typeof raw.responseTime === "number" ? new Date(raw.responseTime) : null;
    return {
      provider: txn.provider,
      reference: idOf(raw.transId),
      occurredAt: responseTime && !Number.isNaN(responseTime.getTime()) ? responseTime : null,
      contentExcerpt: contentExcerpt(raw.orderInfo),
      amountVnd: txn.amountVnd,
    };
  }
  return { provider: txn.provider, reference: null, occurredAt: null, contentExcerpt: null, amountVnd: txn.amountVnd };
}

/**
 * ADR-069 + ADR-071 (2A) — dữ liệu trang `/admin/subscriptions/[subscriptionId]`. TIỀN ĐIỀU KIỆN: nơi gọi đã kiểm quyền System Admin.
 * Chỉ đọc bảng L1 (subscriptions, plans, tenants, subscription_invoices, subscription_refund_requests — chỉ id, users — tên/email/vai
 * trò người làm, platform_payment_transactions — chỉ các trường trích ở trên), `audit_logs` (giới hạn ĐÚNG mục tiêu là hoá đơn gói /
 * yêu cầu hoàn tiền gói của gian hàng này) và `email_send_log` (chỉ 5 loại email hoá đơn gói, ghép theo mã hoá đơn trong tiêu đề).
 * Không đọc đơn hàng/khách hàng của gian hàng (§7.9).
 * Nhật ký = dòng audit + dòng "Tạo hoá đơn" SUY RA cho hoá đơn chưa có audit tạo + dòng email; mới nhất trước, tối đa 100 dòng.
 * Bảng audit chưa có → chỉ còn dòng suy ra và email.
 */
export async function getAdminSubscriptionDetail(subscriptionId: string): Promise<AdminSubscriptionDetail | null> {
  const prisma = getPrismaClient();
  const subscription = await prisma.subscription.findUnique({
    where: { id: subscriptionId },
    select: {
      id: true,
      status: true,
      currentPeriodStart: true,
      currentPeriodEnd: true,
      graceEndsAt: true,
      plan: { select: { code: true, name: true, isFree: true, priceVnd: true } },
      tenant: { select: { id: true, name: true, slug: true, status: true, ownerId: true, owner: { select: { email: true } } } },
    },
  });
  if (!subscription) return null;
  const { ownerId, owner, ...tenant } = subscription.tenant;
  const tenantId = tenant.id;

  const invoiceRows = await prisma.subscriptionInvoice.findMany({
    where: { tenantId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: ADMIN_DETAIL_INVOICE_LIMIT,
    select: {
      id: true,
      code: true,
      status: true,
      provider: true,
      amountVnd: true,
      periodStart: true,
      periodEnd: true,
      createdAt: true,
      dueAt: true,
      paidAt: true,
      plan: { select: { name: true } },
    },
  });
  const invoiceIds = invoiceRows.map((row) => row.id);
  const invoiceById = new Map(invoiceRows.map((row) => [row.id, row]));

  const [refundRequests, transactions] =
    invoiceIds.length > 0
      ? await Promise.all([
          prisma.subscriptionRefundRequest.findMany({ where: { invoiceId: { in: invoiceIds } }, select: { id: true, invoiceId: true } }),
          prisma.platformPaymentTransaction.findMany({
            where: { matchedInvoiceId: { in: invoiceIds } },
            orderBy: [{ createdAt: "asc" }, { id: "asc" }],
            select: { id: true, provider: true, amountVnd: true, rawPayload: true, matchedInvoiceId: true },
          }),
        ])
      : [[], []];
  const invoiceIdByRefundId = new Map(refundRequests.map((row) => [row.id, row.invoiceId]));
  const transactionsByInvoiceId = new Map<string, typeof transactions>();
  for (const txn of transactions) {
    if (!txn.matchedInvoiceId) continue;
    transactionsByInvoiceId.set(txn.matchedInvoiceId, [...(transactionsByInvoiceId.get(txn.matchedInvoiceId) ?? []), txn]);
  }

  const auditMissing = (error: unknown) => {
    if (isAuditTableMissing(error)) return [];
    throw error;
  };
  const [auditRows, createdAuditRows] =
    invoiceIds.length > 0
      ? await Promise.all([
          prisma.auditLog
            .findMany({
              where: {
                tenantId,
                OR: [
                  { targetType: "SubscriptionInvoice", targetId: { in: invoiceIds } },
                  ...(refundRequests.length > 0
                    ? [{ targetType: "SubscriptionRefundRequest", targetId: { in: refundRequests.map((row) => row.id) } }]
                    : []),
                ],
              },
              orderBy: [{ createdAt: "desc" }, { id: "desc" }],
              take: ADMIN_DETAIL_ACTIVITY_LIMIT,
              select: { id: true, action: true, actorId: true, targetType: true, targetId: true, metadata: true, createdAt: true },
            })
            .catch(auditMissing),
          // Hoá đơn nào đã có audit tạo (đọc riêng, không giới hạn bởi 100 dòng ở trên) — còn lại → dòng suy ra.
          prisma.auditLog
            .findMany({
              where: { tenantId, action: "SUBSCRIPTION_INVOICE_CREATED", targetType: "SubscriptionInvoice", targetId: { in: invoiceIds } },
              select: { targetId: true },
            })
            .catch(auditMissing),
        ])
      : [[], []];
  const invoicesWithCreatedAudit = new Set(createdAuditRows.map((row) => row.targetId));

  // Email hoá đơn gói: chỉ 5 loại `subscription_invoice_*`, tiêu đề chứa mã hoá đơn của gian hàng (mã duy nhất toàn hệ thống).
  const emailRows =
    invoiceRows.length > 0
      ? await prisma.emailSendLog.findMany({
          where: {
            type: { in: Object.keys(INVOICE_EMAIL_KIND_BY_TYPE) },
            OR: invoiceRows.map((row) => ({ subject: { contains: row.code } })),
          },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: ADMIN_DETAIL_ACTIVITY_LIMIT,
          select: { id: true, type: true, recipient: true, subject: true, status: true, createdAt: true },
        })
      : [];

  const actorIds = [...new Set(auditRows.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: actorIds } },
          select: { id: true, email: true, systemRole: true, profile: { select: { fullName: true } } },
        })
      : [];
  const actorById = new Map(actors.map((user) => [user.id, user]));
  const actorOf = (actorId: string | null): AdminSubscriptionActivityEntry["actor"] => {
    if (!actorId) return null;
    const user = actorById.get(actorId);
    if (!user) return { label: "Tài khoản đã xoá", role: "OTHER" };
    const role = user.systemRole === "SYSTEM_ADMIN" ? "SYSTEM_ADMIN" : user.id === ownerId ? "TENANT_OWNER" : "OTHER";
    return { label: user.profile?.fullName ?? user.email, role };
  };
  const invoiceRef = (invoiceId: string | null): AdminSubscriptionActivityEntry["invoice"] => {
    const row = invoiceId ? invoiceById.get(invoiceId) : undefined;
    return row ? { code: row.code, amountVnd: row.amountVnd, provider: row.provider } : null;
  };
  const blank = {
    inferred: false,
    actor: null,
    invoice: null,
    planName: null,
    paymentSource: null,
    lateConfirmation: false,
    receivedVnd: null,
    differenceVnd: null,
    bankTransactions: [],
    fromStatus: null,
    toStatus: null,
    note: null,
    email: null,
  } satisfies Omit<AdminSubscriptionActivityEntry, "id" | "kind" | "action" | "actionLabel" | "createdAt">;

  const auditEntries = auditRows.map((row): AdminSubscriptionActivityEntry => {
    const meta = asRecord(row.metadata);
    const invoiceId =
      row.targetType === "SubscriptionInvoice" ? row.targetId : row.targetId ? (invoiceIdByRefundId.get(row.targetId) ?? null) : null;
    const invoice = invoiceRef(invoiceId);
    const kind = ACTIVITY_KIND_BY_ACTION[row.action] ?? "OTHER";
    const common = {
      ...blank,
      id: row.id,
      kind,
      action: row.action,
      actionLabel: auditActionLabel(row.action),
      createdAt: row.createdAt,
      actor: actorOf(row.actorId),
      invoice,
      fromStatus: metadataString(meta, "fromStatus"),
      toStatus: metadataString(meta, "toStatus"),
      note: metadataString(meta, "note"),
    };
    if (kind === "INVOICE_CREATED") {
      return { ...common, planName: (invoiceId ? invoiceById.get(invoiceId)?.plan.name : undefined) ?? null, toStatus: common.toStatus ?? "PENDING" };
    }
    if (kind !== "PAYMENT") return common;

    const lateConfirmation = meta.lateConfirmation === true || metadataString(meta, "previousInvoiceStatus") === "EXPIRED";
    // Giao dịch ngân hàng: mọi giao dịch đã gắn hoá đơn + giao dịch admin chọn (`metadata.transactionId`), không trùng.
    const linked = invoiceId ? (transactionsByInvoiceId.get(invoiceId) ?? []) : [];
    const chosenId = metadataString(meta, "transactionId");
    const chosen = chosenId ? transactions.find((txn) => txn.id === chosenId) : undefined;
    const bankTxns = chosen && !linked.some((txn) => txn.id === chosen.id) ? [...linked, chosen] : linked;
    const receivedVnd =
      metadataNumber(meta, "receivedAmountVnd") ?? (bankTxns.length > 0 ? bankTxns.reduce((sum, txn) => sum + txn.amountVnd, 0) : null);
    return {
      ...common,
      paymentSource: paymentSourceOf(metadataString(meta, "source"), invoice?.provider ?? null),
      lateConfirmation,
      receivedVnd,
      differenceVnd: receivedVnd !== null && invoice ? receivedVnd - invoice.amountVnd : null,
      bankTransactions: bankTxns.map(bankTransactionView),
      // `SUBSCRIPTION_PAID` không ghi fromStatus → suy ra: EXPIRED khi xác nhận trễ, ngược lại PENDING.
      fromStatus: common.fromStatus ?? (lateConfirmation ? "EXPIRED" : "PENDING"),
      toStatus: common.toStatus ?? "PAID",
    };
  });

  const inferredCreated = invoiceRows
    .filter((row) => !invoicesWithCreatedAudit.has(row.id))
    .map(
      (row): AdminSubscriptionActivityEntry => ({
        ...blank,
        id: `created:${row.id}`,
        kind: "INVOICE_CREATED",
        action: null,
        actionLabel: auditActionLabel("SUBSCRIPTION_INVOICE_CREATED"),
        createdAt: row.createdAt,
        inferred: true,
        invoice: invoiceRef(row.id),
        planName: row.plan.name,
        toStatus: "PENDING",
      }),
    );

  const ownerEmail = owner.email.trim().toLowerCase();
  const emailEntries = emailRows.flatMap((log): AdminSubscriptionActivityEntry[] => {
    const emailKind = INVOICE_EMAIL_KIND_BY_TYPE[log.type];
    // Mã hoá đơn dài nhất khớp tiêu đề (tránh mã là tiền tố của mã khác).
    const matched = invoiceRows.filter((row) => log.subject.includes(row.code)).sort((a, b) => b.code.length - a.code.length)[0];
    if (!emailKind || !matched) return [];
    const isOwner = log.recipient.trim().toLowerCase() === ownerEmail;
    return [
      {
        ...blank,
        id: `email:${log.id}`,
        kind: "EMAIL",
        action: null,
        actionLabel: "Gửi email hoá đơn gói dịch vụ",
        createdAt: log.createdAt,
        invoice: invoiceRef(matched.id),
        email: {
          kind: emailKind,
          status: log.status === "SENT" ? "SENT" : "FAILED",
          recipientIsCurrentOwner: isOwner,
          recipientMasked: isOwner ? null : maskRecipient(log.recipient),
        },
      },
    ];
  });

  const activity = [...auditEntries, ...inferredCreated, ...emailEntries]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime() || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0))
    .slice(0, ADMIN_DETAIL_ACTIVITY_LIMIT);

  return {
    id: subscription.id,
    status: subscription.status,
    currentPeriodStart: subscription.currentPeriodStart,
    currentPeriodEnd: subscription.currentPeriodEnd,
    graceEndsAt: subscription.graceEndsAt,
    plan: subscription.plan,
    tenant,
    invoices: invoiceRows.map((row) => ({
      id: row.id,
      code: row.code,
      status: row.status,
      provider: row.provider,
      amountVnd: row.amountVnd,
      periodStart: row.periodStart,
      periodEnd: row.periodEnd,
      createdAt: row.createdAt,
      dueAt: row.dueAt,
      paidAt: row.paidAt,
      statusTargets: invoiceStatusTargets(row.status),
    })),
    activity,
  };
}

/** Lựa chọn cho bộ lọc gói ở /admin/subscriptions (kể cả gói đã ngừng bán — thuê bao cũ vẫn có thể đang dùng). */
export async function listPlanFilterOptions() {
  const prisma = getPrismaClient();
  return prisma.plan.findMany({ orderBy: [{ priceVnd: "asc" }, { code: "asc" }], select: { code: true, name: true } });
}
