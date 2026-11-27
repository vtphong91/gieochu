import { createVerificationToken } from "@gieochu/auth";
import { AppError, decideLockUser, forbidden, logger, notFound } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, type Tx, type UserStatus } from "@gieochu/db";
import { renderResetPasswordEmailTemplate, renderUserLockedEmail, renderUserUnlockedEmail, renderVerifyEmailTemplate } from "@gieochu/email";
import { EMAIL_NOT_CONFIGURED, emailNotConfiguredError, sendEmailNow } from "./email-dispatch";
import { getEffectiveBrand } from "./branding";
import { LOCK_REASON_MAX_LENGTH } from "./lock-reason";
import { getSupportEmail, getSystemSettings } from "./system-settings";
import { audit } from "./audit";
import { checkRateLimit } from "./rate-limit";
import { consumeRateLimit, rateLimitKey } from "./rate-limit-store";
import type { CurrentUser } from "./session";

/**
 * §"M2" + ADR-073 — thao tác System Admin trên tài khoản người dùng. Bảng L1 (`users`, `user_profiles`, `refresh_tokens`,
 * `verification_tokens`, `tenants`) → `getPrismaClient()` trực tiếp là đúng lớp. Mỗi hàm tự kiểm `actor.role` (Server Action
 * gọi `requireRole("SYSTEM_ADMIN")` trước) và kiểm lại điều kiện nghiệp vụ ở server. Audit + email luôn SAU commit; lỗi gửi
 * email chỉ log → `emailSent: false`. Quản trị viên không bao giờ xem/đặt mật khẩu thay người dùng.
 */

/** Alias giữ import cũ — nguồn duy nhất là `lib/lock-reason.ts` (client-safe, ADR-074). */
export const USER_LOCK_REASON_MAX_LENGTH = LOCK_REASON_MAX_LENGTH;

export const USER_ADMIN_ERROR_CODES = {
  REASON_INVALID: "USER_LOCK_REASON_INVALID",
  ALREADY_LOCKED: "USER_ALREADY_LOCKED",
  NOT_LOCKED: "USER_NOT_LOCKED",
  NOT_ACTIVE: "USER_NOT_ACTIVE",
  NOT_PENDING: "NOT_PENDING",
  NO_SESSIONS: "USER_NO_ACTIVE_SESSIONS",
  NO_PHONE: "USER_NO_PHONE",
  AUDIT_FAILED: "AUDIT_WRITE_FAILED",
  RATE_LIMITED: "RATE_LIMITED",
} as const;

const ID_PATTERN = /^[a-z0-9]{1,40}$/i;
/** ADR-073 bổ sung 7 — gửi lại email kích hoạt: 1 lần / 60 giây / người dùng (bộ đếm DB, dùng chung giữa các instance). */
const RESEND_VERIFICATION_WINDOW_MS = 60 * 1000;
/** Xem số điện thoại đầy đủ: 30 lần / phút / quản trị viên. */
const PHONE_REVEAL_LIMIT = 30;
const PHONE_REVEAL_WINDOW_MS = 60 * 1000;
/** Cùng bộ đếm với `/api/auth/forgot-password` (5 lần / giờ / email) — kế hoạch Đợt 4 §9. */
const PASSWORD_RESET_LIMIT = 5;
const PASSWORD_RESET_WINDOW_MS = 60 * 60 * 1000;

/** Lý do sau trim; null khi rỗng/không phải chuỗi/quá 500 ký tự. */
export function normalizeUserLockReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  if (reason.length === 0 || reason.length > USER_LOCK_REASON_MAX_LENGTH) return null;
  return reason;
}

function requireReason(value: unknown): string {
  const reason = normalizeUserLockReason(value);
  if (!reason) {
    throw new AppError({
      code: USER_ADMIN_ERROR_CODES.REASON_INVALID,
      message: `Hãy nhập lý do (tối đa ${USER_LOCK_REASON_MAX_LENGTH} ký tự).`,
      httpStatus: 400,
    });
  }
  return reason;
}

function assertSystemAdmin(actor: CurrentUser): void {
  if (actor.role !== "SYSTEM_ADMIN") throw forbidden();
}

