import { randomBytes } from "node:crypto";
import { NextRequest } from "next/server";
import { afterAll, describe, expect, it } from "vitest";
import { hashOpaqueToken, hashPassword, verifyAccessToken } from "@gieochu/auth";
import { getPrismaClient } from "@gieochu/db";
import { REFRESH_COOKIE_NAME, ACCESS_COOKIE_NAME, type CookieSetter } from "../../lib/cookies";
import { getJwtContext, getSessionPolicy } from "../../lib/jwt-context";
import { issueAccessCookieForSession } from "../../lib/session-access";
import { listAccountSessions, purgeStaleRefreshTokens, revokeAccountSession } from "../../lib/account-sessions";
import type { CurrentUser } from "../../lib/session";
import { POST as login } from "../../app/api/auth/login/route";
import { POST as refresh } from "../../app/api/auth/refresh/route";

const prisma = getPrismaClient();
const RUN_PREFIX = `adr051test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
const CHROME_WINDOWS_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36";
const MINUTE_MS = 60_000;
let counter = 0;

/** Mật khẩu ngẫu nhiên mỗi lần chạy — kể cả khi test dừng giữa chừng, tài khoản tạm không đăng nhập được bằng mật khẩu đoán được. */
async function createUser(role: "USER" | "SYSTEM_ADMIN" = "USER") {
  counter += 1;
  const email = `${RUN_PREFIX}_${counter}@example.com`;
  const password = `${randomBytes(18).toString("base64url")}Aa1!`;
  const user = await prisma.user.create({
    data: { email, passwordHash: await hashPassword(password), status: "ACTIVE", emailVerifiedAt: new Date(), systemRole: role },
  });
  return { user, email, password };
}

async function loginAs(email: string, password: string, rememberMe: boolean) {
  const response = await login(
    new NextRequest("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json", "user-agent": CHROME_WINDOWS_UA },
      body: JSON.stringify({ email, password, rememberMe }),
    }),
  );
  expect(response.status).toBe(200);
  const refreshToken = response.cookies.get(REFRESH_COOKIE_NAME)!.value;
  const record = await prisma.refreshToken.findUniqueOrThrow({ where: { tokenHash: hashOpaqueToken(refreshToken) } });
  return { response, refreshToken, record };
}

function refreshWith(token: string) {
  return refresh(new NextRequest("http://localhost/api/auth/refresh", { method: "POST", headers: { cookie: `${REFRESH_COOKIE_NAME}=${token}` } }));
}

/** Ký lại access cookie như `updateProfile` làm (Server Action) — ghi lại cookie đã đặt để kiểm tra. */
async function reissueFor(userId: string, familyId: string) {
  const set: { value: string; maxAge?: number }[] = [];
  const target: CookieSetter = { set: (name, value, options) => name === ACCESS_COOKIE_NAME && set.push({ value, maxAge: options.maxAge }) };
  const issued = await issueAccessCookieForSession(target, { userId, familyId, role: "USER", emailVerified: true, profileCompleted: true });
  const cookie = set[0];
  return { issued, cookie, claims: cookie ? await verifyAccessToken(cookie.value, getJwtContext()) : null };
}

function asCurrentUser(userId: string, familyId: string): CurrentUser {
  return { userId, familyId, role: "USER", emailVerified: true, profileCompleted: false };
}

describe("ADR-053 session policy", () => {
  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
  });

  it("login issues session cookies without remember-me, persistent cookies bounded by the absolute limit with it, and never remembers a SYSTEM_ADMIN", async () => {
    const { email, password } = await createUser();

    const plain = await loginAs(email, password, false);
    expect(plain.response.cookies.get(REFRESH_COOKIE_NAME)?.maxAge).toBeUndefined();
    expect(plain.response.cookies.get(ACCESS_COOKIE_NAME)?.maxAge).toBeUndefined();
    expect(plain.record.rememberMe).toBe(false);
    expect(plain.record.sessionStartedAt).not.toBeNull();
    expect(plain.record.deviceLabel).toBe("Chrome · Windows");
    const plainPolicy = await getSessionPolicy("USER", false);
    expect(plain.record.expiresAt.getTime() - plain.record.sessionStartedAt!.getTime()).toBe(plainPolicy.absoluteMs);

    const remembered = await loginAs(email, password, true);
    const rememberedPolicy = await getSessionPolicy("USER", true);
    expect(remembered.record.rememberMe).toBe(true);
    expect(remembered.record.expiresAt.getTime() - remembered.record.sessionStartedAt!.getTime()).toBe(rememberedPolicy.absoluteMs);
    const maxAge = remembered.response.cookies.get(REFRESH_COOKIE_NAME)?.maxAge;
    expect(maxAge).toBeGreaterThan(rememberedPolicy.absoluteMs / 1000 - 60);
    expect(maxAge).toBeLessThanOrEqual(rememberedPolicy.absoluteMs / 1000);

    // Rotation keeps the session's remember-me flag, start time and device, and never slides the absolute expiry.
    const rotated = await refreshWith(remembered.refreshToken);
    expect(rotated.status).toBe(200);
    const rotatedRecord = await prisma.refreshToken.findUniqueOrThrow({
      where: { tokenHash: hashOpaqueToken(rotated.cookies.get(REFRESH_COOKIE_NAME)!.value) },
    });
    expect(rotatedRecord).toMatchObject({
      rememberMe: true,
      sessionStartedAt: remembered.record.sessionStartedAt,
      expiresAt: remembered.record.expiresAt,
      deviceLabel: "Chrome · Windows",
      userAgent: CHROME_WINDOWS_UA,
    });

    // Re-signing an existing session (profile update) keeps its remember-me claim, TTL and cookie kind.
    const reRemembered = await reissueFor(remembered.record.userId, remembered.record.familyId);
    expect(reRemembered.issued).toBe(true);
    expect(reRemembered.claims).toMatchObject({ rm: true, pc: true, sid: remembered.record.familyId });
    expect(reRemembered.cookie?.maxAge).toBe(rememberedPolicy.accessTtlSeconds);
    expect(reRemembered.claims!.exp - reRemembered.claims!.iat).toBe(rememberedPolicy.accessTtlSeconds);
    const rePlain = await reissueFor(plain.record.userId, plain.record.familyId);
    expect(rePlain.claims).toMatchObject({ rm: false, pc: true });
    expect(rePlain.cookie?.maxAge).toBeUndefined();
    expect(rePlain.claims!.exp - rePlain.claims!.iat).toBe(plainPolicy.accessTtlSeconds);
    await prisma.refreshToken.updateMany({ where: { familyId: plain.record.familyId }, data: { revokedAt: new Date() } });
    expect((await reissueFor(plain.record.userId, plain.record.familyId)).issued).toBe(false);

    const admin = await createUser("SYSTEM_ADMIN");
    try {
      const adminLogin = await loginAs(admin.email, admin.password, true);
      const adminPolicy = await getSessionPolicy("SYSTEM_ADMIN", true);
      expect(adminLogin.record.rememberMe).toBe(false);
      expect(adminLogin.response.cookies.get(REFRESH_COOKIE_NAME)?.maxAge).toBeUndefined();
      expect(adminLogin.record.expiresAt.getTime() - adminLogin.record.sessionStartedAt!.getTime()).toBe(adminPolicy.absoluteMs);
    } finally {
      // Không để tài khoản SYSTEM_ADMIN tạm sống lâu hơn cần thiết trên DB dùng chung.
      await prisma.user.delete({ where: { id: admin.user.id } });
    }
  });

  it("refresh ends an idle session and a session past its absolute limit, and starts the clock for pre-ADR-053 sessions", async () => {
    const { user, email, password } = await createUser();

    const idle = await loginAs(email, password, false);
    const policy = await getSessionPolicy("USER", false);
    await prisma.refreshToken.update({ where: { id: idle.record.id }, data: { createdAt: new Date(Date.now() - policy.idleMs! - MINUTE_MS) } });
    const idleResponse = await refreshWith(idle.refreshToken);
    expect(idleResponse.status).toBe(401);
    expect((await idleResponse.json()).error.code).toBe("SESSION_IDLE_TIMEOUT");
    expect(idleResponse.cookies.get(REFRESH_COOKIE_NAME)?.value).toBe("");
    expect((await prisma.refreshToken.findUniqueOrThrow({ where: { id: idle.record.id } })).revokedAt).not.toBeNull();

    // Remember-me has no idle limit, but the absolute limit still applies even if the stored expiry is later.
    const remembered = await loginAs(email, password, true);
    const rememberedPolicy = await getSessionPolicy("USER", true);
    await prisma.refreshToken.update({
      where: { id: remembered.record.id },
      data: { createdAt: new Date(Date.now() - 3 * 24 * 60 * MINUTE_MS), sessionStartedAt: new Date(Date.now() - rememberedPolicy.absoluteMs - MINUTE_MS) },
    });
    const expiredResponse = await refreshWith(remembered.refreshToken);
    expect(expiredResponse.status).toBe(401);
    expect((await expiredResponse.json()).error.code).toBe("SESSION_EXPIRED");

    // A token issued before ADR-053 (no sessionStartedAt, old createdAt) is not ended by idle: the session starts now.
    const legacy = await loginAs(email, password, false);
    await prisma.refreshToken.update({
      where: { id: legacy.record.id },
      data: { sessionStartedAt: null, createdAt: new Date(Date.now() - policy.idleMs! - MINUTE_MS) },
    });
    const legacyResponse = await refreshWith(legacy.refreshToken);
    expect(legacyResponse.status).toBe(200);
    const legacyRotated = await prisma.refreshToken.findFirstOrThrow({ where: { userId: user.id, familyId: legacy.record.familyId, replacedById: null } });
    expect(legacyRotated.sessionStartedAt).not.toBeNull();
    expect(Date.now() - legacyRotated.sessionStartedAt!.getTime()).toBeLessThan(MINUTE_MS);
  });

  it("lists only the caller's active sessions and revokes one session only when the caller owns it", async () => {
    const owner = await createUser();
    const other = await createUser();
    const first = await loginAs(owner.email, owner.password, false);
    const second = await loginAs(owner.email, owner.password, true);
    const stranger = await loginAs(other.email, other.password, false);

    const current = asCurrentUser(owner.user.id, second.record.familyId);
    const sessions = await listAccountSessions(current);
    expect(sessions.map((s) => s.id)).toEqual([second.record.familyId, first.record.familyId]);
    expect(sessions[0]).toMatchObject({ isCurrent: true, rememberMe: true, deviceLabel: "Chrome · Windows" });
    expect(sessions.some((s) => s.id === stranger.record.familyId)).toBe(false);

    // Another user's session id → 404, and that session stays active.
    await expect(revokeAccountSession(current, stranger.record.familyId)).rejects.toMatchObject({ httpStatus: 404 });
    expect((await prisma.refreshToken.findUniqueOrThrow({ where: { id: stranger.record.id } })).revokedAt).toBeNull();
    await expect(revokeAccountSession(current, 123)).rejects.toMatchObject({ httpStatus: 400 });

    await expect(revokeAccountSession(current, first.record.familyId)).resolves.toEqual({ isCurrent: false });
    expect((await listAccountSessions(current)).map((s) => s.id)).toEqual([second.record.familyId]);
    const revokedRefresh = await refreshWith(first.refreshToken);
    expect(revokedRefresh.status).toBe(401);
  });

  it("the daily purge deletes refresh tokens expired or revoked more than 90 days ago and keeps the rest", async () => {
    const { user } = await createUser();
    // Mốc "now" giả lùi về 2020: cutoff (now − 90 ngày) nằm trước mọi dữ liệu thật → chỉ dòng tạm của test bị ảnh hưởng.
    const now = new Date("2020-01-01T00:00:00Z");
    const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * MINUTE_MS);
    const make = (suffix: string, data: { expiresAt: Date; revokedAt?: Date }) =>
      prisma.refreshToken.create({
        data: { userId: user.id, familyId: `${RUN_PREFIX}_${suffix}`, tokenHash: hashOpaqueToken(`${RUN_PREFIX}_${suffix}`), ...data },
      });
    const expiredLongAgo = await make("expired", { expiresAt: days(-91) });
    const revokedLongAgo = await make("revoked", { expiresAt: days(30), revokedAt: days(-91) });
    const revokedRecently = await make("recent", { expiresAt: days(30), revokedAt: days(-10) });
    const active = await make("active", { expiresAt: days(30) });

    const result = await purgeStaleRefreshTokens(now);
    // Đúng 2 dòng: không dòng thật nào (đều sau 2026) bị xoá.
    expect(result.deleted).toBe(2);
    const remaining = await prisma.refreshToken.findMany({
      where: { id: { in: [expiredLongAgo.id, revokedLongAgo.id, revokedRecently.id, active.id] } },
      select: { id: true },
    });
    expect(remaining.map((r) => r.id).sort()).toEqual([revokedRecently.id, active.id].sort());
  });
});
