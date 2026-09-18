import { canManuallyConfirmOrder, matchPaymentAmount, type OrderStatus } from "@gieochu/core";
import { withTenant, type Prisma } from "@gieochu/db";
import { markOrderPaid, sendOrderPaidEmails } from "./order";
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
  const fulfilledOrderId = await withTenant(data.tenantId, async (tx) => {
    const order = data.reference ? await tx.order.findUnique({ where: { code: data.reference } }) : null;

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
      return false;
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

    if (!data.success) return false;
    if (matchStatus !== "MATCHED") return false;
    if (!canManuallyConfirmOrder(order.status as OrderStatus, order.expiresAt, new Date())) return false;

    const source = data.provider === "SEPAY" ? "SEPAY_WEBHOOK" : "MOMO_IPN";
    const result = await markOrderPaid(tx, order.id, source);
    return result.fulfilled ? order.id : false;
  });

  if (fulfilledOrderId) {
    await sendOrderPaidEmails(fulfilledOrderId);
  }
}