function userNotFound(): AppError {
  return notFound("Không tìm thấy người dùng.");
}

async function loadTarget(userId: string) {
  if (typeof userId !== "string" || !ID_PATTERN.test(userId)) throw userNotFound();
  const target = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, status: true, isSuperAdmin: true, emailVerifiedAt: true, passwordResetRequired: true },
  });
  if (!target) throw userNotFound();
  return target;
}

/** Không thao tác lên chính mình / siêu quản trị (khoá, đăng xuất mọi thiết bị, yêu cầu đặt lại mật khẩu — ADR-073 bổ sung 8). */
function assertNotSelfOrSuperAdmin(actor: CurrentUser, target: { id: string; isSuperAdmin: boolean }, verb: string): void {
  const decision = decideLockUser(actor.userId, { id: target.id, isSuperAdmin: target.isSuperAdmin });
  if (decision.allowed) return;
  throw new AppError({
    code: `LOCK_REJECTED_${decision.reason}`,
    message: decision.reason === "SELF" ? `Bạn không thể ${verb} chính mình.` : `Không thể ${verb} siêu quản trị.`,
    httpStatus: 400,
  });
}

/**
 * Thu hồi mọi refresh token chưa thu hồi của user (kể cả token đã bị thay khi rotate) trong transaction của caller. Trả số
 * PHIÊN (familyId) còn hiệu lực trước khi thu hồi — không đếm token đã bị thay.
 */
async function revokeAllSessionsInTx(tx: Tx, userId: string, now: Date): Promise<number> {
  const families = await tx.refreshToken.findMany({
    where: { userId, revokedAt: null, replacedById: null, expiresAt: { gt: now } },
    distinct: ["familyId"],
    select: { familyId: true },
  });
  await tx.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
  return families.length;
}

async function sendSafely(type: string, to: string, rendered: { subject: string; html: string; text: string }, userId: string): Promise<boolean> {
  try {
    const result = await sendEmailNow({ type, to, subject: rendered.subject, html: rendered.html, text: rendered.text });
    if (!result.ok) logger.warn({ userId, type, error: result.error, code: result.code }, "admin_users: gửi email thất bại");
    return result.ok;
  } catch (error) {
    logger.error({ err: error, userId, type }, "admin_users: lỗi khi gửi email");
    return false;
  }
}

function appUrl(): string {
  return getEnv().APP_URL.replace(/\/+$/, "");
}

// ───────────────────────── Khoá / mở khoá ─────────────────────────

export interface UserLockResult {
  previousStatus: UserStatus;
  revokedSessions: number;
  emailSent: boolean;
}

/**
 * ADR-073 mục 3 — khoá tài khoản (lý do bắt buộc 1–500, gửi nguyên văn cho người dùng). Một transaction: đổi trạng thái có
 * điều kiện (2 admin bấm cùng lúc → người sau nhận ALREADY_LOCKED) + thu hồi mọi phiên. Sau commit: email rồi audit
 * `USER_LOCKED { reason, previousStatus, revokedSessions, emailSent }`. Khoá chỉ đổi `users.status` — không xoá dữ liệu nào.
 */
export async function lockUser(actor: CurrentUser, targetUserId: string, rawReason: unknown): Promise<UserLockResult> {
  assertSystemAdmin(actor);
  const reason = requireReason(rawReason);
  const target = await loadTarget(targetUserId);
  assertNotSelfOrSuperAdmin(actor, target, "khoá");
  const alreadyLocked = () => new AppError({ code: USER_ADMIN_ERROR_CODES.ALREADY_LOCKED, message: "Tài khoản đã bị khoá.", httpStatus: 409 });
  if (target.status === "LOCKED") throw alreadyLocked();

  const prisma = getPrismaClient();
  const now = new Date();
  const revokedSessions = await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({ where: { id: target.id, status: target.status, isSuperAdmin: false }, data: { status: "LOCKED" } });
    if (count === 0) throw alreadyLocked();
    return revokeAllSessionsInTx(tx, target.id, now);
  });

  const [brand, supportEmail, ownedTenant] = await Promise.all([
    getEffectiveBrand(),
    getSupportEmail(),
    prisma.tenant.findUnique({ where: { ownerId: target.id }, select: { name: true } }),
  ]);
  const emailSent = await sendSafely(
    "user_locked",
    target.email,
    renderUserLockedEmail({ appName: brand.name, email: target.email, reason, supportEmail, ownedTenantName: ownedTenant?.name ?? null }),
    target.id,
  );
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    action: "USER_LOCKED",
    targetType: "User",
    targetId: target.id,
    metadata: { reason, previousStatus: target.status, revokedSessions, emailSent },
  });
  return { previousStatus: target.status, revokedSessions, emailSent };
}

