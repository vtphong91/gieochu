import { cookies } from "next/headers";
import {
  createVerificationToken,
  evaluateVerificationToken,
  hashOpaqueToken,
  hashPassword,
  isValidPassword,
  normalizeEmail,
  verifyPassword,
} from "@gieochu/auth";
import { DISPLAY_TIME_ZONE, logger, maskEmail } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient } from "@gieochu/db";
import {
  renderEmailChangedEmail,
  renderEmailChangeRequestedEmail,
  renderEmailChangeVerifyEmail,
  renderPasswordChangedEmail,
} from "@gieochu/email";
import { z } from "zod";
import { audit } from "./audit";
import { getEffectiveBrand } from "./branding";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME } from "./cookies";
import { sendEmailNow } from "./email-dispatch";
import { checkRateLimit } from "./rate-limit";
import type { CurrentUser } from "./session";
import { getSystemSettings } from "./system-settings";
import { accountFailure, formString, type AccountActionState } from "./account-state";
import { findPendingEmailChange } from "./account-profile";

/**
 * ADR-041 mục C.2 — bảo mật tài khoản: đổi mật khẩu, đổi email đăng nhập. Bảng L1 (`users`, `refresh_tokens`,
 * `verification_tokens`) — `getPrismaClient()` trực tiếp là đúng lớp. Token đổi email chỉ lưu hash SHA-256.
 *
 * Giới hạn đã biết: thu hồi phiên = thu hồi refresh token; access token đã cấp cho thiết bị khác vẫn sống tới hết
 * hạn (`accessTokenTtlMinutes`, mặc định 15 phút) — cùng giới hạn với "Đăng xuất mọi thiết bị" / đặt lại mật khẩu.
 */

const PASSWORD_MESSAGE = "Mật khẩu mới phải có ít nhất 8 ký tự, gồm cả chữ và số.";

/** Sai mật khẩu hiện tại nhiều lần: chặn tạm thao tác (KHÔNG khoá đăng nhập như login). 5 lần / 15 phút / user. */
const CHANGE_PASSWORD_LIMIT = 5;
const CHANGE_PASSWORD_WINDOW_MS = 15 * 60 * 1000;
/** Gửi yêu cầu/gửi lại link đổi email: 3 lần / giờ / user (gộp request + resend). */
const EMAIL_CHANGE_LIMIT = 3;
const EMAIL_CHANGE_WINDOW_MS = 60 * 60 * 1000;
/** Xác nhận link đổi email (không cần đăng nhập): chặn dò token theo IP — 20 lần / 15 phút. */
const EMAIL_CONFIRM_LIMIT = 20;
const EMAIL_CONFIRM_WINDOW_MS = 15 * 60 * 1000;

function formatVnDateTime(date: Date): string {
  return date.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE });
}

async function loadSupportEmail(): Promise<string | null> {
  try {
    const row = await getPrismaClient().systemSettings.findUnique({ where: { id: "default" }, select: { supportEmail: true } });
    return row?.supportEmail?.trim() || null;
  } catch (error) {
    logger.warn({ err: error }, "account: không đọc được supportEmail");
    return null;
  }
}

async function sendSafely(type: string, to: string, rendered: { subject: string; html: string; text: string }): Promise<boolean> {
  const sent = await sendEmailNow({ type, to, subject: rendered.subject, html: rendered.html, text: rendered.text });
  if (!sent.ok) logger.warn({ type, error: sent.error, code: sent.code }, "account: gửi email thất bại");
  return sent.ok;
}

// ───────────────────────── Đổi mật khẩu (C3) ─────────────────────────

export type ChangePasswordState = AccountActionState;

/**
 * C3 — cần mật khẩu hiện tại; mật khẩu mới phải mạnh và khác mật khẩu cũ. Thành công: thu hồi mọi refresh token
 * TRỪ họ phiên hiện tại (`familyId` trong access token), email báo, audit `AUTH_PASSWORD_CHANGED`.
 */
