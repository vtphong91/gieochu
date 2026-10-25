import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrismaClient, withSystemJob } from "@gieochu/db";
import { signAccessToken } from "@gieochu/auth";
import { createTenantForUser } from "../../lib/create-tenant";
import { createProduct } from "../../lib/product";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../lib/jwt-context";
import { ACCESS_COOKIE_NAME } from "../../lib/cookies";
import type { CurrentUser } from "../../lib/session";

// ADR-034: DB dev = production — test KHÔNG ghi `system_storage_config`. Presign/URL tải chỉ là ký request cục bộ (không gọi
// mạng), nên thay lớp đọc cấu hình bằng cấu hình R2 giả trong bộ nhớ. Tenant tạo mới chưa có bucket riêng → đi nhánh
// R2 mặc định, không gọi `ensureBucketExists`.
vi.mock("../../lib/system-storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/system-storage")>();
  const { createS3Client } = await import("@gieochu/storage");
  const credentials = { accessKeyId: "fake", secretAccessKey: "fake" };
  const r2 = { endpoint: "https://fake.example.com", region: "auto", bucketPrivate: "fake-private", bucketPublic: "fake-public", ...credentials };
  const fakeConfig = {
    isEnabled: true,
    activeProvider: "CLOUDFLARE_R2" as const,
    r2,
    minio: { host: "", useSSL: true, region: "us-east-1", ...credentials },
    endpoint: r2.endpoint,
    region: r2.region,
    bucketPrivate: r2.bucketPrivate,
    bucketPublic: r2.bucketPublic,
    ...credentials,
  };
  const clientConfig = { endpoint: r2.endpoint, region: r2.region, ...credentials };
  return {
    ...actual,
    getDecryptedSystemStorageConfig: async () => fakeConfig,
    createClientForProvider: async () => ({ client: createS3Client(clientConfig), config: clientConfig }),
  };
});

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

async function mockCookieFor(userId: string): Promise<void> {
  const accessToken = await signAccessToken(
    { sub: userId, sid: "test-family", role: "USER", ver: true, pc: true },
    getJwtContext(),
    await getAccessTokenTtlSeconds(),
  );
  vi.doMock("next/headers", () => ({
    cookies: async () => ({
      get: (name: string) => (name === ACCESS_COOKIE_NAME ? { value: accessToken } : undefined),
    }),
  }));
}

function completeRequest(tenantSlug: string, body: unknown): Request {
  return new Request(`http://localhost/api/studio/${tenantSlug}/uploads/complete`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
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
    vi.doUnmock("next/headers");
    vi.doUnmock("@gieochu/storage");
  });

  it("presign succeeds for the tenant's own owner but rejects (403) a non-member requesting it for someone else's product", async () => {
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
  it("complete rejects (400) another tenant's object key before any storage call and registers nothing", async () => {
    const ownerA = await createActiveUser(nextEmail());
    const tenantA = await createTenantForUser(toCurrentUser(ownerA.id), { name: "Upload Thief", slug: `${RUN_PREFIX}-c` });
    const productA = await createProduct(tenantA.id, { title: "Sản phẩm A", type: "EXAM" });

    const ownerB = await createActiveUser(nextEmail());
    const tenantB = await createTenantForUser(toCurrentUser(ownerB.id), { name: "Upload Victim", slug: `${RUN_PREFIX}-d` });
    const productB = await createProduct(tenantB.id, { title: "Sản phẩm B", type: "EXAM" });

    const headObject = vi.fn();
    const completeMultipartUpload = vi.fn();
    vi.doMock("@gieochu/storage", async (importOriginal) => ({
      ...(await importOriginal<typeof import("@gieochu/storage")>()),
      headObject,
      completeMultipartUpload,
    }));
    await mockCookieFor(ownerA.id);
    const { buildProductFileKey } = await import("@gieochu/storage");
    const { POST: complete } = await import("../../app/api/studio/[tenantSlug]/uploads/complete/route");

    const foreignKey = buildProductFileKey(tenantB.id, productB.id, "123e4567-e89b-42d3-a456-426614174000", "de-thi.pdf");
    const body = {
      productId: productA.id,
      objectKey: foreignKey,
      fileName: "de-thi.pdf",
      mimeType: "application/pdf",
      sizeBytes: 12_345,
      uploadId: "fake-upload",
      parts: [{ partNumber: 1, eTag: "etag" }],
    };
    const response = await complete(completeRequest(tenantA.slug, body), { params: Promise.resolve({ tenantSlug: tenantA.slug }) });
    expect(response.status).toBe(400);
    const payload = await response.json();
    expect(payload.error.code).toBe("INVALID_OBJECT_KEY");

    expect(headObject).not.toHaveBeenCalled();
    expect(completeMultipartUpload).not.toHaveBeenCalled();
    const registered = await withSystemJob((tx) => tx.productFile.count({ where: { objectKey: foreignKey } }));
    expect(registered).toBe(0);
  });
});
