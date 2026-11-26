import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { hashOpaqueToken, signAccessToken } from "@gieochu/auth";
import { getPrismaClient, withSystemJob, withTenant } from "@gieochu/db";
import { getAccessTokenTtlSeconds, getJwtContext } from "../../lib/jwt-context";
import { ACCESS_COOKIE_NAME } from "../../lib/cookies";
import {
  lockUser,
  requestUserPasswordReset,
  resendVerificationForUser,
  revealUserPhone,
  revokeUserSessions,
  unlockUser,
  USER_ADMIN_ERROR_CODES,
} from "../../lib/admin-users";
import { rateLimitKey } from "../../lib/rate-limit-store";
import { getActivePlans } from "../../lib/pricing";
import { createTenantForUser } from "../../lib/create-tenant";
import { lockTenant, TENANT_LOCK_ERROR_CODES, unlockTenant } from "../../lib/tenant-lock";
import { addDays } from "../../lib/tenant-stats";
import type { CurrentUser } from "../../lib/session";
import { POST as login } from "../../app/api/auth/login/route";

// ADR-072/073: email khoá/mở khoá gian hàng + tài khoản, đặt lại mật khẩu, kích hoạt không gửi thật (DB/SMTP dùng chung) — spy
// đếm, loại email khác giữ nguyên.
const MOCKED_EMAIL_TYPES = new Set(["tenant_locked", "tenant_unlocked", "user_locked", "user_unlocked", "reset_password", "verify_email"]);
const { sendEmailNowSpy } = vi.hoisted(() => ({ sendEmailNowSpy: vi.fn() }));
vi.mock("../../lib/email-dispatch", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/email-dispatch")>();
  sendEmailNowSpy.mockImplementation(async (message: { type: string }) =>
    MOCKED_EMAIL_TYPES.has(message.type) ? { ok: true } : actual.sendEmailNow(message as never),
  );
  return { ...actual, sendEmailNow: sendEmailNowSpy };
});

