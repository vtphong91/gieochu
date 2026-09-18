import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { encryptSecret } from "@gieochu/core";
import { getPrismaClient, withSystemJob } from "@gieochu/db";
import { getEnv } from "@gieochu/config";
import { signAccessToken } from "@gieochu/auth";
import { createTenantForUser } from "../../lib/create-tenant";
import { createProduct } from "../../lib/product";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../lib/jwt-context";
import { ACCESS_COOKIE_NAME } from "../../lib/cookies";
import type { CurrentUser } from "../../lib/session";

const prisma = getPrismaClient();
const RUN_PREFIX = `m5uploadtest_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

/** A single-PUT presign is pure request signing — no real network call — so a fake/placeholder config is enough to test the auth gate around it. */
async function ensureFakeStorageConfig(): Promise<void> {
  const env = getEnv();
  const secrets = encryptSecret(JSON.stringify({ accessKeyId: "fake", secretAccessKey: "fake" }), env.STORAGE_ENCRYPTION_KEY);
  const publicConfig = { endpoint: "https://fake.example.com", region: "auto", bucketPrivate: "fake-private", bucketPublic: "fake-public" };
  await prisma.systemStorageConfig.upsert({
    where: { id: "default" },
    update: { isEnabled: true, publicConfig, encryptedSecrets: secrets },
    create: { id: "default", isEnabled: true, publicConfig, encryptedSecrets: secrets },
  });
}

async function mockCookieFor(userId: string): Promise<void> {
  const accessToken = await signAccessToken(
    { sub: userId, sid: "test-family", role: "USER", ver: true, pc: true },
    getJwtContext(),
    getAccessTokenTtlSeconds(),
  );
  vi.doMock("next/headers", () => ({
    cookies: async () => ({
      get: (name: string) => (name === ACCESS_COOKIE_NAME ? { value: accessToken } : undefined),
    }),
  }));
}

function presignRequest(tenantSlug: string, body: unknown): Request {
  return new Request(`http://localhost/api/studio/${tenantSlug}/uploads/presign`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("M5 product file upload — presign authorization", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
    await prisma.systemStorageConfig.deleteMany({ where: { id: "default" } });
    vi.doUnmock("next/headers");
  });

  it("presign succeeds for the tenant's own owner but rejects (403) a non-member requesting it for someone else's product", async () => {
    await ensureFakeStorageConfig();

    const ownerA = await createActiveUser(nextEmail());
    const tenantA = await createTenantForUser(toCurrentUser(ownerA.id), { name: "Upload Owner", slug: `${RUN_PREFIX}-a` });
    const product = await createProduct(tenantA.id, { title: "Đề thi Toán", type: "EXAM" });

    const ownerB = await createActiveUser(nextEmail());
    await createTenantForUser(toCurrentUser(ownerB.id), { name: "Upload Other", slug: `${RUN_PREFIX}-b` });

    const body = { productId: product.id, fileName: "de-thi.pdf", sizeBytes: 12_345, mimeType: "application/pdf", isPreview: false };

    await mockCookieFor(ownerA.id);
    const { POST: presignAsOwner } = await import("../../app/api/studio/[tenantSlug]/uploads/presign/route");
    const ownResponse = await presignAsOwner(presignRequest(tenantA.slug, body), { params: Promise.resolve({ tenantSlug: tenantA.slug }) });
    expect(ownResponse.status).toBe(200);
    const ownResult = await ownResponse.json();
    expect(ownResult.objectKey).toContain(tenantA.id);
    expect(ownResult.upload.mode).toBe("single");
    expect(typeof ownResult.upload.url).toBe("string");

    vi.doUnmock("next/headers");
    vi.resetModules();

    await mockCookieFor(ownerB.id);
    const { POST: presignAsOther } = await import("../../app/api/studio/[tenantSlug]/uploads/presign/route");
    const otherResponse = await presignAsOther(presignRequest(tenantA.slug, body), { params: Promise.resolve({ tenantSlug: tenantA.slug }) });
    expect(otherResponse.status).toBe(403);
  });
});