export interface UserUnlockResult {
  status: "ACTIVE" | "PENDING";
  emailSent: boolean;
}

/**
 * ADR-073 mục 3 + bổ sung 6 — mở khoá (lý do bắt buộc): về PENDING nếu email chưa xác minh, ngược lại ACTIVE. Sau commit: email
 * rồi audit `USER_UNLOCKED { reason, newStatus, emailSent }`.
 */
export async function unlockUser(actor: CurrentUser, targetUserId: string, rawReason: unknown): Promise<UserUnlockResult> {
  assertSystemAdmin(actor);
  const reason = requireReason(rawReason);
  const target = await loadTarget(targetUserId);
  const notLocked = () =>
    new AppError({ code: USER_ADMIN_ERROR_CODES.NOT_LOCKED, message: "Tài khoản không ở trạng thái bị khoá.", httpStatus: 409 });
  if (target.status !== "LOCKED") throw notLocked();

  const status: "ACTIVE" | "PENDING" = target.emailVerifiedAt ? "ACTIVE" : "PENDING";
  const prisma = getPrismaClient();
  const { count } = await prisma.user.updateMany({ where: { id: target.id, status: "LOCKED" }, data: { status } });
  if (count === 0) throw notLocked();

  const [brand, supportEmail] = await Promise.all([getEffectiveBrand(), getSupportEmail()]);
  const emailSent = await sendSafely(
    "user_unlocked",
    target.email,
    renderUserUnlockedEmail({
      appName: brand.name,
      email: target.email,
      reason,
      supportEmail,
      loginUrl: `${appUrl()}/login`,
      passwordResetRequired: target.passwordResetRequired,
    }),
    target.id,
  );
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    action: "USER_UNLOCKED",
    targetType: "User",
    targetId: target.id,
    metadata: { reason, newStatus: status, emailSent },
  });
  return { status, emailSent };
}

// ───────────────────────── Đăng xuất mọi thiết bị ─────────────────────────

/** ADR-073 mục 4 — thu hồi mọi phiên còn hiệu lực; audit `USER_SESSIONS_REVOKED { revokedSessions }`. Không email. */
export async function revokeUserSessions(actor: CurrentUser, targetUserId: string): Promise<{ revokedCount: number }> {
  assertSystemAdmin(actor);
  const target = await loadTarget(targetUserId);
  assertNotSelfOrSuperAdmin(actor, target, "đăng xuất mọi thiết bị của");

  const now = new Date();
  const revokedCount = await getPrismaClient().$transaction((tx) => revokeAllSessionsInTx(tx, target.id, now));
  if (revokedCount === 0) {
    throw new AppError({ code: USER_ADMIN_ERROR_CODES.NO_SESSIONS, message: "Người dùng không có phiên đăng nhập nào đang hoạt động.", httpStatus: 409 });
  }
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    action: "USER_SESSIONS_REVOKED",
    targetType: "User",
    targetId: target.id,
    metadata: { revokedSessions: revokedCount },
  });
  return { revokedCount };
}

// ───────────────────────── Yêu cầu đặt lại mật khẩu ─────────────────────────