export async function changePassword(user: CurrentUser, formData: FormData): Promise<ChangePasswordState> {
  const currentPassword = formString(formData, "currentPassword");
  const newPassword = formString(formData, "newPassword");

  const fieldErrors: Record<string, string> = {};
  if (!currentPassword) fieldErrors.currentPassword = "Vui lòng nhập mật khẩu hiện tại.";
  if (!isValidPassword(newPassword)) fieldErrors.newPassword = PASSWORD_MESSAGE;
  if (Object.keys(fieldErrors).length > 0) return accountFailure("VALIDATION_ERROR", undefined, { fieldErrors });

  if (!checkRateLimit(`change-password:${user.userId}`, CHANGE_PASSWORD_LIMIT, CHANGE_PASSWORD_WINDOW_MS)) {
    return accountFailure("RATE_LIMITED", "Bạn đã thử quá nhiều lần, vui lòng thử lại sau 15 phút.");
  }

  const prisma = getPrismaClient();
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { email: true, passwordHash: true } });
  if (!(await verifyPassword(dbUser.passwordHash, currentPassword))) {
    return accountFailure("WRONG_PASSWORD", undefined, { fieldErrors: { currentPassword: "Mật khẩu hiện tại không đúng." } });
  }
  if (await verifyPassword(dbUser.passwordHash, newPassword)) {
    return accountFailure("SAME_PASSWORD", undefined, { fieldErrors: { newPassword: "Mật khẩu mới phải khác mật khẩu hiện tại." } });
  }

  const now = new Date();
  const passwordHash = await hashPassword(newPassword);
  const [, revoked] = await prisma.$transaction([
    prisma.user.update({ where: { id: user.userId }, data: { passwordHash } }),
    prisma.refreshToken.updateMany({
      where: { userId: user.userId, revokedAt: null, familyId: { not: user.familyId } },
      data: { revokedAt: now },
    }),
  ]);

  await audit.log({
    actorId: user.userId,
    scope: "CUSTOMER",
    action: "AUTH_PASSWORD_CHANGED",
    targetType: "User",
    targetId: user.userId,
    metadata: { revokedOtherSessions: revoked.count },
  });

  const env = getEnv();
  const brand = await getEffectiveBrand();
  await sendSafely(
    "password_changed",
    dbUser.email,
    renderPasswordChangedEmail({ appName: brand.name, changedAtText: formatVnDateTime(now), forgotPasswordUrl: `${env.APP_URL}/forgot-password` }),
  );

  return { ok: true, message: "Đã đổi mật khẩu. Các thiết bị khác đã được đăng xuất." };
}

// ───────────────────────── Đổi email (C4) ─────────────────────────

export type EmailChangeState = AccountActionState<{ pendingEmail: { email: string; expiresAt: Date } | null }>;

const emailSchema = z.string().trim().max(254).email();

/** Tạo token mới (xoá mọi yêu cầu đang chờ cũ — một yêu cầu mới huỷ yêu cầu cũ) + gửi link tới email mới. */
async function issueEmailChangeToken(userId: string, newEmail: string): Promise<{ expiresAt: Date; sent: boolean }> {
  const prisma = getPrismaClient();
  const env = getEnv();
  const now = new Date();
  const [settings, brand] = await Promise.all([getSystemSettings(), getEffectiveBrand()]);
  const verification = createVerificationToken(settings.emailVerifyTtlHours, now);

  await prisma.$transaction([
    prisma.verificationToken.deleteMany({ where: { userId, type: "EMAIL_CHANGE", usedAt: null } }),
    prisma.verificationToken.create({
      data: { userId, type: "EMAIL_CHANGE", tokenHash: verification.tokenHash, newEmail, expiresAt: verification.expiresAt },
    }),
  ]);

  const sent = await sendSafely(
    "email_change_verify",
    newEmail,
    renderEmailChangeVerifyEmail({
      appName: brand.name,
      confirmUrl: `${env.APP_URL}/account/email/xac-nhan?token=${verification.token}`,
      expiresInHours: settings.emailVerifyTtlHours,
    }),
  );
  return { expiresAt: verification.expiresAt, sent };
}

/**
 * C4 — yêu cầu đổi email: `newEmail` + `currentPassword`. Email mới phải khác email hiện tại và chưa thuộc tài khoản
 * khác (báo rõ — ADR-041 C.2, có rate limit). Email cũ vẫn đăng nhập tới khi xác nhận.
 */
