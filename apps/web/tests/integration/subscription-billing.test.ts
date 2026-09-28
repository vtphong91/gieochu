import { createHmac } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { encryptSecret } from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { createTenantForUser } from "../../lib/create-tenant";
import { createRenewalInvoice, getSubscriptionOverview } from "../../lib/subscription-billing";
import { runSubscriptionSweep } from "../../lib/subscription-sweep";
import { assertPlanLimit } from "../../lib/plan-limits";
import { assertTenantCanWrite } from "../../lib/tenant-write-guard";
import { getPublishedProducts } from "../../lib/storefront";
import { POST as platformWebhook } from "../../app/api/webhooks/platform/[provider]/route";
import type { CurrentUser } from "../../lib/session";
import { restorePlatformPaymentConfig, snapshotPlatformPaymentConfig, type PlatformPaymentConfigSnapshot } from "./shared-config-snapshot";

const prisma = getPrismaClient();
const RUN_PREFIX = `m3test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.com`;
}

async function createActiveUser(email: string) {
  return prisma.user.create({
    data: { email, passwordHash: "not-used-in-this-test", status: "ACTIVE", emailVerifiedAt: new Date() },
  });
}

function toCurrentUser(userId: string): CurrentUser {
  return { userId, familyId: "test-family", role: "USER", emailVerified: true, profileCompleted: true };
}

const PLATFORM_SEPAY_SECRET = "m3-platform-sepay-secret";

/** Upserts the one global PLATFORM SePay row (singleton per provider — see docs/BACKLOG.md). */
async function ensurePlatformSepayConfig(): Promise<void> {
  const env = getEnv();
  await prisma.platformPaymentConfig.upsert({
    where: { provider: "SEPAY" },
    update: {
      isEnabled: true,
      publicConfig: { bankBin: "970436", accountNo: "0000000001", accountName: "GIEO CHU", authType: "HMAC_SHA256", paymentPrefix: "SUB" },
      encryptedSecrets: encryptSecret(JSON.stringify({ secret: PLATFORM_SEPAY_SECRET }), env.PAYMENT_ENCRYPTION_KEY),
    },
    create: {
      provider: "SEPAY",
      isEnabled: true,
      publicConfig: { bankBin: "970436", accountNo: "0000000001", accountName: "GIEO CHU", authType: "HMAC_SHA256", paymentPrefix: "SUB" },
      encryptedSecrets: encryptSecret(JSON.stringify({ secret: PLATFORM_SEPAY_SECRET }), env.PAYMENT_ENCRYPTION_KEY),
    },
  });
}

function signedSepayRequest(rawBody: string): Request {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = `sha256=${createHmac("sha256", PLATFORM_SEPAY_SECRET).update(`${timestamp}.${rawBody}`).digest("hex")}`;
  return new Request("http://localhost/api/webhooks/platform/sepay", {
    method: "POST",
    headers: { "x-sepay-signature": signature, "x-sepay-timestamp": timestamp },
    body: rawBody,
  });
}

