import { computeGraceEndsAt, DISPLAY_TIME_ZONE, logger, transitionSubscriptionStatus, type SubscriptionStatus } from "@gieochu/core";
import { getPrismaClient, type Prisma, type Tenant } from "@gieochu/db";
import { renderSubscriptionStatusEmail, type SubscriptionEmailStage } from "@gieochu/email";
import { getEnv } from "@gieochu/config";
import { sendEmailNow } from "./email-dispatch";
import { getEffectiveBrand } from "./branding";
import { getSystemSettings } from "./system-settings";
import { notifyOwnerOfInvoiceStatus } from "./payment-status-notify";

const REMINDER_DAYS = { EARLY: 7, LATE: 1 } as const;

function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: DISPLAY_TIME_ZONE });
}

async function notify(tenant: Pick<Tenant, "id" | "name" | "slug" | "ownerId">, stage: SubscriptionEmailStage, periodEnd?: Date) {
  const env = getEnv();
  const brand = await getEffectiveBrand();
  const prisma = getPrismaClient();
  const owner = await prisma.user.findUnique({ where: { id: tenant.ownerId }, select: { email: true } });
  if (!owner) return;

  const rendered = renderSubscriptionStatusEmail(stage, {
    appName: brand.name,
    tenantName: tenant.name,
    billingUrl: `${env.APP_URL}/studio/${tenant.slug}/billing`,
    periodEndDisplay: periodEnd ? formatVnDate(periodEnd) : undefined,
  });
  const type = `subscription_${stage.toLowerCase()}`;
  const sent = await sendEmailNow({ type, to: owner.email, subject: rendered.subject, html: rendered.html, text: rendered.text }, { tenantId: tenant.id });
  if (!sent.ok) {
    logger.warn({ tenantSlug: tenant.slug, type, email: owner.email, error: sent.error }, "subscription.sweep: gửi email thất bại");
  }
}

/**
 * §"M3 v2" ADR-021: a lapsed paid subscription downgrades straight to the
 * FREE plan — `tenant.status` is never touched here anymore (Free still
 * sells; `READ_ONLY` is now exclusively an admin/moderation action, not a
 * billing consequence).
 *
 * ADR-041 B: dùng lại khi admin duyệt hoàn tiền gói (`lib/subscription-refund.ts`) — nhận cả client lẫn transaction.
 */
export async function downgradeToFree(
  prisma: ReturnType<typeof getPrismaClient> | Prisma.TransactionClient,
  subscriptionId: string,
  freePlanId: string,
  now: Date,
) {
  await prisma.subscription.update({
    where: { id: subscriptionId },
    data: {
      planId: freePlanId,
      status: "ACTIVE",
      currentPeriodStart: now,
      currentPeriodEnd: now,
      graceEndsAt: null,
      periodEndReminderStage: null,
    },
  });
}

/**
 * §"M3" hourly job `subscription.sweep` — run from apps/web/worker.ts on a
 * pg-boss cron schedule. Order matters: GRACE→downgrade and CANCELED→downgrade
 * run before ACTIVE→GRACE so a subscription can't be swept through two
 * transitions in the same tick (each gets its own email on the tick it
 * actually happens). FREE-plan subscriptions are excluded from every query
 * below (`plan: { isFree: false }`) — Free never expires, so it never enters
 * GRACE and never needs a renewal reminder.
 *
 * `tenantIds` (tuỳ chọn) giới hạn mọi truy vấn chọn thuê bao/hoá đơn (và do đó email gửi kèm) trong các tenant này — dùng cho
 * integration test để không đổi dữ liệu thật trên DB dùng chung (ADR-034); cron/worker luôn gọi không lọc.
 */
