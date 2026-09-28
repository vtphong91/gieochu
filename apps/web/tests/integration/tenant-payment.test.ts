import { createHmac } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "@gieochu/auth";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { decryptSecret, encryptSecret, sepayProvider, type SepayConfig } from "@gieochu/payments";
import { getEnv } from "@gieochu/config";
import { createTenantForUser } from "../../lib/create-tenant";
import { getEnabledProviders, listTenantProviderConfigs, saveTenantProviderConfig } from "../../lib/tenant-payment";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../lib/jwt-context";
import { ACCESS_COOKIE_NAME } from "../../lib/cookies";
import type { CurrentUser } from "../../lib/session";
import { restorePlatformPaymentConfig, snapshotPlatformPaymentConfig, type PlatformPaymentConfigSnapshot } from "./shared-config-snapshot";

const prisma = getPrismaClient();
const RUN_PREFIX = `m7test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

describe("M7 tenant payment configuration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  // Cổng SePay platform (unique theo provider) là cấu hình dùng chung trên DB dev: chụp lại trước khi test ghi đè,
  // afterAll trả đúng dòng cũ (hoặc xoá nếu trước đó không có).
  let sepaySnapshot: PlatformPaymentConfigSnapshot;
  beforeAll(async () => {
    sepaySnapshot = await snapshotPlatformPaymentConfig("SEPAY");
  });

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.tenantPaymentConfig.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await restorePlatformPaymentConfig(sepaySnapshot);
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("owner saves a SePay config: the secret is encrypted at rest, and only a masked value is returned", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "SePay Test", slug: `${RUN_PREFIX}-sepay` });

    await saveTenantProviderConfig(tenant.id, {
      provider: "SEPAY",
      isEnabled: true,
      publicConfig: { bankBin: "970403", accountNo: "0011012345678", accountName: "NGUYEN VAN A", authType: "HMAC_SHA256", paymentPrefix: "HAN" },
      secrets: { secret: "sk_live_topsecret1234" },
    });

    const row = await withTenant(tenant.id, (tx) =>
      tx.tenantPaymentConfig.findUniqueOrThrow({ where: { tenantId_provider: { tenantId: tenant.id, provider: "SEPAY" } } }),
    );
    expect(row.encryptedSecrets).not.toContain("sk_live_topsecret1234");

    const configs = await listTenantProviderConfigs(tenant.id);
    const sepayConfig = configs.find((c) => c.provider === "SEPAY");
    expect(sepayConfig?.maskedSecrets.secret).toBe("••••1234");
    expect(sepayConfig?.maskedSecrets.secret).not.toContain("topsecret");
  });

  it("a non-member of the tenant is rejected (403) from its payment settings", async () => {
    const ownerA = await createActiveUser(nextEmail());
    await createTenantForUser(toCurrentUser(ownerA.id), { name: "Payment Tenant A", slug: `${RUN_PREFIX}-a` });

    const ownerB = await createActiveUser(nextEmail());
    const tenantB = await createTenantForUser(toCurrentUser(ownerB.id), { name: "Payment Tenant B", slug: `${RUN_PREFIX}-b` });

    const accessToken = await signAccessToken(
      { sub: ownerA.id, sid: "test-family", role: "USER", ver: true, pc: true },
      getJwtContext(),
      getAccessTokenTtlSeconds(),
    );
    vi.doMock("next/headers", () => ({
      cookies: async () => ({
        get: (name: string) => (name === ACCESS_COOKIE_NAME ? { value: accessToken } : undefined),
      }),
    }));

    const { requireTenantMember } = await import("../../lib/tenant");
    await expect(requireTenantMember(tenantB.slug)).rejects.toMatchObject({ httpStatus: 403 });

    vi.doUnmock("next/headers");
  });

  it("a disabled provider does not appear among the tenant's enabled payment methods", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Enabled Test", slug: `${RUN_PREFIX}-enabled` });

    await saveTenantProviderConfig(tenant.id, {
      provider: "MANUAL_QR",
      isEnabled: true,
      publicConfig: { bankBin: "970403", accountNo: "0011012345678", accountName: "NGUYEN VAN A" },
      secrets: {},
    });
    await saveTenantProviderConfig(tenant.id, {
      provider: "MOMO",
      isEnabled: false,
      publicConfig: { partnerCode: "TEST", accessKey: "ak", environment: "sandbox" },
      secrets: { secretKey: "sk" },
    });

    const enabled = await getEnabledProviders(tenant.id);
    expect(enabled).toContain("MANUAL_QR");
    expect(enabled).not.toContain("MOMO");
  });

  it("a webhook signed with the platform's secret is rejected by tenant verification, and vice versa", async () => {
    const env = getEnv();
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Cross Scope Test", slug: `${RUN_PREFIX}-cross` });

    const tenantSecret = "tenant-secret-abc";
    const platformSecret = "platform-secret-xyz";

    await saveTenantProviderConfig(tenant.id, {
      provider: "SEPAY",
      isEnabled: true,
      publicConfig: { bankBin: "970403", accountNo: "0011012345678", accountName: "NGUYEN VAN A", authType: "HMAC_SHA256", paymentPrefix: "HAN" },
      secrets: { secret: tenantSecret },
    });

    // upsert (không create): provider là unique — DB dev có thể đã có cấu hình SePay thật (được khôi phục ở afterAll).
    const platformData = {
      isEnabled: true,
      publicConfig: { bankBin: "970436", accountNo: "9999999999", accountName: "GIEO CHU", _testMarker: RUN_PREFIX },
      encryptedSecrets: encryptSecret(JSON.stringify({ secret: platformSecret }), env.PAYMENT_ENCRYPTION_KEY),
    };
    await prisma.platformPaymentConfig.upsert({
      where: { provider: "SEPAY" },
      update: platformData,
      create: { provider: "SEPAY", ...platformData },
    });

    const tenantConfigRow = await withTenant(tenant.id, (tx) =>
      tx.tenantPaymentConfig.findUniqueOrThrow({ where: { tenantId_provider: { tenantId: tenant.id, provider: "SEPAY" } } }),
    );
    const tenantCfg = {
      ...(tenantConfigRow.publicConfig as object),
      ...(JSON.parse(decryptSecret(tenantConfigRow.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as object),
    } as SepayConfig;

    const platformConfigRow = await prisma.platformPaymentConfig.findFirstOrThrow({
      where: { provider: "SEPAY", publicConfig: { path: ["_testMarker"], equals: RUN_PREFIX } },
    });
    const platformCfg = {
      ...(platformConfigRow.publicConfig as object),
      ...(JSON.parse(decryptSecret(platformConfigRow.encryptedSecrets, env.PAYMENT_ENCRYPTION_KEY)) as object),
    } as SepayConfig;

    const rawBody = '{"id":1,"transferAmount":100000}';
    const timestamp = "1700000000";
    const signWith = (secret: string) =>
      `sha256=${createHmac("sha256", secret).update(`${timestamp}.${rawBody}`).digest("hex")}`;

    const signedByPlatform = { headers: { "x-sepay-signature": signWith(platformSecret), "x-sepay-timestamp": timestamp }, rawBody };
    const signedByTenant = { headers: { "x-sepay-signature": signWith(tenantSecret), "x-sepay-timestamp": timestamp }, rawBody };

    await expect(sepayProvider.verifyWebhook(signedByPlatform, tenantCfg)).resolves.toBe(false);
    await expect(sepayProvider.verifyWebhook(signedByTenant, platformCfg)).resolves.toBe(false);
    await expect(sepayProvider.verifyWebhook(signedByTenant, tenantCfg)).resolves.toBe(true);
    await expect(sepayProvider.verifyWebhook(signedByPlatform, platformCfg)).resolves.toBe(true);
  });
});
