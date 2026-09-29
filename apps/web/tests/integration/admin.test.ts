import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { signAccessToken } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../lib/jwt-context";
import { ACCESS_COOKIE_NAME } from "../../lib/cookies";
import { lockUser } from "../../lib/admin-users";
import { getActivePlans } from "../../lib/pricing";
import type { CurrentUser } from "../../lib/session";
import { POST as login } from "../../app/api/auth/login/route";

const prisma = getPrismaClient();
const RUN_PREFIX = `m2test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.com`;
}

async function createUser(options: { role?: "USER" | "SYSTEM_ADMIN"; isSuperAdmin?: boolean } = {}) {
  return prisma.user.create({
    data: {
      email: nextEmail(),
      passwordHash: "not-used-in-this-test",
      status: "ACTIVE",
      systemRole: options.role ?? "USER",
      isSuperAdmin: options.isSuperAdmin ?? false,
      emailVerifiedAt: new Date(),
    },
  });
}

function toCurrentUser(userId: string, role: "USER" | "SYSTEM_ADMIN" = "USER"): CurrentUser {
  return { userId, familyId: "test-family", role, emailVerified: true, profileCompleted: true };
}

async function mockAccessCookie(userId: string, role: "USER" | "SYSTEM_ADMIN"): Promise<void> {
  const token = await signAccessToken(
    { sub: userId, sid: "test-family", role, ver: true, pc: true },
    getJwtContext(),
    await getAccessTokenTtlSeconds(),
  );
  vi.doMock("next/headers", () => ({
    cookies: async () => ({
      get: (name: string) => (name === ACCESS_COOKIE_NAME ? { value: token } : undefined),
    }),
  }));
}

describe("M2 system admin", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterAll(async () => {
    await prisma.plan.deleteMany({ where: { code: { startsWith: RUN_PREFIX } } });
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("a non-admin calling /api/admin/* gets 403", async () => {
    const user = await createUser({ role: "USER" });
    await mockAccessCookie(user.id, "USER");

    const { GET } = await import("../../app/api/admin/dashboard/route");
    const response = await GET(new Request("http://localhost/api/admin/dashboard"));
    expect(response.status).toBe(403);

    vi.doUnmock("next/headers");
  });

  it("locking a user revokes its sessions and blocks login", async () => {
    const admin = await createUser({ role: "SYSTEM_ADMIN" });
    const target = await createUser({ role: "USER" });
    const password = "Str0ngPass!";
    const { hashPassword } = await import("@gieochu/auth");
    await prisma.user.update({ where: { id: target.id }, data: { passwordHash: await hashPassword(password) } });

    await prisma.refreshToken.create({
      data: {
        userId: target.id,
        familyId: "fam-1",
        tokenHash: `${RUN_PREFIX}-hash-1`,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });

    await lockUser(toCurrentUser(admin.id, "SYSTEM_ADMIN"), target.id);

    const activeTokens = await prisma.refreshToken.count({ where: { userId: target.id, revokedAt: null } });
    expect(activeTokens).toBe(0);

    const response = await login(
      new Request("http://localhost/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email: target.email, password }),
      }),
    );
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("ACCOUNT_LOCKED");
  });

  it("a newly created plan shows up on /pricing", async () => {
    await prisma.plan.create({
      data: {
        code: `${RUN_PREFIX}-PLAN`,
        name: "Gói test M2",
        priceVnd: 99_000,
        interval: "MONTH",
        intervalCount: 1,
        maxProducts: 10,
        storageMb: 1000,
        maxFileMb: 100,
        isActive: true,
      },
    });

    const plans = await getActivePlans();
    expect(plans.some((plan) => plan.code === `${RUN_PREFIX}-PLAN`)).toBe(true);
  });

  it("the admin dashboard API only returns aggregate counts, never personal data", async () => {
    const admin = await createUser({ role: "SYSTEM_ADMIN" });
    await mockAccessCookie(admin.id, "SYSTEM_ADMIN");

    const { GET } = await import("../../app/api/admin/dashboard/route");
    const response = await GET(new Request("http://localhost/api/admin/dashboard"));
    expect(response.status).toBe(200);

    const body = await response.json();
    const serialized = JSON.stringify(body);
    expect(serialized).not.toContain("@example.com");
    expect(body).toHaveProperty("totalUsers");
    expect(body).toHaveProperty("usersByStatus");
    expect(body).not.toHaveProperty("users");
    expect(body).not.toHaveProperty("tenants");

    vi.doUnmock("next/headers");
  });
});