export async function runSubscriptionSweep(options: { tenantIds?: readonly string[] } = {}): Promise<void> {
  const tenantIds = options.tenantIds ? [...new Set(options.tenantIds)] : null;
  if (tenantIds !== null && tenantIds.length === 0) return;
  const filterTenants = tenantIds !== null;
  const ids = tenantIds ?? [];
  const tenantScope: Prisma.SubscriptionWhereInput = tenantIds !== null ? { tenantId: { in: tenantIds } } : {};
  const prisma = getPrismaClient();
  const now = new Date();
  // ADR-032: đọc lại mỗi lần chạy sweep (worker, ngoài React → không cache) — đổi ân hạn chỉ áp cho
  // subscription chuyển GRACE từ lần sweep sau, không hồi tố graceEndsAt đã đặt.
  const { graceDays } = await getSystemSettings();
  const freePlan = await prisma.plan.findFirstOrThrow({ where: { isFree: true, isActive: true } });

  const graceExpiring = await prisma.subscription.findMany({
    where: { status: "GRACE", graceEndsAt: { lt: now }, ...tenantScope },
    include: { tenant: true },
  });
  for (const sub of graceExpiring) {
    transitionSubscriptionStatus(sub.status as SubscriptionStatus, "GRACE_ENDED"); // validates the transition is legal before we act on it
    await downgradeToFree(prisma, sub.id, freePlan.id, now);
    await notify(sub.tenant, "DOWNGRADED_TO_FREE");
  }

  const canceledEnding = await prisma.subscription.findMany({
    where: { status: "CANCELED", currentPeriodEnd: { lt: now }, ...tenantScope },
    include: { tenant: true },
  });
  for (const sub of canceledEnding) {
    transitionSubscriptionStatus(sub.status as SubscriptionStatus, "PERIOD_ENDED");
    await downgradeToFree(prisma, sub.id, freePlan.id, now);
    await notify(sub.tenant, "DOWNGRADED_TO_FREE");
  }

  const periodEnding = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { lt: now }, plan: { isFree: false }, ...tenantScope },
    include: { tenant: true },
  });
  for (const sub of periodEnding) {
    const nextStatus = transitionSubscriptionStatus(sub.status as SubscriptionStatus, "PERIOD_ENDED");
    const graceEndsAt = computeGraceEndsAt(sub.currentPeriodEnd, graceDays);
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: nextStatus, graceEndsAt, periodEndReminderStage: null },
    });
    await notify(sub.tenant, "GRACE");
  }

  const remindCandidates = await prisma.subscription.findMany({
    where: { status: "ACTIVE", currentPeriodEnd: { gte: now }, plan: { isFree: false }, ...tenantScope },
    include: { tenant: true },
  });
  for (const sub of remindCandidates) {
    const daysLeft = Math.ceil((sub.currentPeriodEnd.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
    let stage: number | null = null;
    if (daysLeft <= REMINDER_DAYS.LATE && sub.periodEndReminderStage !== REMINDER_DAYS.LATE) {
      await notify(sub.tenant, "REMINDER_1D", sub.currentPeriodEnd);
      stage = REMINDER_DAYS.LATE;
    } else if (daysLeft <= REMINDER_DAYS.EARLY && sub.periodEndReminderStage === null) {
      await notify(sub.tenant, "REMINDER_7D", sub.currentPeriodEnd);
      stage = REMINDER_DAYS.EARLY;
    } else {
      continue;
    }
    await prisma.subscription.update({ where: { id: sub.id }, data: { periodEndReminderStage: stage } });
  }

  // ADR-070 A2: một lệnh UPDATE … RETURNING (nguyên tử) → biết đúng hoá đơn DO LẦN SWEEP NÀY chuyển PENDING → EXPIRED; hai sweep
  // chạy chồng nhau thì lần sau không nhận lại dòng đã chuyển → mỗi hoá đơn một email. Bảng L1 (không RLS). `updatedAt` đặt tay
  // (Prisma chỉ tự đặt khi ghi qua client).
  const expired = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "subscription_invoices"
    SET "status" = 'EXPIRED'::"SubscriptionInvoiceStatus", "updatedAt" = ${now}
    WHERE "status" = 'PENDING'::"SubscriptionInvoiceStatus" AND "dueAt" < ${now}
      AND (NOT ${filterTenants} OR "tenantId" = ANY(${ids}::text[]))
    RETURNING "id"
  `;
  for (const row of expired) {
    await notifyOwnerOfInvoiceStatus(row.id, "EXPIRED");
  }
}
