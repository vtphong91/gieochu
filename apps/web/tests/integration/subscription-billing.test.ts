import { createHmac } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { encryptSecret } from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { createTenantForUser } from "../../lib/create-tenant";
import { createRenewalInvoice, getSubscriptionOverview } from "../../lib/subscription-billing";
import { runSubscriptionSweep } from "../../lib/subscription-sweep";
import { assertTenantCanWrite } from "../../lib/tenant-write-guard";
import { getPublishedProducts } from "../../lib/storefront";
import { POST as platformWebhook } from "../../app/api/webhooks/platform/[provider]/route";
import type { CurrentUser } from "../../lib/session";

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
    await prisma.platformPaymentConfig.deleteMany({ where: { provider: "SEPAY" } });
  });

  it("creating a tenant opens a TRIALING subscription tied to a plan", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Trial Test", slug: `${RUN_PREFIX}-trial` });

    const subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    expect(subscription.status).toBe("TRIALING");
    expect(subscription.planId).toBeTruthy();
    expect(subscription.currentPeriodEnd.getTime()).toBeGreaterThan(subscription.currentPeriodStart.getTime());
  });

  it("creates a renewal invoice and marks it PAID via a signed platform SePay webhook, activating the subscription", async () => {
    await ensurePlatformSepayConfig();
    const proPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "PRO_MONTHLY" } });

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
    const proPlan = await prisma.plan.findUniqueOrThrow({ where: { code: "PRO_MONTHLY" } });

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

  it("the hourly sweep moves an overdue subscription to GRACE, then to EXPIRED with the tenant set READ_ONLY", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Sweep Test", slug: `${RUN_PREFIX}-sweep` });

    const overduePeriodEnd = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await prisma.subscription.update({ where: { tenantId: tenant.id }, data: { currentPeriodEnd: overduePeriodEnd } });

    await runSubscriptionSweep();
    let subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    expect(subscription.status).toBe("GRACE");
    expect(subscription.graceEndsAt).not.toBeNull();

    await prisma.subscription.update({
      where: { tenantId: tenant.id },
      data: { graceEndsAt: new Date(Date.now() - 60 * 1000) },
    });

    await runSubscriptionSweep();
    subscription = await prisma.subscription.findUniqueOrThrow({ where: { tenantId: tenant.id } });
    expect(subscription.status).toBe("EXPIRED");

    const expiredTenant = await prisma.tenant.findUniqueOrThrow({ where: { id: tenant.id } });
    expect(expiredTenant.status).toBe("READ_ONLY");
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
