import { canManuallyConfirmOrder, logger, matchPaymentAmount, type OrderStatus } from "@gieochu/core";
import { getPrismaClient, withTenant, type Prisma } from "@gieochu/db";
import { getEnv } from "@gieochu/config";
import { renderPaymentAmountMismatchEmail } from "@gieochu/email";
import { sendEmailNow } from "./email-dispatch";
import { auditMarkOrderPaid, markOrderPaid, sendOrderPaidEmails, type MarkOrderPaidResult, type MarkOrderPaidSource } from "./order";
import { recomputeProductSoldCounts } from "./product-sold-count";
import type { PaymentProcessJobData } from "./jobs";

/**
 * §"M8"/§7.4 job handler: runs after the webhook route already answered 200.
 * Looks the order up by its reference code, records a
 * `TenantPaymentTransaction` either way (audit trail for UNMATCHED/mismatch
 * review), and only calls `markOrderPaid()` on a genuine amount match against
 * an order still eligible (PENDING, or EXPIRED within the 24h late window —
 * same eligibility `canManuallyConfirmOrder()` uses for manual confirms).
 * Everything runs inside one `withTenant()` — both `orders` and
 * `tenant_payment_transactions` are RLS-protected L2 tables, so an unscoped
 * `getPrismaClient()` call here would silently miss the order (SELECT) or be
 * rejected outright (INSERT), not just read stale data.
 */
export async function processPaymentEvent(data: PaymentProcessJobData): Promise<void> {
  type Fulfilled = { orderId: string; result: MarkOrderPaidResult; source: MarkOrderPaidSource };
  type Mismatch = { orderId: string; orderCode: string; expectedVnd: number };
  // ADR-059 bổ sung lần 2 (d): giao dịch tiền vào khớp mã đơn nhưng sai tiền → email báo chủ gian hàng SAU commit. Gắn với lần
  // ghi giao dịch (unique tenantId+provider+providerTxnId) nên một giao dịch chỉ báo một lần, kể cả khi job chạy lại.
  const outcome = await withTenant(data.tenantId, async (tx): Promise<{ fulfilled: Fulfilled | false; mismatch: Mismatch | null }> => {
    // ADR-059 bổ sung lần 2: thử các mã theo thứ tự ưu tiên (job cũ chỉ có `reference`).
    const candidates = data.referenceCandidates?.length ? data.referenceCandidates : data.reference ? [data.reference] : [];
    const found = candidates.length > 0 ? await tx.order.findMany({ where: { code: { in: candidates } } }) : [];
    const order = candidates.map((code) => found.find((row) => row.code === code)).find((row) => row !== undefined) ?? null;

    if (!order) {
      await tx.tenantPaymentTransaction.create({
        data: {
          tenantId: data.tenantId,
          provider: data.provider,
          providerTxnId: data.providerEventId,
          amountVnd: data.amountVnd,
          matchStatus: "UNMATCHED",
          rawPayload: data.rawPayload as Prisma.InputJsonValue,
        },
      });
      return { fulfilled: false, mismatch: null };
    }

    const matchStatus = matchPaymentAmount(order.totalVnd, data.amountVnd);
    await tx.tenantPaymentTransaction.create({
      data: {
        tenantId: data.tenantId,
        orderId: order.id,
        provider: data.provider,
        providerTxnId: data.providerEventId,
        amountVnd: data.amountVnd,
        matchStatus,
        rawPayload: data.rawPayload as Prisma.InputJsonValue,
      },
    });

    if (!data.success) return { fulfilled: false, mismatch: null };
    if (matchStatus !== "MATCHED") {
      return { fulfilled: false, mismatch: { orderId: order.id, orderCode: order.code, expectedVnd: order.totalVnd } };
    }
    if (!canManuallyConfirmOrder(order.status as OrderStatus, order.expiresAt, new Date())) return { fulfilled: false, mismatch: null };

    const source = data.provider === "SEPAY" ? "SEPAY_WEBHOOK" : "MOMO_IPN";
    const result = await markOrderPaid(tx, order.id, source);
    return { fulfilled: result.fulfilled ? { orderId: order.id, result, source } : false, mismatch: null };
  });
  const { fulfilled } = outcome;
  if (outcome.mismatch) await notifyOwnerOfPaymentMismatch(data, outcome.mismatch);

  if (fulfilled) {
    // ADR-037: audit (COUPON_OVERUSED) sau commit, ngoài transaction nghiệp vụ.
    await auditMarkOrderPaid(data.tenantId, fulfilled.orderId, fulfilled.result, fulfilled.source);
    // ADR-033: số đã bán tính lại sau khi transaction đổi trạng thái đơn đã commit.
    await recomputeProductSoldCounts(fulfilled.result.productIds);
    await sendOrderPaidEmails(fulfilled.orderId);
  }
}

function formatVnd(amountVnd: number): string {
  return `${amountVnd.toLocaleString("vi-VN")}đ`;
}

const PROVIDER_LABEL: Record<string, string> = { SEPAY: "SePay", MOMO: "MoMo", MANUAL_QR: "Chuyển khoản QR", MOMO_MANUAL: "MoMo (chuyển tay)" };

/** ADR-059 bổ sung lần 2 (d) — email báo chủ gian hàng giao dịch sai tiền (L2, không ghi EmailSendLog). Lỗi chỉ log, không ném. */
async function notifyOwnerOfPaymentMismatch(
  data: PaymentProcessJobData,
  mismatch: { orderId: string; orderCode: string; expectedVnd: number },
): Promise<void> {
  try {
    const tenant = await getPrismaClient().tenant.findUnique({
      where: { id: data.tenantId },
      select: { slug: true, owner: { select: { email: true } } },
    });
    if (!tenant) return;
    const diff = data.amountVnd - mismatch.expectedVnd;
    const base = `${getEnv().APP_URL.replace(/\/+$/, "")}/studio/${tenant.slug}/orders`;
    const rendered = renderPaymentAmountMismatchEmail({
      orderCode: mismatch.orderCode,
      receivedVndDisplay: formatVnd(data.amountVnd),
      expectedVndDisplay: formatVnd(mismatch.expectedVnd),
      differenceDisplay: diff < 0 ? `thiếu ${formatVnd(-diff)}` : `thừa ${formatVnd(diff)}`,
      providerLabel: PROVIDER_LABEL[data.provider] ?? data.provider,
      orderUrl: `${base}/${mismatch.orderId}`,
      transactionsUrl: `${base}/giao-dich`,
    });
    const result = await sendEmailNow({ type: "payment_mismatch", to: tenant.owner.email, ...rendered });
    if (!result.ok) {
      logger.warn({ tenantId: data.tenantId, orderId: mismatch.orderId, error: result.error }, "payment.mismatch: gửi email báo chủ gian hàng thất bại");
    }
  } catch (error) {
    logger.warn({ tenantId: data.tenantId, orderId: mismatch.orderId, err: error }, "payment.mismatch: lỗi khi gửi email báo chủ gian hàng");
  }
}
