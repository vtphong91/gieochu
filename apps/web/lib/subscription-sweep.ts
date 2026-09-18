import { computeGraceEndsAt, transitionSubscriptionStatus, type SubscriptionStatus } from "@gieochu/core";
import { getPrismaClient, type Tenant } from "@gieochu/db";
import { renderSubscriptionStatusEmail, type SubscriptionEmailStage } from "@gieochu/email";
import { getEnv } from "@gieochu/config";
import { enqueueEmail } from "./jobs";

const REMINDER_DAYS = { EARLY: 7, LATE: 1 } as const;

function formatVnDate(date: Date): string {
  return date.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });
}

async function notify(tenant: Pick<Tenant, "name" | "slug" | "ownerId">, stage: SubscriptionEmailStage, periodEnd?: Date) {
  const env = getEnv();
  const prisma = getPrismaClient();
  const owner = await prisma.user.findUnique({ where: { id: tenant.ownerId }, select: { email: true } });
  if (!owner) return;

  const rendered = renderSubscriptionStatusEmail(stage, {
    appName: env.APP_NAME,
    tenantName: tenant.name,
    billingUrl: `${env.APP_URL}/studio/${tenant.slug}/billing`,
    periodEndDisplay: periodEnd ? formatVnDate(periodEnd) : undefined,
  });
  await enqueueEmail({ to: owner.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
}

/**
 * §"M3" hourly job `subscription.sweep` — run from apps/web/worker.ts on a
 * pg-boss cron schedule. Order matters: GRACE→EXPIRED and CANCELED→EXPIRED
 * run before TRIALING/ACTIVE→GRACE so a subscription can't be swept through
 * two transitions in the same tick (each gets its own email on the tick it
 * actually happens).
 */
export async function runSubscriptionSweep(): Promise<void> {
  const prisma = getPrismaClient();
  const env = getEnv();
  const now = new Date();
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  const graceDays = settings?.graceDays ?? env.GRACE_DAYS;

  const graceExpiring = await prisma.subscription.findMany({
    where: { status: "GRACE", graceEndsAt: { lt: now } },
    include: { tenant: true },
  });
  for (const sub of graceExpiring) {
    // PAST_DUE is declared on the DB enum but M3's state machine never assigns it (see schema.prisma).
    const nextStatus = transitionSubscriptionStatus(sub.status as SubscriptionStatus, "GRACE_ENDED");
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: nextStatus } }),
      ...(sub.tenant.status !== "LOCKED" ? [prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: "READ_ONLY" as const } })] : []),
    ]);
    await notify(sub.tenant, "EXPIRED");
  }

  const canceledEnding = await prisma.subscription.findMany({
    where: { status: "CANCELED", currentPeriodEnd: { lt: now } },
    include: { tenant: true },
  });
  for (const sub of canceledEnding) {
    const nextStatus = transitionSubscriptionStatus(sub.status as SubscriptionStatus, "PERIOD_ENDED");
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { status: nextStatus } }),
      ...(sub.tenant.status !== "LOCKED" ? [prisma.tenant.update({ where: { id: sub.tenantId }, data: { status: "READ_ONLY" as const } })] : []),
    ]);
    await notify(sub.tenant, "EXPIRED");
  }

  const periodEnding = await prisma.subscription.findMany({
    where: { status: { in: ["TRIALING", "ACTIVE"] }, currentPeriodEnd: { lt: now } },
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
    where: { status: { in: ["TRIALING", "ACTIVE"] }, currentPeriodEnd: { gte: now } },
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

  await prisma.subscriptionInvoice.updateMany({
    where: { status: "PENDING", dueAt: { lt: now } },
    data: { status: "EXPIRED" },
  });
}
