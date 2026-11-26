import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { hashOpaqueToken, signAccessToken } from "@gieochu/auth";
import { createTenantForUser } from "../../lib/create-tenant";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../lib/jwt-context";
import { ACCESS_COOKIE_NAME } from "../../lib/cookies";
import type { CurrentUser } from "../../lib/session";

const prisma = getPrismaClient();
const RUN_PREFIX = `adr028media_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

let sessionCounter = 0;

async function mockCookieFor(userId: string): Promise<void> {
  // ADR-073 mục 9: requireTenantMember kiểm họ phiên (`sid`) còn refresh token chưa thu hồi — tạo phiên thật (xoá CASCADE cùng user).
  sessionCounter += 1;
  await prisma.refreshToken.create({
    data: { userId, familyId: "test-family", tokenHash: hashOpaqueToken(`${RUN_PREFIX}-session-${sessionCounter}`), expiresAt: new Date(Date.now() + 60 * 60_000) },
  });
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

describe("ADR-028 tenant images on system Cloudinary", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.tenantMediaAsset.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
    vi.doUnmock("next/headers");
    vi.doUnmock("../../lib/system-cloudinary");
  });

  it("refuses an upload signature (IMAGE_QUOTA_EXCEEDED) once recorded image bytes reach the plan quota, and asset rows stay tenant-isolated by RLS", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Quota Owner", slug: `${RUN_PREFIX}-quota` });

    const { getTenantImageQuota } = await import("../../lib/tenant-media");
    const quota = await getTenantImageQuota(tenant.id);
    expect(quota.usedBytes).toBe(0);
    expect(quota.limitBytes).toBeGreaterThan(0);

    const publicId = `gieochu/tenants/${tenant.id}/content/${"a".repeat(24)}`;
    await withTenant(tenant.id, (tx) =>
      tx.tenantMediaAsset.create({
        data: { tenantId: tenant.id, publicId, bytes: quota.limitBytes, format: "jpg", width: 2000, height: 1000, usage: "CONTENT", verifiedAt: new Date() },
      }),
    );

    // RLS: tenant khác và kết nối không scope đều không thấy dòng này (FORCE RLS, role gieochu_app).
    expect(await withTenant("some-other-tenant-id", (tx) => tx.tenantMediaAsset.count({ where: { publicId } }))).toBe(0);
    expect(await prisma.tenantMediaAsset.count({ where: { publicId } })).toBe(0);

    await mockCookieFor(owner.id);
    const { getContentImageUploadSignatureAction } = await import("../../app/studio/[tenantSlug]/media-actions");
    const result = await getContentImageUploadSignatureAction(tenant.slug);
    expect(result).toMatchObject({ ok: false, errorCode: "IMAGE_QUOTA_EXCEEDED", signature: "" });
    expect(result.error).toContain("nâng cấp gói");

    // Không cấp chữ ký thì cũng không giữ chỗ dòng mới.
    expect(await withTenant(tenant.id, (tx) => tx.tenantMediaAsset.count({ where: { tenantId: tenant.id } }))).toBe(1);
  });

  it("register rejects public ids outside the tenant's own folder/usage before calling the Admin API, and records server-read bytes for a valid one", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Register Owner", slug: `${RUN_PREFIX}-register` });
    const other = await createActiveUser(nextEmail());
    const otherTenant = await createTenantForUser(toCurrentUser(other.id), { name: "Register Other", slug: `${RUN_PREFIX}-register-other` });

    // Admin API Cloudinary được mock ở lớp lib (không đụng cấu hình Cloudinary thật trong DB).
    const fetchCloudinaryImageResource = vi.fn(async (publicId: string) => ({
      kind: "found" as const,
      resource: {
        publicId,
        bytes: 123_456,
        format: "webp",
        width: 1600,
        height: 900,
        secureUrl: `https://res.cloudinary.com/testcloud/image/upload/v1700000000/${publicId}.webp`,
      },
    }));
    vi.doMock("../../lib/system-cloudinary", async (importOriginal) => ({
      ...(await importOriginal<typeof import("../../lib/system-cloudinary")>()),
      getSystemCloudinaryLocation: async () => ({ cloudName: "testcloud", uploadRoot: "gieochu" }),
      fetchCloudinaryImageResource,
    }));
    await mockCookieFor(owner.id);
    const { registerTenantImageAction } = await import("../../app/studio/[tenantSlug]/media-actions");

    const name = "0123456789abcdef01234567";
    const rejected = [
      `gieochu/tenants/${otherTenant.id}/content/${name}`, // folder tenant khác
      `gieochu/tenants/${tenant.id}/products/${name}`, // đúng tenant nhưng sai mục đích (usage CONTENT)
      `gieochu/tenants/${tenant.id}/content/../../${otherTenant.id}/content/${name}`, // traversal
      `gieochu/tenants/${tenant.id}/content/evil-name`, // không phải tên server sinh
      `other-root/tenants/${tenant.id}/content/${name}`, // ngoài thư mục gốc hệ thống
    ];
    for (const publicId of rejected) {
      expect(await registerTenantImageAction(tenant.slug, publicId, "CONTENT")).toMatchObject({ ok: false, errorCode: "INVALID_IMAGE_PUBLIC_ID" });
    }
    expect(fetchCloudinaryImageResource).not.toHaveBeenCalled();
    expect(await withSystemJob((tx) => tx.tenantMediaAsset.count({ where: { tenantId: { in: [tenant.id, otherTenant.id] } } }))).toBe(0);

    const ownPublicId = `gieochu/tenants/${tenant.id}/content/${name}`;
    const accepted = await registerTenantImageAction(tenant.slug, ownPublicId, "CONTENT");
    expect(accepted).toEqual({ ok: true, verified: true, url: `https://res.cloudinary.com/testcloud/image/upload/v1700000000/${ownPublicId}.webp` });
    expect(fetchCloudinaryImageResource).toHaveBeenCalledTimes(1);
    const row = await withTenant(tenant.id, (tx) => tx.tenantMediaAsset.findUnique({ where: { publicId: ownPublicId } }));
    expect(row).toMatchObject({ tenantId: tenant.id, bytes: 123_456, format: "webp", width: 1600, height: 900, usage: "CONTENT" });
    expect(row?.verifiedAt).toBeInstanceOf(Date);
  });
});
