import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import { createCoupon } from "../../lib/coupon";
import type { CurrentUser } from "../../lib/session";

const prisma = getPrismaClient();
const RUN_PREFIX = `m6test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function previewRequest(tenantSlug: string, body: unknown): Request {
  return new Request(`http://localhost/api/${tenantSlug}/coupons/preview`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("M6 pricing — coupon preview API", () => {
  beforeEach(() => {
    vi.resetModules();
    // The route is public but still calls getCurrentUser() (guest vs logged-in), which reads
    // next/headers' cookies() — that only works inside a real Next.js request context, so a
    // direct route-handler call in tests needs it mocked, same as every other route test here.
    vi.doMock("next/headers", () => ({
      cookies: async () => ({ get: () => undefined }),
    }));
  });

  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: RUN_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.coupon.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
    vi.doUnmock("next/headers");
  });

  it("recalculates the total server-side (never trusts a client-supplied amount) when a valid coupon code is applied", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), { name: "Coupon Preview", slug: `${RUN_PREFIX}-preview` });

    const product = await withTenant(tenant.id, (tx) =>
      tx.product.create({ data: { tenantId: tenant.id, slug: "de-thi", title: "Đề thi", status: "PUBLISHED", priceVnd: 100_000 } }),
    );

    await createCoupon(tenant.id, {
      code: "GIAM20",
      type: "PERCENT",
      value: 20,
      isEnabled: true,
    });

    const { POST: previewCoupon } = await import("../../app/api/[tenantSlug]/coupons/preview/route");
    const response = await previewCoupon(previewRequest(tenant.slug, { productIds: [product.id], couponCode: "giam20" }), {
      params: Promise.resolve({ tenantSlug: tenant.slug }),
    });
    const result = await response.json();
    expect(response.status).toBe(200);

    expect(result.subtotalVnd).toBe(100_000);
    expect(result.discountVnd).toBe(20_000);
    expect(result.totalVnd).toBe(80_000);
    expect(result.couponError).toBeUndefined();
  });
});