export async function requestEmailChange(user: CurrentUser, formData: FormData): Promise<EmailChangeState> {
  const rawEmail = formString(formData, "newEmail");
  const currentPassword = formString(formData, "currentPassword");
  const values = { newEmail: rawEmail };

  const fieldErrors: Record<string, string> = {};
  const parsedEmail = emailSchema.safeParse(rawEmail);
  if (!parsedEmail.success) fieldErrors.newEmail = "Email không hợp lệ.";
  if (!currentPassword) fieldErrors.currentPassword = "Vui lòng nhập mật khẩu hiện tại.";
  if (!parsedEmail.success || Object.keys(fieldErrors).length > 0) {
    return accountFailure("VALIDATION_ERROR", undefined, { fieldErrors, values });
  }
  const newEmail = normalizeEmail(parsedEmail.data);

  const prisma = getPrismaClient();
  const dbUser = await prisma.user.findUniqueOrThrow({ where: { id: user.userId }, select: { email: true, passwordHash: true } });
  if (newEmail === dbUser.email) {
    return accountFailure("SAME_EMAIL", undefined, { fieldErrors: { newEmail: "Đây đang là email đăng nhập của bạn." }, values });
  }

  if (!checkRateLimit(`email-change:${user.userId}`, EMAIL_CHANGE_LIMIT, EMAIL_CHANGE_WINDOW_MS)) {
    return accountFailure("RATE_LIMITED", "Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau 1 giờ.", { values });
  }
  if (!(await verifyPassword(dbUser.passwordHash, currentPassword))) {
    return accountFailure("WRONG_PASSWORD", undefined, { fieldErrors: { currentPassword: "Mật khẩu hiện tại không đúng." }, values });
  }
  const taken = await prisma.user.findUnique({ where: { email: newEmail }, select: { id: true } });
  if (taken) {
    return accountFailure("EMAIL_TAKEN", undefined, { fieldErrors: { newEmail: "Email này đã được dùng cho một tài khoản khác." }, values });
  }

  const { expiresAt, sent } = await issueEmailChangeToken(user.userId, newEmail);
  if (!sent) {
    // Không để lại yêu cầu "đang chờ" mà người dùng không có link để xác nhận.
    await prisma.verificationToken.deleteMany({ where: { userId: user.userId, type: "EMAIL_CHANGE", usedAt: null } });
    return accountFailure("EMAIL_SEND_FAILED", "Không gửi được email xác minh, vui lòng thử lại sau.", { values });
  }

  const env = getEnv();
  const brand = await getEffectiveBrand();
  await sendSafely(
    "email_change_requested",
    dbUser.email,
    renderEmailChangeRequestedEmail({
      appName: brand.name,
      maskedNewEmail: maskEmail(newEmail),
      securityUrl: `${env.APP_URL}/account/security`,
      forgotPasswordUrl: `${env.APP_URL}/forgot-password`,
    }),
  );

  await audit.log({
    actorId: user.userId,
    scope: "CUSTOMER",
    action: "AUTH_EMAIL_CHANGE_REQUESTED",
    targetType: "User",
    targetId: user.userId,
    metadata: { newEmail: maskEmail(newEmail) },
  });

  return {
    ok: true,
    message: `Đã gửi link xác minh tới ${newEmail}. Mở email đó để hoàn tất đổi email.`,
    pendingEmail: { email: newEmail, expiresAt },
  };
}