/**
 * ADR-073 mục 4 + bổ sung 10 — chỉ tài khoản ACTIVE, không phải chính mình/siêu quản trị. Một transaction: bật
 * `passwordResetRequired` (đăng nhập bị chặn tới khi đặt lại — `/api/auth/login`), thu hồi MỌI phiên, phát token
 * PASSWORD_RESET (chỉ lưu hash, TTL `passwordResetTtlMinutes`). Sau commit: email theo khuôn "Quên mật khẩu" với đoạn mở đầu
 * "Quản trị viên … đã yêu cầu…" (không nêu tên admin), rồi audit `USER_PASSWORD_RESET_REQUIRED { revokedSessions, emailSent }`
 * (khoá metadata không chứa "password" — bộ lọc audit sẽ che). Chung giới hạn 5 lần/giờ/email với luồng quên mật khẩu.
 */
export async function requestUserPasswordReset(actor: CurrentUser, targetUserId: string): Promise<{ revokedCount: number; emailSent: boolean }> {
  assertSystemAdmin(actor);
  const target = await loadTarget(targetUserId);
  assertNotSelfOrSuperAdmin(actor, target, "yêu cầu đặt lại mật khẩu cho");
  if (target.status !== "ACTIVE") {
    throw new AppError({
      code: USER_ADMIN_ERROR_CODES.NOT_ACTIVE,
      message: "Chỉ yêu cầu đặt lại mật khẩu được với tài khoản đang hoạt động.",
      httpStatus: 409,
    });
  }
  if (!checkRateLimit(`forgot-password:${target.email}`, PASSWORD_RESET_LIMIT, PASSWORD_RESET_WINDOW_MS)) {
    throw new AppError({
      code: USER_ADMIN_ERROR_CODES.RATE_LIMITED,
      message: "Đã gửi quá nhiều email đặt lại mật khẩu cho tài khoản này, vui lòng thử lại sau.",
      httpStatus: 429,
    });
  }

  const prisma = getPrismaClient();
  const now = new Date();
  const [settings, brand] = await Promise.all([getSystemSettings(), getEffectiveBrand()]);
  const verification = createVerificationToken(settings.passwordResetTtlMinutes / 60, now);
  const revokedCount = await prisma.$transaction(async (tx) => {
    const { count } = await tx.user.updateMany({
      where: { id: target.id, status: "ACTIVE", isSuperAdmin: false },
      data: { passwordResetRequired: true },
    });
    if (count === 0) {
      throw new AppError({ code: USER_ADMIN_ERROR_CODES.NOT_ACTIVE, message: "Tài khoản không còn ở trạng thái hoạt động.", httpStatus: 409 });
    }
    const revoked = await revokeAllSessionsInTx(tx, target.id, now);
    await tx.verificationToken.create({
      data: { userId: target.id, type: "PASSWORD_RESET", tokenHash: verification.tokenHash, expiresAt: verification.expiresAt },
    });
    return revoked;
  });

  const emailSent = await sendSafely(
    "reset_password",
    target.email,
    renderResetPasswordEmailTemplate({
      appName: brand.name,
      resetUrl: `${appUrl()}/reset-password?token=${verification.token}`,
      expiresInMinutes: settings.passwordResetTtlMinutes,
      requestedByAdmin: true,
    }),
    target.id,
  );
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    action: "USER_PASSWORD_RESET_REQUIRED",
    targetType: "User",
    targetId: target.id,
    metadata: { revokedSessions: revokedCount, emailSent },
  });
  return { revokedCount, emailSent };
}

// ───────────────────────── Xem số điện thoại đầy đủ ─────────────────────────

/**
 * ADR-073 mục 2 — trả số điện thoại đầy đủ cho đúng lần xem này. Audit `USER_PHONE_VIEWED` (metadata KHÔNG chứa số) được ghi
 * TRƯỚC khi trả; ghi audit thất bại → không trả số. 30 lần / phút / quản trị viên.
 */
