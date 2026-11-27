import {
  AppError,
  DISPLAY_TIME_ZONE,
  evaluateRefundEligibility,
  logger,
  maskAccountNo,
  normalizeRefundText,
  parseRefundPayoutInput,
  REFUND_INELIGIBLE_MESSAGES,
  SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX,
  SUBSCRIPTION_REFUND_ERROR_CODES,
  SUBSCRIPTION_REFUND_REASON_MAX,
  type RefundEligibility,
  type RefundPayoutDetails,
  type RefundPayoutField,
  type SubscriptionRefundStatusValue,
} from "@gieochu/core";
import { getPrismaClient, Prisma } from "@gieochu/db";
import { decryptSecret, encryptSecret } from "@gieochu/payments";
import { renderSubscriptionRefundEmail, type SubscriptionRefundEmailStage } from "@gieochu/email";
import { getEnv } from "@gieochu/config";
import { audit } from "./audit";
import { getEffectiveBrand } from "./branding";
import { sendEmailNow } from "./email-dispatch";
import { downgradeToFree } from "./subscription-sweep";

/**
 * ADR-041 B (+ bổ sung) — hoàn tiền gói trả phí. Bảng `subscription_refund_requests`, `subscription_invoices`,
 * `subscriptions`, `plans`, `bank_bins` đều L1 (billing nền tảng, PaymentScope PLATFORM) → `getPrismaClient()`.
 * Caller gác quyền: chủ gian hàng qua `requireTenantMember(slug)` (OWNER), admin qua `requireRole("SYSTEM_ADMIN")`.
 *
 * - Điều kiện yêu cầu luôn tính lại ở server (`evaluateRefundEligibility`): hoá đơn đầu tiên đã thanh toán của tenant,
 *   ≤ 7 ngày từ `paidAt`, chưa có yêu cầu. Client không gửi id hoá đơn/số tiền.
 * - Thông tin nhận tiền mã hoá AES-256-GCM (`PAYMENT_ENCRYPTION_KEY`); chỉ admin giải mã; đặt NULL khi xử lý xong
 *   (CHECK trong migration). KHÔNG đưa vào audit/log/email.
 * - Bảng chưa có (code lên trước migration) → `available:false` / AppError `REFUND_UNAVAILABLE` (không 500).
 */

const UNAVAILABLE_MESSAGE = "Chức năng hoàn tiền gói đang được cập nhật — vui lòng thử lại sau.";

/** Bảng/enum mới chưa tồn tại (migration ADR-041 B chưa áp): P2021 (bảng), 42P01, 42704/22P02 (kiểu/giá trị enum). */
export function isRefundSchemaMissing(error: unknown): boolean {
  if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2021") return true;
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /42P01|42704|subscription_refund_requests.*does not exist|SubscriptionRefundStatus|invalid input value for enum "SubscriptionInvoiceStatus"/i.test(text);
}

function unavailableError(): AppError {
  return new AppError({ code: SUBSCRIPTION_REFUND_ERROR_CODES.UNAVAILABLE, message: UNAVAILABLE_MESSAGE, httpStatus: 503 });
}

function formatVnd(amount: number): string {
  return `${amount.toLocaleString("vi-VN")}đ`;
}

export function formatRefundDate(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
}

// ───────────────────────── Phía chủ gian hàng ─────────────────────────

export interface TenantRefundRequestView {
  id: string;
  status: SubscriptionRefundStatusValue;
  amountVnd: number;
  invoiceCode: string;
  reason: string | null;
  /** Lý do từ chối / ghi chú admin — chủ gian hàng được xem. */
  adminNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  refundedAt: Date | null;
}

export interface TenantRefundState {
  /** false = migration chưa áp → UI ẩn nút, hiện ghi chú "chưa sẵn sàng". */
  available: boolean;
  /** Yêu cầu đã gửi (mỗi tenant tối đa 1). */
  request: TenantRefundRequestView | null;
  eligibility: RefundEligibility;
  /** Hoá đơn thanh toán đầu tiên (để UI hiện mã + số tiền sẽ hoàn). */
  firstPaidInvoice: { id: string; code: string; amountVnd: number; paidAt: Date } | null;
  /** Thông báo vì sao không yêu cầu được (null khi được phép hoặc chưa từng thanh toán). */
  ineligibleMessage: string | null;
}