/** C4 — gửi lại link cho yêu cầu đang chờ (sinh token mới, token cũ vô hiệu). Dùng chung rate limit với yêu cầu. */
export async function resendEmailChange(user: CurrentUser): Promise<EmailChangeState> {
  const pending = await findPendingEmailChange(user.userId);
  if (!pending) return accountFailure("NO_PENDING_EMAIL_CHANGE", "Không có yêu cầu đổi email nào đang chờ.");
  if (!checkRateLimit(`email-change:${user.userId}`, EMAIL_CHANGE_LIMIT, EMAIL_CHANGE_WINDOW_MS)) {
    return accountFailure("RATE_LIMITED", "Bạn đã gửi quá nhiều yêu cầu, vui lòng thử lại sau 1 giờ.");
  }
  const taken = await getPrismaClient().user.findUnique({ where: { email: pending.email }, select: { id: true } });
  if (taken) {
    await cancelPendingEmailChange(user.userId);
    return accountFailure("EMAIL_TAKEN", "Email này vừa được dùng cho một tài khoản khác — yêu cầu đã bị huỷ.");
  }
  const { expiresAt, sent } = await issueEmailChangeToken(user.userId, pending.email);
  if (!sent) return accountFailure("EMAIL_SEND_FAILED", "Không gửi được email xác minh, vui lòng thử lại sau.");
  return { ok: true, message: `Đã gửi lại link xác minh tới ${pending.email}.`, pendingEmail: { email: pending.email, expiresAt } };
}

async function cancelPendingEmailChange(userId: string): Promise<number> {
  const result = await getPrismaClient().verificationToken.deleteMany({ where: { userId, type: "EMAIL_CHANGE", usedAt: null } });
  return result.count;
}

/** C4 — huỷ yêu cầu đang chờ (xoá token — link đã gửi trở thành không hợp lệ). */
export async function cancelEmailChange(user: CurrentUser): Promise<EmailChangeState> {
  const count = await cancelPendingEmailChange(user.userId);
  if (count === 0) return accountFailure("NO_PENDING_EMAIL_CHANGE", "Không có yêu cầu đổi email nào đang chờ.");
  return { ok: true, message: "Đã huỷ yêu cầu đổi email.", pendingEmail: null };
}

// ───────────────────────── Xác nhận đổi email (C5) ─────────────────────────

export type EmailChangeTokenStatus = "valid" | "expired" | "used" | "invalid";

export interface EmailChangeTokenPreview {
  status: EmailChangeTokenStatus;
  /** Email mới (đầy đủ) — chỉ khi `valid`; người mở link là người nhận được thư ở chính địa chỉ này. */
  newEmail: string | null;
  expiresAt: Date | null;
}

/** C5 (GET, chỉ đọc) — trạng thái token cho trang `/account/email/xac-nhan`. Không ghi gì. */
export async function previewEmailChangeToken(rawToken: string | null | undefined): Promise<EmailChangeTokenPreview> {
  if (!rawToken || rawToken.length > 256) return { status: "invalid", newEmail: null, expiresAt: null };
  const record = await getPrismaClient().verificationToken.findUnique({
    where: { tokenHash: hashOpaqueToken(rawToken) },
    select: { type: true, newEmail: true, expiresAt: true, usedAt: true },
  });
  if (!record || record.type !== "EMAIL_CHANGE" || !record.newEmail) return { status: "invalid", newEmail: null, expiresAt: null };
  const status = evaluateVerificationToken(record, new Date());
  return { status, newEmail: status === "valid" ? record.newEmail : null, expiresAt: record.expiresAt };
}

export type ConfirmEmailChangeState = AccountActionState<{ email: string }>;

const CONFIRM_ERRORS: Record<Exclude<EmailChangeTokenStatus, "valid">, { code: string; message: string }> = {
  invalid: { code: "INVALID_TOKEN", message: "Liên kết không hợp lệ hoặc yêu cầu đã bị huỷ." },
  expired: { code: "TOKEN_EXPIRED", message: "Liên kết đã hết hạn. Hãy gửi lại yêu cầu từ trang Bảo mật." },
  used: { code: "TOKEN_USED", message: "Liên kết đã được sử dụng." },
};

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

/**
 * C5 (POST bằng nút) — không yêu cầu đăng nhập. Trong 1 transaction: đánh dấu token đã dùng (điều kiện `usedAt IS
 * NULL` → hai lần bấm song song chỉ một lần thắng), đổi `User.email`, `emailVerifiedAt = now`, thu hồi MỌI refresh
 * token, xoá yêu cầu đổi email khác. Email mới vừa bị tài khoản khác chiếm (unique, kể cả race) → huỷ yêu cầu,
 * `EMAIL_TAKEN`. Sau đó: audit, báo về email CŨ, xoá cookie nếu trình duyệt đang đăng nhập đúng tài khoản này.
 */
