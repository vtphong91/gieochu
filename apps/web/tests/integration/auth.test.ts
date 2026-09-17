import { NextRequest } from "next/server";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createVerificationToken, hashOpaqueToken, signAccessToken } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { getJwtContext, getAccessTokenTtlSeconds } from "../../lib/jwt-context";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "../../lib/cookies";

import { POST as register } from "../../app/api/auth/register/route";
import { POST as verifyEmail } from "../../app/api/auth/verify-email/route";
import { POST as login } from "../../app/api/auth/login/route";
import { POST as refresh } from "../../app/api/auth/refresh/route";
import { POST as resetPassword } from "../../app/api/auth/reset-password/route";

const prisma = getPrismaClient();
const RUN_PREFIX = `m1test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
let emailCounter = 0;

function nextEmail(): string {
  emailCounter += 1;
  return `${RUN_PREFIX}_${emailCounter}@example.com`;
}

function jsonRequest(url: string, body: unknown, cookie?: string): NextRequest {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (cookie) headers.cookie = cookie;
  return new NextRequest(url, { method: "POST", headers, body: JSON.stringify(body) });
}

async function registerUser(overrides: Partial<{ email: string; password: string; fullName: string }> = {}) {
  const email = overrides.email ?? nextEmail();
  const password = overrides.password ?? "Str0ngPass!";
  const fullName = overrides.fullName ?? "Người Test";
  const response = await register(
    jsonRequest("http://localhost/api/auth/register", { email, password, fullName, consent: true }),
  );
  return { email, password, fullName, response };
}

async function activateUser(email: string): Promise<void> {
  await prisma.user.update({ where: { email }, data: { status: "ACTIVE", emailVerifiedAt: new Date() } });
}

describe("M1 auth", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("registration creates a PENDING user and enqueues the activation email", async () => {
    const email = nextEmail();
    const { response } = await registerUser({ email });
    expect(response.status).toBe(201);

    const user = await prisma.user.findUnique({ where: { email } });
    expect(user?.status).toBe("PENDING");

    const jobs = await prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM pgboss.job WHERE name = 'email.send' AND data->>'to' = ${email}
    `;
    expect(jobs.length).toBeGreaterThan(0);
  });

  it("registering a duplicate email returns 409", async () => {
    const email = nextEmail();
    await registerUser({ email });
    const { response } = await registerUser({ email });
    expect(response.status).toBe(409);
    const body = await response.json();
    expect(body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
  });

  it("the activation link moves the user to ACTIVE", async () => {
    const email = nextEmail();
    await registerUser({ email });
    const user = await prisma.user.findUniqueOrThrow({ where: { email } });

    const verification = createVerificationToken(24, new Date());
    await prisma.verificationToken.create({
      data: { userId: user.id, type: "EMAIL_VERIFY", tokenHash: verification.tokenHash, expiresAt: verification.expiresAt },
    });

    const response = await verifyEmail(jsonRequest("http://localhost/api/auth/verify-email", { token: verification.token }));
    expect(response.status).toBe(200);

    const updated = await prisma.user.findUniqueOrThrow({ where: { email } });
    expect(updated.status).toBe("ACTIVE");
    expect(updated.emailVerifiedAt).not.toBeNull();
  });

  it("login is blocked before the account is activated", async () => {
    const { email, password } = await registerUser();
    const response = await login(jsonRequest("http://localhost/api/auth/login", { email, password }));
    expect(response.status).toBe(403);
    const body = await response.json();
    expect(body.error.code).toBe("EMAIL_NOT_VERIFIED");
  });

  it("a successful login sets both the access and refresh cookies correctly", async () => {
    const { email, password } = await registerUser();
    await activateUser(email);

    const response = await login(jsonRequest("http://localhost/api/auth/login", { email, password }));
    expect(response.status).toBe(200);

    const accessCookie = response.cookies.get(ACCESS_COOKIE_NAME);
    const refreshCookie = response.cookies.get(REFRESH_COOKIE_NAME);
    expect(accessCookie?.value).toBeTruthy();
    expect(accessCookie?.httpOnly).toBe(true);
    expect(String(accessCookie?.sameSite).toLowerCase()).toBe("lax");
    expect(refreshCookie?.value).toBeTruthy();
    expect(refreshCookie?.httpOnly).toBe(true);
    expect(refreshCookie?.path).toBe("/api/auth");
  });

  it("refresh rotates the cookie; reusing the old refresh token revokes the whole family", async () => {
    const { email, password } = await registerUser();
    await activateUser(email);
    const loginResponse = await login(jsonRequest("http://localhost/api/auth/login", { email, password }));
    const oldRefreshToken = loginResponse.cookies.get(REFRESH_COOKIE_NAME)?.value;
    expect(oldRefreshToken).toBeTruthy();

    const firstRefresh = await refresh(
      new NextRequest("http://localhost/api/auth/refresh", {
        method: "POST",
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldRefreshToken}` },
      }),
    );
    expect(firstRefresh.status).toBe(200);
    const newRefreshToken = firstRefresh.cookies.get(REFRESH_COOKIE_NAME)?.value;
    expect(newRefreshToken).toBeTruthy();
    expect(newRefreshToken).not.toBe(oldRefreshToken);

    // Reusing the now-replaced old token must revoke the whole family.
    const reuseAttempt = await refresh(
      new NextRequest("http://localhost/api/auth/refresh", {
        method: "POST",
        headers: { cookie: `${REFRESH_COOKIE_NAME}=${oldRefreshToken}` },
      }),
    );
    expect(reuseAttempt.status).toBe(401);
    const reuseBody = await reuseAttempt.json();
    expect(reuseBody.error.code).toBe("AUTH_REFRESH_REUSE");

    // The rotated (new) token must now be revoked too, since the whole family was.
    const newTokenHash = hashOpaqueToken(newRefreshToken!);
    const newRecord = await prisma.refreshToken.findUnique({ where: { tokenHash: newTokenHash } });
    expect(newRecord?.revokedAt).not.toBeNull();
  });

  it("resetting the password revokes every active session", async () => {
    const { email, password } = await registerUser();
    await activateUser(email);
    const loginResponse = await login(jsonRequest("http://localhost/api/auth/login", { email, password }));
    expect(loginResponse.status).toBe(200);

    const user = await prisma.user.findUniqueOrThrow({ where: { email } });
    const activeBefore = await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(activeBefore).toBeGreaterThan(0);

    const reset = createVerificationToken(0.5, new Date());
    await prisma.verificationToken.create({
      data: { userId: user.id, type: "PASSWORD_RESET", tokenHash: reset.tokenHash, expiresAt: reset.expiresAt },
    });

    const response = await resetPassword(
      jsonRequest("http://localhost/api/auth/reset-password", { token: reset.token, newPassword: "NewStr0ngPass!" }),
    );
    expect(response.status).toBe(200);

    const activeAfter = await prisma.refreshToken.count({ where: { userId: user.id, revokedAt: null } });
    expect(activeAfter).toBe(0);
  });

  describe("incomplete profile redirects away from /account/library", () => {
    beforeEach(() => {
      vi.resetModules();
    });

    it("redirects to /account/profile?complete=1 when the profile is incomplete", async () => {
      const { email } = await registerUser();
      await activateUser(email);
      const user = await prisma.user.findUniqueOrThrow({ where: { email } });

      const accessToken = await signAccessToken(
        { sub: user.id, sid: "test-family", role: "USER", ver: true, pc: false },
        getJwtContext(),
        getAccessTokenTtlSeconds(),
      );

      vi.doMock("next/headers", () => ({
        cookies: async () => ({
          get: (name: string) => (name === ACCESS_COOKIE_NAME ? { value: accessToken } : undefined),
        }),
      }));

      const { requireCompleteAccountAccess } = await import("../../lib/page-guards");

      await expect(requireCompleteAccountAccess("/account/library")).rejects.toMatchObject({
        digest: expect.stringContaining("/account/profile?complete=1"),
      });

      vi.doUnmock("next/headers");
    });
  });
});