async function findFirstPaidInvoice(tenantId: string) {
  return getPrismaClient().subscriptionInvoice.findFirst({
    where: { tenantId, status: { in: ["PAID", "REFUNDED"] }, paidAt: { not: null } },
    orderBy: [{ paidAt: "asc" }, { createdAt: "asc" }],
    select: { id: true, code: true, status: true, amountVnd: true, paidAt: true },
  });
}

/**
 * Bổ sung ADR-041 lần 2: số hoá đơn gói PAID khác hoá đơn đầu (bất kỳ, thanh toán sau) — > 0 thì mất quyền yêu cầu hoàn
 * và admin không được duyệt "Đã hoàn" (chỉ Từ chối). Nhận client hoặc transaction.
 */
async function countLaterPaidInvoices(
  tenantId: string,
  firstInvoiceId: string,
  db: Pick<ReturnType<typeof getPrismaClient>, "subscriptionInvoice"> | Prisma.TransactionClient = getPrismaClient(),
): Promise<number> {
  return db.subscriptionInvoice.count({ where: { tenantId, status: "PAID", id: { not: firstInvoiceId } } });
}

function laterPaymentError(message: string): AppError {
  return new AppError({ code: SUBSCRIPTION_REFUND_ERROR_CODES.LATER_PAYMENT, message, httpStatus: 409 });
}

export async function getTenantRefundState(tenantId: string, now = new Date()): Promise<TenantRefundState> {
  const firstPaid = await findFirstPaidInvoice(tenantId);
  const firstPaidInvoice = firstPaid?.paidAt
    ? { id: firstPaid.id, code: firstPaid.code, amountVnd: firstPaid.amountVnd, paidAt: firstPaid.paidAt }
    : null;

  let request: TenantRefundRequestView | null = null;
  let available = true;
  try {
    const row = await getPrismaClient().subscriptionRefundRequest.findUnique({
      where: { tenantId },
      select: {
        id: true,
        status: true,
        amountVnd: true,
        reason: true,
        adminNote: true,
        createdAt: true,
        decidedAt: true,
        refundedAt: true,
        invoice: { select: { code: true } },
      },
    });
    if (row) {
      request = {
        id: row.id,
        status: row.status,
        amountVnd: row.amountVnd,
        invoiceCode: row.invoice.code,
        reason: row.reason,
        adminNote: row.adminNote,
        createdAt: row.createdAt,
        decidedAt: row.decidedAt,
        refundedAt: row.refundedAt,
      };
    }
  } catch (error) {
    if (!isRefundSchemaMissing(error)) throw error;
    available = false;
  }

  const laterPaidInvoiceCount = firstPaid ? await countLaterPaidInvoices(tenantId, firstPaid.id) : 0;
  const eligibility = evaluateRefundEligibility({ firstPaidInvoice: firstPaid, hasAnyRequest: request !== null, laterPaidInvoiceCount, now });
  const ineligibleMessage =
    eligibility.eligible || eligibility.reason === "NO_PAID_INVOICE" ? null : REFUND_INELIGIBLE_MESSAGES[eligibility.reason];
  return { available, request, eligibility, firstPaidInvoice, ineligibleMessage };
}

export interface RequestRefundInput {
  tenantId: string;
  userId: string;
  reason: unknown;
  bankBin: unknown;
  accountNo: unknown;
  accountName: unknown;
}

export type RequestRefundResult = { ok: true } | { ok: false; error: string; fieldErrors?: Partial<Record<RefundPayoutField, string>> };