export async function confirmEmailChange(rawToken: string, clientIp: string | null, viewer: CurrentUser | null): Promise<ConfirmEmailChangeState> {
  if (!checkRateLimit(`email-change-confirm:${clientIp ?? "unknown"}`, EMAIL_CONFIRM_LIMIT, EMAIL_CONFIRM_WINDOW_MS)) {
    return accountFailure("RATE_LIMITED", "Bạn thao tác quá nhanh, vui lòng thử lại sau.");
  }
  if (!rawToken || rawToken.length > 256) return accountFailure(CONFIRM_ERRORS.invalid.code, CONFIRM_ERRORS.invalid.message);

  const prisma = getPrismaClient();
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hashOpaqueToken(rawToken) } });
  if (!record || record.type !== "EMAIL_CHANGE" || !record.newEmail) {
    return accountFailure(CONFIRM_ERRORS.invalid.code, CONFIRM_ERRORS.invalid.message);
  }
  const now = new Date();
  const status = evaluateVerificationToken(record, now);
  if (status !== "valid") return accountFailure(CONFIRM_ERRORS[status].code, CONFIRM_ERRORS[status].message);

  const owner = await prisma.user.findUnique({ where: { id: record.userId }, select: { email: true, status: true } });
  if (!owner || owner.status === "LOCKED") {
    return accountFailure("ACCOUNT_LOCKED", "Tài khoản đang bị khoá, không thể đổi email. Vui lòng liên hệ hỗ trợ.");
  }
  const oldEmail = owner.email;
  const newEmail = record.newEmail;

  try {
    await prisma.$transaction(async (tx) => {
      const claimed = await tx.verificationToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
      if (claimed.count !== 1) throw new TokenAlreadyClaimed();
      await tx.user.update({ where: { id: record.userId }, data: { email: newEmail, emailVerifiedAt: now } });
      await tx.refreshToken.updateMany({ where: { userId: record.userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.verificationToken.deleteMany({ where: { userId: record.userId, type: "EMAIL_CHANGE", usedAt: null } });
      // Link đặt lại mật khẩu / kích hoạt đã gửi về email CŨ không còn dùng được sau khi đổi email (bảo mật chặt, ADR-041).
      await tx.verificationToken.updateMany({
        where: { userId: record.userId, type: { in: ["PASSWORD_RESET", "EMAIL_VERIFY"] }, usedAt: null },
        data: { usedAt: now },
      });
    });
  } catch (error) {
    if (error instanceof TokenAlreadyClaimed) return accountFailure(CONFIRM_ERRORS.used.code, CONFIRM_ERRORS.used.message);
    if (isUniqueViolation(error)) {
      await prisma.verificationToken.deleteMany({ where: { userId: record.userId, type: "EMAIL_CHANGE", usedAt: null } });
      return accountFailure("EMAIL_TAKEN", "Email này vừa được dùng cho một tài khoản khác — yêu cầu đổi email đã bị huỷ.");
    }
    throw error;
  }

  await audit.log({
    actorId: record.userId,
    scope: "CUSTOMER",
    action: "AUTH_EMAIL_CHANGED",
    targetType: "User",
    targetId: record.userId,
    metadata: { from: maskEmail(oldEmail), to: maskEmail(newEmail) },
  });

  const [brand, supportEmail] = await Promise.all([getEffectiveBrand(), loadSupportEmail()]);
  await sendSafely(
    "email_changed",
    oldEmail,
    renderEmailChangedEmail({ appName: brand.name, maskedNewEmail: maskEmail(newEmail), changedAtText: formatVnDateTime(now), supportEmail }),
  );

  if (viewer?.userId === record.userId) {
    const store = await cookies();
    store.delete(ACCESS_COOKIE_NAME);
    store.delete({ name: REFRESH_COOKIE_NAME, path: "/api/auth" });
  }

  return { ok: true, message: `Email đăng nhập đã đổi thành ${newEmail}. Vui lòng đăng nhập lại bằng email mới.`, email: newEmail };
}

class TokenAlreadyClaimed extends Error {
  constructor() {
    super("email-change token already claimed");
    this.name = "TokenAlreadyClaimed";
  }
}