const prisma = getPrismaClient();
const RUN_PREFIX = `m2test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
// slugify() đổi "_" thành "-" — gian hàng tạm nhận theo tiền tố này.
const SLUG_PREFIX = RUN_PREFIX.replace(/_/g, "-");
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

let sessionCounter = 0;
/** Bộ đếm giới hạn tần suất (DB) do test tạo — xoá ở afterAll. */
const rateLimitKeys: string[] = [];

/** Phiên thật trong `refresh_tokens` (ADR-073 mục 9: guard nhạy cảm kiểm họ phiên của access token trong DB). */
async function createSession(userId: string, familyId: string, data: { ip?: string; replacedById?: string } = {}) {
  sessionCounter += 1;
  return prisma.refreshToken.create({
    data: {
      userId,
      familyId,
      tokenHash: hashOpaqueToken(`${RUN_PREFIX}-session-${sessionCounter}`),
      expiresAt: new Date(Date.now() + 60 * 60_000),
      sessionStartedAt: new Date(),
      ...data,
    },
  });
}

async function mockAccessCookie(
  userId: string,
  role: "USER" | "SYSTEM_ADMIN",
  options: { familyId?: string; createSession?: boolean } = {},
): Promise<void> {
  const familyId = options.familyId ?? "test-family";
  if (options.createSession ?? true) await createSession(userId, familyId);
  const token = await signAccessToken(
    { sub: userId, sid: familyId, role, ver: true, pc: true },
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
    // ADR-072: gian hàng tạm của lần chạy này — bảng L2 dọn qua withSystemJob (client thường bị RLS lọc về 0 dòng);
    // subscriptions/tenant_daily_stats/slug history xoá theo CASCADE. Dòng audit_logs không xoá được (chấp nhận, ADR-037).
    const tenants = await prisma.tenant.findMany({ where: { slug: { startsWith: SLUG_PREFIX } }, select: { id: true } });
    const tenantIds = tenants.map((t) => t.id);
    if (tenantIds.length > 0) {
      await withSystemJob(async (tx) => {
        await tx.tenantPaymentConfig.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.product.deleteMany({ where: { tenantId: { in: tenantIds } } });
        await tx.tenantMember.deleteMany({ where: { tenantId: { in: tenantIds } } });
      });
      await prisma.subscriptionInvoice.deleteMany({ where: { tenantId: { in: tenantIds } } });
      await prisma.tenant.deleteMany({ where: { id: { in: tenantIds } } });
    }
    await prisma.plan.deleteMany({ where: { code: { startsWith: RUN_PREFIX } } });
    // refresh_tokens / verification_tokens / user_profiles xoá theo CASCADE cùng users.
    await prisma.user.deleteMany({ where: { email: { startsWith: RUN_PREFIX } } });
    if (rateLimitKeys.length > 0) await prisma.rateLimitCounter.deleteMany({ where: { key: { in: rateLimitKeys } } });
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

    const adminActor = toCurrentUser(admin.id, "SYSTEM_ADMIN");
    const userEmails = (type: string, to?: string) =>
      sendEmailNowSpy.mock.calls
        .map(([message]) => message as { type: string; to: string; text: string; html: string })
        .filter((m) => m.type === type && (to === undefined || m.to === to));
    const userAudit = (userId: string, action: string) =>
      prisma.auditLog.findMany({ where: { targetId: userId, action }, orderBy: { createdAt: "desc" }, select: { actorId: true, metadata: true } });
    /** Guard nhạy cảm (requireCheckoutUser → assertActiveSession) với access token CÒN HẠN của phiên `familyId`. */
    const guardWith = async (userId: string, familyId: string) => {
      vi.resetModules();
      await mockAccessCookie(userId, "USER", { familyId, createSession: false });
      const { requireCheckoutUser } = await import("../../lib/session");
      return requireCheckoutUser();
    };

    await createSession(target.id, "fam-1");
    sendEmailNowSpy.mockClear();
    await expect(guardWith(target.id, "fam-1")).resolves.toMatchObject({ userId: target.id });

    // ADR-073 — thiếu lý do / quá 500 ký tự → chặn, không đổi trạng thái, không email.
    await expect(lockUser(adminActor, target.id, "   ")).rejects.toMatchObject({ code: USER_ADMIN_ERROR_CODES.REASON_INVALID });
    await expect(lockUser(adminActor, target.id, "x".repeat(501))).rejects.toMatchObject({ code: USER_ADMIN_ERROR_CODES.REASON_INVALID });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: target.id } })).status).toBe("ACTIVE");
    expect(userEmails("user_locked")).toHaveLength(0);

    const userLockReason = "Spam bình luận <b>nhiều lần</b>";
    const lockResult = await lockUser(adminActor, target.id, `  ${userLockReason}  `);
    expect(lockResult).toEqual({ previousStatus: "ACTIVE", revokedSessions: 1, emailSent: true });

    const activeTokens = await prisma.refreshToken.count({ where: { userId: target.id, revokedAt: null } });
    expect(activeTokens).toBe(0);
    const lockedAudit = await userAudit(target.id, "USER_LOCKED");
    expect(lockedAudit).toHaveLength(1);
    expect(lockedAudit[0]).toMatchObject({ actorId: admin.id, metadata: { reason: userLockReason, previousStatus: "ACTIVE", revokedSessions: 1, emailSent: true } });
    const lockedMails = userEmails("user_locked");
    expect(lockedMails).toHaveLength(1);
    expect(lockedMails[0]!.to).toBe(target.email);
    expect(lockedMails[0]!.text).toContain(userLockReason);
    expect(lockedMails[0]!.html).not.toContain("<b>");
    // Khoá có hiệu lực NGAY ở khu vực nhạy cảm dù access token còn hạn (ADR-073 mục 9).
    await expect(guardWith(target.id, "fam-1")).rejects.toMatchObject({ code: "ACCOUNT_LOCKED", httpStatus: 401 });
    await expect(lockUser(adminActor, target.id, userLockReason)).rejects.toMatchObject({ code: USER_ADMIN_ERROR_CODES.ALREADY_LOCKED });

    // Không khoá / đăng xuất / bắt đặt lại mật khẩu được siêu quản trị hay chính mình.
    const superAdmin = await createUser({ role: "SYSTEM_ADMIN", isSuperAdmin: true });
    await createSession(superAdmin.id, `${RUN_PREFIX}-super`);
    await expect(lockUser(adminActor, superAdmin.id, "Lý do")).rejects.toMatchObject({ code: "LOCK_REJECTED_SUPER_ADMIN" });
    await expect(lockUser(adminActor, admin.id, "Lý do")).rejects.toMatchObject({ code: "LOCK_REJECTED_SELF" });
    await expect(revokeUserSessions(adminActor, superAdmin.id)).rejects.toMatchObject({ code: "LOCK_REJECTED_SUPER_ADMIN" });
    await expect(revokeUserSessions(adminActor, admin.id)).rejects.toMatchObject({ code: "LOCK_REJECTED_SELF" });
    await expect(requestUserPasswordReset(adminActor, superAdmin.id)).rejects.toMatchObject({ code: "LOCK_REJECTED_SUPER_ADMIN" });
    await expect(requestUserPasswordReset(adminActor, admin.id)).rejects.toMatchObject({ code: "LOCK_REJECTED_SELF" });
    expect(await prisma.refreshToken.count({ where: { userId: superAdmin.id, revokedAt: null } })).toBe(1);
    await expect(lockUser(toCurrentUser(target.id), superAdmin.id, "Lý do")).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Mở khoá: lý do bắt buộc; đã xác minh email → ACTIVE; chưa xác minh → PENDING (bổ sung 6).
    await expect(unlockUser(adminActor, target.id, "")).rejects.toMatchObject({ code: USER_ADMIN_ERROR_CODES.REASON_INVALID });
    const userUnlocked = await unlockUser(adminActor, target.id, "Đã xác minh lại");
    expect(userUnlocked).toEqual({ status: "ACTIVE", emailSent: true });
    expect(userEmails("user_unlocked", target.email)).toHaveLength(1);
    expect((await userAudit(target.id, "USER_UNLOCKED"))[0]).toMatchObject({ metadata: { reason: "Đã xác minh lại", newStatus: "ACTIVE" } });
    const unverified = await prisma.user.create({ data: { email: nextEmail(), passwordHash: "x", status: "PENDING" } });
    await lockUser(adminActor, unverified.id, "Tạm khoá");
    expect(await unlockUser(adminActor, unverified.id, "Mở lại")).toMatchObject({ status: "PENDING" });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: unverified.id } })).status).toBe("PENDING");
    // Gửi lại email kích hoạt: audit + 1 lần / 60 giây / người dùng (bổ sung 7).
    rateLimitKeys.push(rateLimitKey("admin_verification_resend", unverified.id));
    await resendVerificationForUser(adminActor, unverified.id);
    await expect(resendVerificationForUser(adminActor, unverified.id)).rejects.toMatchObject({ code: USER_ADMIN_ERROR_CODES.RATE_LIMITED });
    expect(userEmails("verify_email", unverified.email)).toHaveLength(1);
    expect(await userAudit(unverified.id, "USER_VERIFICATION_RESENT")).toHaveLength(1);

    // Đăng xuất mọi thiết bị: thu hồi đúng các phiên của người này (token đã bị thay không tính là phiên riêng).
    const victim = await createUser({ role: "USER" });
    const bystander = await createUser({ role: "USER" });
    const head = await createSession(victim.id, `${RUN_PREFIX}-v1`);
    await createSession(victim.id, `${RUN_PREFIX}-v1`, { replacedById: head.id });
    await createSession(victim.id, `${RUN_PREFIX}-v2`);
    await createSession(bystander.id, `${RUN_PREFIX}-b1`);
    expect(await revokeUserSessions(adminActor, victim.id)).toEqual({ revokedCount: 2 });
    expect(await prisma.refreshToken.count({ where: { userId: victim.id, revokedAt: null } })).toBe(0);
    expect(await prisma.refreshToken.count({ where: { userId: bystander.id, revokedAt: null } })).toBe(1);
    expect((await userAudit(victim.id, "USER_SESSIONS_REVOKED"))[0]).toMatchObject({ actorId: admin.id, metadata: { revokedSessions: 2 } });
    await expect(guardWith(victim.id, `${RUN_PREFIX}-v2`)).rejects.toMatchObject({ code: "SESSION_REVOKED", httpStatus: 401 });
    // Khu vực tài khoản cũng chặn ngay: Server Action (requireVerified) → 401; trang (requireVerifiedAccess) → /login.
    vi.resetModules();
    await mockAccessCookie(victim.id, "USER", { familyId: `${RUN_PREFIX}-v2`, createSession: false });
    const { requireVerified } = await import("../../lib/session");
    await expect(requireVerified()).rejects.toMatchObject({ code: "SESSION_REVOKED", httpStatus: 401 });
    const { requireVerifiedAccess } = await import("../../lib/page-guards");
    await expect(requireVerifiedAccess("/account/security")).rejects.toMatchObject({
      digest: expect.stringContaining(`/login?next=${encodeURIComponent("/account/security")}`),
    });
    vi.doUnmock("next/headers");
    await expect(revokeUserSessions(adminActor, victim.id)).rejects.toMatchObject({ code: USER_ADMIN_ERROR_CODES.NO_SESSIONS });

    // Yêu cầu đặt lại mật khẩu: bật cờ + thu hồi mọi phiên + 1 email (token chỉ lưu hash, mở đầu "Quản trị viên …").
    await createSession(bystander.id, `${RUN_PREFIX}-b2`);
    sendEmailNowSpy.mockClear();
    expect(await requestUserPasswordReset(adminActor, bystander.id)).toEqual({ revokedCount: 2, emailSent: true });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: bystander.id } })).passwordResetRequired).toBe(true);
    expect(await prisma.refreshToken.count({ where: { userId: bystander.id, revokedAt: null } })).toBe(0);
    const resetMails = userEmails("reset_password", bystander.email);
    expect(resetMails).toHaveLength(1);
    expect(resetMails[0]!.text).toContain("Quản trị viên");
    expect(resetMails[0]!.text).not.toContain(admin.email);
    const rawResetToken = /reset-password\?token=([^\s"<]+)/.exec(resetMails[0]!.text)?.[1];
    expect(rawResetToken).toBeTruthy();
    const resetRow = await prisma.verificationToken.findFirstOrThrow({ where: { userId: bystander.id, type: "PASSWORD_RESET" } });
    expect(resetRow.tokenHash).toBe(hashOpaqueToken(rawResetToken!));
    expect(resetRow.tokenHash).not.toBe(rawResetToken);
    expect((await userAudit(bystander.id, "USER_PASSWORD_RESET_REQUIRED"))[0]).toMatchObject({ metadata: { revokedSessions: 2, emailSent: true } });
    // Đăng nhập: cùng mã/HTTP status; câu báo phân biệt quản trị viên yêu cầu vs. sai mật khẩu quá ngưỡng.
    const loginBystander = async () =>
      login(
        new Request("http://localhost/api/auth/login", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ email: bystander.email, password: "Bat-ky-123" }),
        }),
      );
    const adminResetLogin = await loginBystander();
    expect(adminResetLogin.status).toBe(403);
    const adminResetError = (await adminResetLogin.json()).error;
    expect(adminResetError.code).toBe("PASSWORD_RESET_REQUIRED");
    expect(adminResetError.message).toContain("cần đặt lại mật khẩu trước khi đăng nhập");
    await prisma.user.update({ where: { id: bystander.id }, data: { failedLoginAttempts: 5 } });
    const lockoutLogin = await loginBystander();
    expect(lockoutLogin.status).toBe(403);
    const lockoutError = (await lockoutLogin.json()).error;
    expect(lockoutError.code).toBe("PASSWORD_RESET_REQUIRED");
    expect(lockoutError.message).toContain("sai quá nhiều lần");

    // Xem số điện thoại đầy đủ: audit (không chứa số) ghi trước khi trả; chưa có số → lỗi.
    rateLimitKeys.push(rateLimitKey("admin_phone_reveal", admin.id));
    const fullPhone = "0912345123";
    await prisma.userProfile.create({ data: { userId: victim.id, fullName: "Nạn Nhân", phone: fullPhone, consentAt: new Date() } });
    expect(await revealUserPhone(adminActor, victim.id)).toBe(fullPhone);
    const phoneAudit = await prisma.auditLog.findMany({ where: { targetId: victim.id, action: "USER_PHONE_VIEWED" } });
    expect(phoneAudit).toHaveLength(1);
    expect(phoneAudit[0]!.actorId).toBe(admin.id);
    expect(JSON.stringify(phoneAudit)).not.toContain(fullPhone);
    await expect(revealUserPhone(adminActor, bystander.id)).rejects.toMatchObject({ code: USER_ADMIN_ERROR_CODES.NO_PHONE });

    // Khoá lại tài khoản để kiểm đăng nhập bị chặn (§"M2").
    await lockUser(adminActor, target.id, userLockReason);

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

    // ADR-072 — khoá / mở khoá GIAN HÀNG: lý do bắt buộc, audit có lý do, đúng 1 email chủ gian hàng mỗi lần đổi.
    const owner = await createUser({ role: "USER" });
    const shop = await createTenantForUser(toCurrentUser(owner.id), { name: "Lock Shop", slug: `${SLUG_PREFIX}-lock` });
    const adminUser = toCurrentUser(admin.id, "SYSTEM_ADMIN");
    const statusOf = async () => (await prisma.tenant.findUniqueOrThrow({ where: { id: shop.id }, select: { status: true } })).status;
    const tenantEmails = (type: string) =>
      sendEmailNowSpy.mock.calls
        .map(([message]) => message as { type: string; to: string; text: string; html: string })
        .filter((m) => m.type === type);
    const auditOf = (action: string) =>
      prisma.auditLog.findMany({ where: { tenantId: shop.id, action }, orderBy: { createdAt: "desc" }, select: { actorId: true, metadata: true } });
    sendEmailNowSpy.mockClear();

    await expect(lockTenant(toCurrentUser(owner.id), shop.id, "Lý do")).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(lockTenant(adminUser, shop.id, "   ")).rejects.toMatchObject({ code: TENANT_LOCK_ERROR_CODES.REASON_INVALID });
    await expect(lockTenant(adminUser, shop.id, "x".repeat(501))).rejects.toMatchObject({ code: TENANT_LOCK_ERROR_CODES.REASON_INVALID });
    expect(await statusOf()).toBe("ACTIVE");
    expect(tenantEmails("tenant_locked")).toHaveLength(0);

    const lockReason = "Tài liệu vi phạm bản quyền <script>";
    const locked = await lockTenant(adminUser, shop.id, `  ${lockReason}  `);
    expect(locked).toEqual({ previousStatus: "ACTIVE", emailSent: true });
    expect(await statusOf()).toBe("LOCKED");
    const lockAudit = await auditOf("TENANT_LOCKED");
    expect(lockAudit).toHaveLength(1);
    expect(lockAudit[0]).toMatchObject({ actorId: admin.id, metadata: { reason: lockReason, previousStatus: "ACTIVE" } });
    const lockMails = tenantEmails("tenant_locked");
    expect(lockMails).toHaveLength(1);
    expect(lockMails[0]!.to).toBe(owner.email);
    expect(lockMails[0]!.text).toContain(lockReason);
    expect(lockMails[0]!.html).not.toContain("<script>");
    // Khoá lại khi đã khoá → lỗi trạng thái, không audit/email thêm.
    await expect(lockTenant(adminUser, shop.id, lockReason)).rejects.toMatchObject({ code: TENANT_LOCK_ERROR_CODES.ALREADY_LOCKED });
    expect(tenantEmails("tenant_locked")).toHaveLength(1);

    await expect(unlockTenant(adminUser, shop.id, "")).rejects.toMatchObject({ code: TENANT_LOCK_ERROR_CODES.REASON_INVALID });
    expect(await statusOf()).toBe("LOCKED");
    const unlocked = await unlockTenant(adminUser, shop.id, "Đã gỡ tài liệu vi phạm");
    expect(unlocked).toEqual({ previousStatus: "LOCKED", emailSent: true });
    expect(await statusOf()).toBe("ACTIVE");
    const unlockAudit = await auditOf("TENANT_UNLOCKED");
    expect(unlockAudit).toHaveLength(1);
    expect(unlockAudit[0]).toMatchObject({ actorId: admin.id, metadata: { reason: "Đã gỡ tài liệu vi phạm", previousStatus: "LOCKED" } });
    const unlockMails = tenantEmails("tenant_unlocked");
    expect(unlockMails).toHaveLength(1);
    expect(unlockMails[0]!.to).toBe(owner.email);
    await expect(unlockTenant(adminUser, shop.id, "Lần hai")).rejects.toMatchObject({ code: TENANT_LOCK_ERROR_CODES.NOT_LOCKED });
    expect(tenantEmails("tenant_unlocked")).toHaveLength(1);

    vi.doUnmock("next/headers");
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

    // ADR-072 — chi tiết gian hàng (System Center): số liệu chỉ từ tenant_daily_stats, cổng thanh toán chỉ tên cổng đang bật.
    const { adminStatsWindow, getAdminTenantDetail, listAdminTenants } = await import("../../lib/admin-tenant-detail");
    const owner = await createUser({ role: "USER" });
    const shop = await createTenantForUser(toCurrentUser(owner.id), { name: "Detail Shop", slug: `${SLUG_PREFIX}-detail` });
    const secretMarker = `${RUN_PREFIX}-ciphertext`;
    await withTenant(shop.id, async (tx) => {
      await tx.tenantPaymentConfig.create({
        data: { tenantId: shop.id, provider: "MANUAL_QR", isEnabled: true, publicConfig: { accountNo: "9990001112" }, encryptedSecrets: secretMarker, webhookSecretHash: `${secretMarker}-hash` },
      });
      await tx.tenantPaymentConfig.create({
        data: { tenantId: shop.id, provider: "SEPAY", isEnabled: false, publicConfig: { accountNo: "9990001113" }, encryptedSecrets: secretMarker },
      });
      await tx.product.create({ data: { tenantId: shop.id, slug: "pub", title: "Pub", status: "PUBLISHED" } });
      await tx.product.create({ data: { tenantId: shop.id, slug: "draft", title: "Draft", status: "DRAFT" } });
    });
    const window = adminStatsWindow();
    const statRow = (date: string, n: number) => ({ tenantId: shop.id, date: new Date(`${date}T00:00:00.000Z`), ordersPaid: n, gmvVnd: BigInt(n * 100_000), newCustomers: n, downloads: n * 2 });
    await prisma.tenantDailyStat.createMany({
      data: [statRow(addDays(window.to, -2), 3), statRow(addDays(window.from, -5), 1), statRow(addDays(window.to, 1), 7)],
    });

    const detail = await getAdminTenantDetail(shop.id);
    expect(detail).not.toBeNull();
    if (!detail) return;
    expect(detail).toMatchObject({ id: shop.id, slug: `${SLUG_PREFIX}-detail`, status: "ACTIVE", owner: { id: owner.id, email: owner.email } });
    expect(detail.paymentMethods).toEqual(["MANUAL_QR"]);
    expect(detail.stats.window).toEqual(window);
    expect(detail.stats.last30d).toEqual({ gmvVnd: 300_000, ordersPaid: 3, newCustomers: 3, downloads: 6 });
    // "Từ trước tới nay" tính tới hết window.to — dòng sau mốc đó (hôm nay) không tính.
    expect(detail.stats.allTime).toEqual({ gmvVnd: 400_000, ordersPaid: 4, newCustomers: 4, downloads: 8 });
    expect(detail.content.products).toEqual({ PUBLISHED: 1, DRAFT: 1, ARCHIVED: 0, total: 2 });
    expect(detail.subscription?.plan.isFree).toBe(true);
    expect(detail.audit.entries.some((entry) => entry.kind === "TENANT_CREATED" && entry.actor.role === "OWNER")).toBe(true);
    const detailJson = JSON.stringify(detail);
    for (const leaked of [secretMarker, "9990001112", "encryptedSecrets", "publicConfig", "webhookSecretHash"]) {
      expect(detailJson).not.toContain(leaked);
    }
    expect(await getAdminTenantDetail("nonexistenttenant000000000")).toBeNull();
    expect(await getAdminTenantDetail("../bad id")).toBeNull();

    const list = await listAdminTenants({ skip: 0, take: 20 });
    const row = list.items.find((item) => item.id === shop.id);
    expect(row).toMatchObject({ gmv30dVnd: 300_000, productCount: 2, owner: { email: owner.email } });

    // ADR-073 — chi tiết người dùng: không passwordHash/tokenHash/familyId, số điện thoại + IP đã che, cờ thao tác đúng.
    const { getAdminUserDetail } = await import("../../lib/admin-user-detail");
    const hashMarker = `${RUN_PREFIX}-argon-hash`;
    await prisma.user.update({ where: { id: owner.id }, data: { passwordHash: hashMarker } });
    await prisma.userProfile.create({ data: { userId: owner.id, fullName: "Chủ Shop", phone: "0912345123", province: "Hà Nội", consentAt: new Date() } });
    const ownerSession = await createSession(owner.id, `${RUN_PREFIX}-owner-fam`, { ip: "113.161.12.34" });
    await createSession(owner.id, `${RUN_PREFIX}-owner-v6`, { ip: "2001:db8:85a3::8a2e:370:7334" });
    const userDetail = await getAdminUserDetail(owner.id);
    expect(userDetail).not.toBeNull();
    if (!userDetail) return;
    expect(userDetail).toMatchObject({
      id: owner.id,
      role: "OWNER",
      status: "ACTIVE",
      isSelf: false,
      fullName: "Chủ Shop",
      profile: { phoneMasked: "09•••••123", province: "Hà Nội" },
      ownedTenant: { id: shop.id, slug: `${SLUG_PREFIX}-detail` },
      actions: { canLock: true, canUnlock: false, canRevokeSessions: true, canResendVerification: false, canRequestPasswordReset: true, lockBlocked: null },
    });
    expect(userDetail.security.activeSessionCount).toBe(2);
    expect(userDetail.security.sessions.map((s) => s.ipMasked).sort()).toEqual(["113.161.•••.•••", "2001:db8:•••"]);
    const userDetailJson = JSON.stringify(userDetail);
    for (const leaked of [hashMarker, ownerSession.tokenHash, ownerSession.familyId, "0912345123", "113.161.12.34", "8a2e:370:7334", "passwordHash", "tokenHash", "familyId"]) {
      expect(userDetailJson).not.toContain(leaked);
    }
    const selfDetail = await getAdminUserDetail(admin.id);
    expect(selfDetail).toMatchObject({ isSelf: true, role: "ADMIN", actions: { canLock: false, canRevokeSessions: false, canRequestPasswordReset: false, lockBlocked: "SELF" } });
    expect(await getAdminUserDetail("nonexistentuser00000000000")).toBeNull();
    expect(await getAdminUserDetail("../bad id")).toBeNull();

    vi.doUnmock("next/headers");
  });
});