describe("M3 subscription and platform billing", () => {
  // Cổng SePay platform là cấu hình dùng chung trên DB dev: chụp lại trước khi test ghi đè, afterAll trả đúng dòng cũ.
  let sepaySnapshot: PlatformPaymentConfigSnapshot;
  beforeAll(async () => {
    sepaySnapshot = await snapshotPlatformPaymentConfig("SEPAY");
  });

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await prisma.platformPaymentTransaction.deleteMany({
        where: { matchedInvoice: { tenantId: { in: tenantIds } } },
      });
      await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: { in: tenantIds } } });
      // products/tenant_members are RLS-protected (L2) — a plain deleteMany is silently
      // filtered to zero rows outside a scoped session, same as M7's cleanup.
      await withSystemJob(async (tx) => {
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
    await restorePlatformPaymentConfig(sepaySnapshot);
  });

  it("creating a tenant opens an ACTIVE subscription on the FREE plan, which never expires", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Free Test", slug: `${RUN_PREFIX}-free` });

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.plan.isFree).toBe(true);
    expect(subscription.currentPeriodEnd.getTime()).toBeLessThanOrEqual(subscription.currentPeriodStart.getTime() + 1);
  });

  it("creates a renewal invoice and marks it PAID via a signed platform SePay webhook, activating the subscription", async () => {
    await ensurePlatformSepayConfig();
    const proPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });

    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Sepay Billing", slug: `${RUN_PREFIX}-sepay-paid` });

    const invoice = await createRenewalInvoice(tenant.id, { planId: proPlan.id, provider: "SEPAY" });
    expect(invoice.status).toBe("PENDING");
    expect(invoice.amountVnd).toBe(proPlan.priceVnd);

    const rawBody = JSON.stringify({
      id: `evt_${RUN_PREFIX}_paid`,
      content: `thanh toan ${invoice.code}`,
      transferType: "in",
      transferAmount: invoice.amountVnd,
      transactionDate: "2026-01-01 10:00:00",
    });

    const response = await platformWebhook(signedSepayRequest(rawBody), { params: Promise.resolve({ provider: "sepay" }) });
    expect(response.status).toBe(200);

    const { subscription, invoices } = await getSubscriptionOverview(tenant.id);
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.planId).toBe(proPlan.id);
    expect(invoices.find((i) => i.id === invoice.id)?.status).toBe("PAID");
  });

  it("processes a duplicate webhook event idempotently (no double transaction, no error)", async () => {
    await ensurePlatformSepayConfig();
    const proPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });

    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Sepay Dup", slug: `${RUN_PREFIX}-sepay-dup` });
    const invoice = await createRenewalInvoice(tenant.id, { planId: proPlan.id, provider: "SEPAY" });

    const rawBody = JSON.stringify({
      id: `evt_${RUN_PREFIX}_dup`,
      content: `thanh toan ${invoice.code}`,
      transferType: "in",
      transferAmount: invoice.amountVnd,
      transactionDate: "2026-01-01 10:00:00",
    });

    const first = await platformWebhook(signedSepayRequest(rawBody), { params: Promise.resolve({ provider: "sepay" }) });
    const second = await platformWebhook(signedSepayRequest(rawBody), { params: Promise.resolve({ provider: "sepay" }) });
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);

    const transactionCount = await prisma.platformPaymentTransaction.count({ where: { matchedInvoiceId: invoice.id } });
    expect(transactionCount).toBe(1);
  });

  it("the hourly sweep downgrades an overdue paid subscription back to FREE, keeping the tenant sellable", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Sweep Test", slug: `${RUN_PREFIX}-sweep` });
    const creatorPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });

    // Upgrade at the DB level directly — this test is about the sweep's downgrade behavior, not the upgrade flow itself.
    const overduePeriodEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { planId: creatorPlan.id, currentPeriodEnd: overduePeriodEnd },
    });

    await runSubscriptionSweep();
    let subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription.status).toBe("GRACE");
    expect(subscription.graceEndsAt).not.toBeNull();
    expect(subscription.planId).toBe(creatorPlan.id);

    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { graceEndsAt: new Date(Date.now() - 60 * 1000) },
    });

    await runSubscriptionSweep();
    subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription.status).toBe("ACTIVE");
    expect(subscription.plan.isFree).toBe(true);

    // §"M3 v2" ADR-021: a lapsed paid subscription never sets the tenant READ_ONLY anymore — Free still sells.
    const tenantAfter = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(tenantAfter.status).toBe("ACTIVE");
  });

  it("a Free-plan tenant can publish within FREE's product limit, and assertPlanLimit blocks the next one", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Free Limit Test", slug: `${RUN_PREFIX}-freelimit` });
    const { subscription } = await getSubscriptionOverview(tenant.id);
    const freePlan = await prisma.plan.findUniqueOrThrow({ where: { id: subscription.planId } });
    expect(freePlan.isFree).toBe(true);

    await withTenant(tenant.id, async (tx) => {
      for (let i = 0; i < freePlan.maxProducts; i += 1) {
        await tx.product.create({ data: { tenantId: tenant.id, slug: `p-${i}`, title: `P${i}`, status: "PUBLISHED" } });
      }
    });

    await expect(assertPlanLimit(tenant.id, "products", 1)).rejects.toMatchObject({ code: "PRODUCT_LIMIT_REACHED" });

    await withTenant(tenant.id, (tx) => tx.product.updateMany({ where: { tenantId: tenant.id }, data: { status: "ARCHIVED" } }));
    await expect(assertPlanLimit(tenant.id, "products", 1)).resolves.toBeUndefined();
  });

  it("upgrading from Free to a paid plan computes the new period starting now and switches the plan immediately on payment", async () => {
    await ensurePlatformSepayConfig();
    const creatorPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "CREATOR" } });

    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Upgrade Test", slug: `${RUN_PREFIX}-upgrade` });
    const before = await getSubscriptionOverview(tenant.id);
    expect(before.subscription.plan.isFree).toBe(true);

    const invoice = await createRenewalInvoice(tenant.id, { planId: creatorPlan.id, provider: "SEPAY" });
    const now = new Date();
    expect(invoice.periodStart.getTime()).toBeGreaterThanOrEqual(now.getTime() - 5_000);

    const rawBody = JSON.stringify({
      id: `evt_${RUN_PREFIX}_upgrade`,
      content: `thanh toan ${invoice.code}`,
      transferType: "in",
      transferAmount: invoice.amountVnd,
      transactionDate: "2026-01-01 10:00:00",
    });
    const response = await platformWebhook(signedSepayRequest(rawBody), { params: Promise.resolve({ provider: "sepay" }) });
    expect(response.status).toBe(200);

    const after = await getSubscriptionOverview(tenant.id);
    expect(after.subscription.status).toBe("ACTIVE");
    expect(after.subscription.plan.isFree).toBe(false);
    expect(after.subscription.planId).toBe(creatorPlan.id);
  });

  it("a READ_ONLY tenant cannot write new content, but a customer can still list its already-published products", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Read Only Test", slug: `${RUN_PREFIX}-readonly` });

    await withTenant(tenant.id, (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, slug: "old-doc", title: "Tài liệu cũ", status: "PUBLISHED" } }),
    );
    await prisma.tenant.update({ where: { id: tenant.id }, data: { status: "READ_ONLY" } });

    const readOnlyTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(() => assertTenantCanWrite(readOnlyTenant)).toThrow();

    const products = await getPublishedProducts(tenant.id);
    expect(products.some((p) => p.slug === "old-doc")).toBe(true);
  });
});