export async function revealUserPhone(actor: CurrentUser, targetUserId: string): Promise<string> {
  assertSystemAdmin(actor);
  if (typeof targetUserId !== "string" || !ID_PATTERN.test(targetUserId)) throw userNotFound();
  if (!(await consumeRateLimit(rateLimitKey("admin_phone_reveal", actor.userId), PHONE_REVEAL_LIMIT, PHONE_REVEAL_WINDOW_MS))) {
    throw new AppError({ code: USER_ADMIN_ERROR_CODES.RATE_LIMITED, message: "Bạn xem quá nhiều lần, vui lòng thử lại sau ít phút.", httpStatus: 429 });
  }
  const user = await getPrismaClient().user.findUnique({ where: { id: targetUserId }, select: { id: true, profile: { select: { phone: true } } } });
  if (!user) throw userNotFound();
  const phone = user.profile?.phone?.trim();
  if (!phone) throw new AppError({ code: USER_ADMIN_ERROR_CODES.NO_PHONE, message: "Người dùng chưa có số điện thoại.", httpStatus: 404 });

  const logged = await audit.log({ actorId: actor.userId, scope: "SYSTEM", action: "USER_PHONE_VIEWED", targetType: "User", targetId: user.id });
  if (!logged) {
    throw new AppError({ code: USER_ADMIN_ERROR_CODES.AUDIT_FAILED, message: "Không ghi được nhật ký xem, vui lòng thử lại sau.", httpStatus: 503 });
  }
  return phone;
}

// ───────────────────────── Gửi lại email kích hoạt ─────────────────────────

/** Gửi lại email kích hoạt (chỉ PENDING) — 1 lần/60 giây/người dùng; audit `USER_VERIFICATION_RESENT` khi gửi thành công. */
export async function resendVerificationForUser(actor: CurrentUser, targetUserId: string): Promise<void> {
  assertSystemAdmin(actor);
  if (typeof targetUserId !== "string" || !ID_PATTERN.test(targetUserId)) throw userNotFound();
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: targetUserId } });
  if (!user || user.status !== "PENDING") {
    throw new AppError({ code: USER_ADMIN_ERROR_CODES.NOT_PENDING, message: "User không ở trạng thái chờ kích hoạt.", httpStatus: 400 });
  }
  if (!(await consumeRateLimit(rateLimitKey("admin_verification_resend", user.id), 1, RESEND_VERIFICATION_WINDOW_MS))) {
    throw new AppError({
      code: USER_ADMIN_ERROR_CODES.RATE_LIMITED,
      message: "Vừa gửi email kích hoạt cho người dùng này, vui lòng đợi 60 giây rồi thử lại.",
      httpStatus: 429,
    });
  }

  const now = new Date();
  const [settings, brand] = await Promise.all([getSystemSettings(), getEffectiveBrand()]);
  const verification = createVerificationToken(settings.emailVerifyTtlHours, now);
  await prisma.verificationToken.create({
    data: { userId: user.id, type: "EMAIL_VERIFY", tokenHash: verification.tokenHash, expiresAt: verification.expiresAt },
  });
  const verifyUrl = `${appUrl()}/verify-email?token=${verification.token}`;
  const rendered = renderVerifyEmailTemplate({ appName: brand.name, verifyUrl, expiresInHours: settings.emailVerifyTtlHours });
  const result = await sendEmailNow({ type: "verify_email", to: user.email, subject: rendered.subject, html: rendered.html, text: rendered.text });
  if (!result.ok) {
    if (result.code === EMAIL_NOT_CONFIGURED) throw emailNotConfiguredError();
    throw new AppError({ code: "EMAIL_SEND_FAILED", message: `Gửi email thất bại: ${result.error}`, httpStatus: 502 });
  }
  await audit.log({ actorId: actor.userId, scope: "SYSTEM", action: "USER_VERIFICATION_RESENT", targetType: "User", targetId: user.id, metadata: { emailSent: true } });
}

/** §"M2": chỉ super admin mới được cấp quyền SYSTEM_ADMIN. */
export async function grantSystemAdmin(actor: CurrentUser, targetUserId: string): Promise<void> {
  const prisma = getPrismaClient();
  const actorRecord = await prisma.user.findUniqueOrThrow({ where: { id: actor.userId } });
  if (!actorRecord.isSuperAdmin) {
    throw forbidden("Chỉ super admin mới được cấp quyền quản trị hệ thống.");
  }

  await prisma.user.update({ where: { id: targetUserId }, data: { systemRole: "SYSTEM_ADMIN" } });
}
