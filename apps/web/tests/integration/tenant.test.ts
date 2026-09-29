import { afterAll, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "@gieochu/auth";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { createTenantForUser } from "../../lib/create-tenant";
import { getPublishedProducts } from "../../lib/storefront";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../lib/jwt-context";
import { ACCESS_COOKIE_NAME } from "../../lib/cookies";
import type { CurrentUser } from "../../lib/session";

const prisma = getPrismaClient();
const RUN_PREFIX = `m4test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

describe("M4 tenant workspace and storefront", () => {
  afterAll(async () => {
    const tenants = await prisma.tenant.findMany({
      where: { slug: { startsWith: RUN_PREFIX } },
      select: { id: true },
    });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      // products/tenant_members are RLS-protected; a plain cascade delete
      // from `tenants` would itself violate the policy with no scope set.
      await withSystemJob(async (tx) => {
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
    }
    await prisma.tenant.deleteMany({ where: { slug: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("creates a tenant with an OWNER membership and an ACTIVE subscription on the FREE plan", async () => {
    const user = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(user.id), {
      name: "Cô Hạnh Toán",
      slug: `${RUN_PREFIX}-t1`,
    });

    const member = await withTenant(tenant.id, (tx) =>
      tx.tenantMember.findUnique({ where: { tenantId_userId: { tenantId: tenant.id, userId: user.id } } }),
    );
    expect(member?.role).toBe("OWNER");

    const subscription = await prisma.subscription.findUnique({ where: { tenantId: tenant.id }, include: { plan: true } });
    expect(subscription?.status).toBe("ACTIVE");
    expect(subscription?.plan.isFree).toBe(true);
  });

  it("rejects creating a tenant with a slug that is already taken (409)", async () => {
    const dupSlug = `${RUN_PREFIX}-dup`;
    const userA = await createActiveUser(nextEmail());
    await createTenantForUser(toCurrentUser(userA.id), { name: "Trung Tâm A", slug: dupSlug });

    const userB = await createActiveUser(nextEmail());
    await expect(
      createTenantForUser(toCurrentUser(userB.id), { name: "Trung Tâm B", slug: dupSlug }),
    ).rejects.toMatchObject({ httpStatus: 409, code: "SLUG_TAKEN" });
  });

  it("owner of tenant A gets 403 visiting /studio/[tenant B's slug]", async () => {
    const ownerA = await createActiveUser(nextEmail());
    await createTenantForUser(toCurrentUser(ownerA.id), { name: "Trung Tâm A2", slug: `${RUN_PREFIX}-a` });

    const ownerB = await createActiveUser(nextEmail());
    const tenantB = await createTenantForUser(toCurrentUser(ownerB.id), {
      name: "Trung Tâm B2",
      slug: `${RUN_PREFIX}-b`,
    });

    const accessToken = await signAccessToken(
      { sub: ownerA.id, sid: "test-family", role: "USER", ver: true, pc: true },
      getJwtContext(),
      await getAccessTokenTtlSeconds(),
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

  it("RLS blocks cross-tenant product reads inside withTenant(A)", async () => {
    const ownerA = await createActiveUser(nextEmail());
    const tenantA = await createTenantForUser(toCurrentUser(ownerA.id), {
      name: "RLS A",
      slug: `${RUN_PREFIX}-rls-a`,
    });
    const ownerB = await createActiveUser(nextEmail());
    const tenantB = await createTenantForUser(toCurrentUser(ownerB.id), {
      name: "RLS B",
      slug: `${RUN_PREFIX}-rls-b`,
    });

    await withSystemJob((tx) =>
      tx.product.create({ data: { tenantId: tenantB.id, slug: "prod-b", title: "Product B", status: "DRAFT" } }),
    );

    const rows = await withTenant(tenantA.id, (tx) => tx.product.findMany({ where: { tenantId: tenantB.id } }));
    expect(rows).toHaveLength(0);
  });

  it("the storefront only shows PUBLISHED products", async () => {
    const owner = await createActiveUser(nextEmail());
    const tenant = await createTenantForUser(toCurrentUser(owner.id), {
      name: "Storefront Test",
      slug: `${RUN_PREFIX}-sf`,
    });

    await withSystemJob((tx) =>
      tx.product.create({
        data: { tenantId: tenant.id, slug: "published-1", title: "Published One", status: "PUBLISHED" },
      }),
    );
    await withSystemJob((tx) =>
      tx.product.create({ data: { tenantId: tenant.id, slug: "draft-1", title: "Draft One", status: "DRAFT" } }),
    );

    const products = await getPublishedProducts(tenant.id);
    expect(products).toHaveLength(1);
    expect(products[0]?.title).toBe("Published One");
  });
});