/** Chủ gian hàng gửi yêu cầu. Điều kiện + số tiền tính lại ở server; trùng (race) → unique `tenantId`/`invoiceId`. */
export async function requestSubscriptionRefund(input: RequestRefundInput): Promise<RequestRefundResult> {
  const payout = parseRefundPayoutInput(input);
  if (!payout.ok) return { ok: false, error: "Vui lòng kiểm tra lại thông tin nhận tiền.", fieldErrors: payout.fieldErrors };

  const prisma = getPrismaClient();
  const bank = await prisma.bankBin.findUnique({ where: { bin: payout.value.bankBin }, select: { name: true, shortName: true } });
  if (!bank) return { ok: false, error: "Vui lòng kiểm tra lại thông tin nhận tiền.", fieldErrors: { bankBin: "Ngân hàng không hợp lệ." } };

  const state = await getTenantRefundState(input.tenantId);
  if (!state.available) throw unavailableError();
  if (!state.eligibility.eligible) {
    // Bổ sung ADR-041 lần 2: từ chối bằng AppError 409 mã riêng (client không thể vượt qua dù form bị gửi tay).
    if (state.eligibility.reason === "LATER_PAYMENT") throw laterPaymentError(REFUND_INELIGIBLE_MESSAGES.LATER_PAYMENT);
    const message = state.ineligibleMessage ?? REFUND_INELIGIBLE_MESSAGES.NO_PAID_INVOICE;
    return { ok: false, error: message };
  }

  const details: RefundPayoutDetails = {
    bankBin: payout.value.bankBin,
    bankName: `${bank.shortName} — ${bank.name}`,
    accountNo: payout.value.accountNo,
    accountName: payout.value.accountName,
  };
  const payoutEncrypted = encryptSecret(JSON.stringify(details), getEnv().PAYMENT_ENCRYPTION_KEY);
  const { invoiceId, amountVnd } = state.eligibility;

  let created: { id: string };
  try {
    created = await prisma.subscriptionRefundRequest.create({
      data: {
        tenantId: input.tenantId,
        invoiceId,
        requestedById: input.userId,
        reason: normalizeRefundText(input.reason, SUBSCRIPTION_REFUND_REASON_MAX),
        payoutEncrypted,
        amountVnd,
      },
      select: { id: true },
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, error: REFUND_INELIGIBLE_MESSAGES.ALREADY_REQUESTED };
    }
    if (isRefundSchemaMissing(error)) throw unavailableError();
    throw error;
  }

  // Không ghi thông tin nhận tiền vào audit/log (bổ sung ADR-041).
  await audit.log({
    actorId: input.userId,
    scope: "SYSTEM",
    tenantId: input.tenantId,
    action: "SUBSCRIPTION_REFUND_REQUESTED",
    targetType: "SubscriptionRefundRequest",
    targetId: created.id,
    metadata: { invoiceId, amountVnd },
  });
  await notifyTenant(input.tenantId, "REQUESTED", created.id);
  return { ok: true };
}

// ───────────────────────── Phía admin (System Center) ─────────────────────────

export interface AdminRefundListItem {
  id: string;
  status: SubscriptionRefundStatusValue;
  amountVnd: number;
  reason: string | null;
  adminNote: string | null;
  createdAt: Date;
  decidedAt: Date | null;
  refundedAt: Date | null;
  tenant: { id: string; name: string; slug: string };
  invoice: { id: string; code: string; paidAt: Date | null; planName: string };
  /** Thông tin nhận tiền đã che (chỉ khi REQUESTED). `null` = đã xoá / không đọc được. */
  payoutMasked: { bankName: string; accountNoMasked: string } | null;
  /** Bổ sung ADR-041 lần 2: tenant đã có hoá đơn gói PAID khác → không được "Đã hoàn", chỉ Từ chối. */
  approveBlocked: boolean;
}

export interface AdminRefundList {
  available: boolean;
  items: AdminRefundListItem[];
}

function decryptPayout(payoutEncrypted: string): RefundPayoutDetails | null {
  try {
    const parsed = JSON.parse(decryptSecret(payoutEncrypted, getEnv().PAYMENT_ENCRYPTION_KEY)) as Partial<RefundPayoutDetails>;
    if (typeof parsed.accountNo !== "string" || typeof parsed.accountName !== "string" || typeof parsed.bankName !== "string") return null;
    return { bankBin: String(parsed.bankBin ?? ""), bankName: parsed.bankName, accountNo: parsed.accountNo, accountName: parsed.accountName };
  } catch {
    // Không log nội dung — chỉ báo không giải mã được.
    logger.warn("subscription-refund: không giải mã được thông tin nhận tiền");
    return null;
  }
}

const ADMIN_LIST_LIMIT = 100;

/**
 * Số yêu cầu hoàn tiền đang chờ (`REQUESTED`) → badge menu "Hoàn tiền gói" ở System Center. Bảng chưa có → 0.
 * Caller gác quyền (`requireAdminAccess` ở `admin/layout.tsx`); chỉ trả một con số L1, không dữ liệu tenant.
 */
export async function countPendingRefundRequests(): Promise<number> {
  try {
    return await getPrismaClient().subscriptionRefundRequest.count({ where: { status: "REQUESTED" } });
  } catch (error) {
    if (isRefundSchemaMissing(error)) return 0;
    throw error;
  }
}

/** Danh sách yêu cầu (mặc định: đang chờ trước, mới nhất trước). §7.9: chỉ dữ liệu billing L1 của tenant. */
export async function listRefundRequestsForAdmin(filter: { status?: SubscriptionRefundStatusValue } = {}): Promise<AdminRefundList> {
  const prisma = getPrismaClient();
  try {
    const rows = await prisma.subscriptionRefundRequest.findMany({
      where: filter.status ? { status: filter.status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: ADMIN_LIST_LIMIT,
      include: {
        tenant: { select: { id: true, name: true, slug: true } },
        invoice: { select: { id: true, code: true, paidAt: true, plan: { select: { name: true } } } },
      },
    });
    const otherPaid = rows.length
      ? await prisma.subscriptionInvoice.groupBy({
          by: ["tenantId"],
          where: { tenantId: { in: rows.map((row) => row.tenantId) }, status: "PAID", id: { notIn: rows.map((row) => row.invoiceId) } },
          _count: { _all: true },
        })
      : [];
    const otherPaidByTenant = new Map(otherPaid.map((row) => [row.tenantId, row._count._all]));
    return {
      available: true,
      items: rows.map((row) => {
        const payout = row.payoutEncrypted ? decryptPayout(row.payoutEncrypted) : null;
        return {
          id: row.id,
          status: row.status,
          amountVnd: row.amountVnd,
          reason: row.reason,
          adminNote: row.adminNote,
          createdAt: row.createdAt,
          decidedAt: row.decidedAt,
          refundedAt: row.refundedAt,
          tenant: row.tenant,
          invoice: { id: row.invoice.id, code: row.invoice.code, paidAt: row.invoice.paidAt, planName: row.invoice.plan.name },
          payoutMasked: payout ? { bankName: payout.bankName, accountNoMasked: maskAccountNo(payout.accountNo) } : null,
          approveBlocked: (otherPaidByTenant.get(row.tenantId) ?? 0) > 0,
        };
      }),
    };
  } catch (error) {
    if (isRefundSchemaMissing(error)) return { available: false, items: [] };
    throw error;
  }
}

/** Admin bấm "Xem" — trả đầy đủ thông tin nhận tiền của yêu cầu đang chờ. Audit chỉ ghi id (không ghi nội dung). */
export async function revealRefundPayout(requestId: string, actorId: string): Promise<RefundPayoutDetails> {
  let row: { status: SubscriptionRefundStatusValue; payoutEncrypted: string | null; tenantId: string } | null;
  try {
    row = await getPrismaClient().subscriptionRefundRequest.findUnique({
      where: { id: requestId },
      select: { status: true, payoutEncrypted: true, tenantId: true },
    });
  } catch (error) {
    if (isRefundSchemaMissing(error)) throw unavailableError();
    throw error;
  }
  if (!row) throw new AppError({ code: "NOT_FOUND", message: "Không tìm thấy yêu cầu hoàn tiền.", httpStatus: 404 });
  if (row.status !== "REQUESTED" || !row.payoutEncrypted) {
    throw new AppError({ code: SUBSCRIPTION_REFUND_ERROR_CODES.NOT_PENDING, message: "Yêu cầu đã xử lý — thông tin nhận tiền đã được xoá.", httpStatus: 409 });
  }
  const payout = decryptPayout(row.payoutEncrypted);
  if (!payout) throw new AppError({ code: "PAYOUT_UNREADABLE", message: "Không đọc được thông tin nhận tiền.", httpStatus: 500, expose: true });
  // Quốc duyệt: ghi dấu vết lần xem — CHỈ id yêu cầu, không ghi nội dung ngân hàng/số TK/tên chủ TK.
  await audit.log({
    actorId,
    scope: "SYSTEM",
    tenantId: row.tenantId,
    action: "SUBSCRIPTION_REFUND_PAYOUT_VIEWED",
    targetType: "SubscriptionRefundRequest",
    targetId: requestId,
  });
  return payout;
}

function notPendingError(): AppError {
  return new AppError({ code: SUBSCRIPTION_REFUND_ERROR_CODES.NOT_PENDING, message: "Yêu cầu này đã được xử lý.", httpStatus: 409 });
}

/**
 * Admin đã tự chuyển khoản → "Đã hoàn". Một transaction: yêu cầu → APPROVED_REFUNDED (xoá thông tin nhận tiền),
 * hoá đơn PAID → REFUNDED, thuê bao về gói Free ngay (`downgradeToFree`, không mất dữ liệu). Số tiền = số đã ghi ở yêu
 * cầu (= `amountVnd` hoá đơn). Điều kiện trạng thái đặt trong chính câu UPDATE (chống bấm 2 lần / 2 admin cùng lúc).
 */
export async function approveRefundRequest(requestId: string, actorId: string, adminNoteInput: unknown): Promise<void> {
  const prisma = getPrismaClient();
  const adminNote = normalizeRefundText(adminNoteInput, SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX);
  const now = new Date();
  let result: { tenantId: string; invoiceId: string; amountVnd: number; previousPlanId: string };
  try {
    result = await prisma.$transaction(async (tx) => {
      const request = await tx.subscriptionRefundRequest.findUnique({
        where: { id: requestId },
        select: { tenantId: true, invoiceId: true, amountVnd: true, status: true },
      });
      if (!request) throw new AppError({ code: "NOT_FOUND", message: "Không tìm thấy yêu cầu hoàn tiền.", httpStatus: 404 });
      if (request.status !== "REQUESTED") throw notPendingError();

      const freePlan = await tx.plan.findFirst({ where: { isFree: true, isActive: true }, select: { id: true } });
      if (!freePlan) {
        throw new AppError({ code: "FREE_PLAN_MISSING", message: "Chưa có gói Free đang bật — không thể chuyển gian hàng về Free.", httpStatus: 409 });
      }
      // Bổ sung ADR-041 lần 2: kiểm lại trong transaction — có hoá đơn gói PAID khác (kể cả thanh toán sau khi gửi
      // yêu cầu) thì không được hoàn, chỉ Từ chối.
      if ((await countLaterPaidInvoices(request.tenantId, request.invoiceId, tx)) > 0) {
        throw laterPaymentError("Gian hàng đã thanh toán thêm hoá đơn gói sau lần đầu — không thể đánh dấu hoàn tiền, chỉ có thể từ chối.");
      }
      const subscription = await tx.subscription.findUnique({ where: { tenantId: request.tenantId }, select: { id: true, planId: true } });
      if (!subscription) throw new AppError({ code: "SUBSCRIPTION_MISSING", message: "Gian hàng không có thuê bao.", httpStatus: 409 });

      const updated = await tx.subscriptionRefundRequest.updateMany({
        where: { id: requestId, status: "REQUESTED" },
        data: { status: "APPROVED_REFUNDED", decidedById: actorId, decidedAt: now, refundedAt: now, adminNote, payoutEncrypted: null },
      });
      if (updated.count !== 1) throw notPendingError();

      const invoice = await tx.subscriptionInvoice.updateMany({
        where: { id: request.invoiceId, status: "PAID" },
        data: { status: "REFUNDED" },
      });
      if (invoice.count !== 1) {
        throw new AppError({ code: "INVOICE_NOT_PAID", message: "Hoá đơn không còn ở trạng thái Đã thanh toán.", httpStatus: 409 });
      }

      await downgradeToFree(tx, subscription.id, freePlan.id, now);
      return { tenantId: request.tenantId, invoiceId: request.invoiceId, amountVnd: request.amountVnd, previousPlanId: subscription.planId };
    });
  } catch (error) {
    if (isRefundSchemaMissing(error)) throw unavailableError();
    throw error;
  }

  await audit.log({
    actorId,
    scope: "SYSTEM",
    tenantId: result.tenantId,
    action: "SUBSCRIPTION_REFUNDED",
    targetType: "SubscriptionRefundRequest",
    targetId: requestId,
    metadata: { invoiceId: result.invoiceId, amountVnd: result.amountVnd, previousPlanId: result.previousPlanId },
  });
  await notifyTenant(result.tenantId, "REFUNDED", requestId);
}

/** Admin từ chối kèm lý do (bắt buộc). Thông tin nhận tiền bị xoá; gói hiện tại không đổi. */
export async function rejectRefundRequest(requestId: string, actorId: string, reasonInput: unknown): Promise<void> {
  const adminNote = normalizeRefundText(reasonInput, SUBSCRIPTION_REFUND_ADMIN_NOTE_MAX);
  if (!adminNote) throw new AppError({ code: "VALIDATION_ERROR", message: "Vui lòng nhập lý do từ chối.", httpStatus: 400 });
  const prisma = getPrismaClient();
  let row: { tenantId: string; invoiceId: string; amountVnd: number } | null;
  try {
    const updated = await prisma.subscriptionRefundRequest.updateMany({
      where: { id: requestId, status: "REQUESTED" },
      data: { status: "REJECTED", decidedById: actorId, decidedAt: new Date(), adminNote, payoutEncrypted: null },
    });
    if (updated.count !== 1) throw notPendingError();
    row = await prisma.subscriptionRefundRequest.findUnique({ where: { id: requestId }, select: { tenantId: true, invoiceId: true, amountVnd: true } });
  } catch (error) {
    if (isRefundSchemaMissing(error)) throw unavailableError();
    throw error;
  }
  if (!row) return;
  await audit.log({
    actorId,
    scope: "SYSTEM",
    tenantId: row.tenantId,
    action: "SUBSCRIPTION_REFUND_REJECTED",
    targetType: "SubscriptionRefundRequest",
    targetId: requestId,
    metadata: { invoiceId: row.invoiceId, amountVnd: row.amountVnd },
  });
  await notifyTenant(row.tenantId, "REJECTED", requestId);
}

// ───────────────────────── Email ─────────────────────────

/** Gửi email cho chủ gian hàng (brand từ DB). Lỗi gửi chỉ log, không làm hỏng nghiệp vụ. Không chứa thông tin nhận tiền. */
async function notifyTenant(tenantId: string, stage: SubscriptionRefundEmailStage, requestId: string): Promise<void> {
  try {
    const prisma = getPrismaClient();
    const request = await prisma.subscriptionRefundRequest.findUnique({
      where: { id: requestId },
      select: {
        amountVnd: true,
        adminNote: true,
        invoice: { select: { code: true } },
        tenant: { select: { name: true, slug: true, owner: { select: { email: true } } } },
      },
    });
    if (!request) return;
    const brand = await getEffectiveBrand();
    const rendered = renderSubscriptionRefundEmail(stage, {
      appName: brand.name,
      tenantName: request.tenant.name,
      invoiceCode: request.invoice.code,
      amountDisplay: formatVnd(request.amountVnd),
      billingUrl: `${getEnv().APP_URL}/studio/${request.tenant.slug}/billing`,
      adminNote: stage === "REQUESTED" ? null : request.adminNote,
    });
    const type = `subscription_refund_${stage.toLowerCase()}`;
    const sent = await sendEmailNow({ type, to: request.tenant.owner.email, subject: rendered.subject, html: rendered.html, text: rendered.text }, { tenantId });
    if (!sent.ok) logger.warn({ tenantId, type, error: sent.error }, "subscription-refund: gửi email thất bại");
  } catch (error) {
    logger.error({ err: error, tenantId, stage }, "subscription-refund: lỗi khi gửi email");
  }
}
