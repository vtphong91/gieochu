import { z } from "zod";
import {
  createVerificationToken,
  describeUserAgent,
  evaluateVerificationToken,
  generateOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  isProfileComplete,
  isValidPassword,
  issueRefreshToken,
  normalizeEmail,
  refreshCookieMaxAgeSeconds,
  sessionExpiresAt,
} from "@gieochu/auth";
import { LEGAL_DOCUMENT_DEFS, logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma, withTenant, type Tx } from "@gieochu/db";
import { renderGuestActivationEmail } from "@gieochu/email";
import type { PaymentProviderId } from "@gieochu/payments";
import { getGuestSessionPolicy } from "./jwt-context";
import { signSessionAccessToken } from "./session-access";
import type { AuthCookiePayload } from "./cookies";
import { getAcceptanceLegalVersion, recordLegalAcceptances } from "./legal";
import { consumeRateLimit, rateLimitKey } from "./rate-limit-store";
import { getEnabledProviders } from "./tenant-payment";
import { createOrder, initiateOrderCheckout } from "./order";
import { sendEmailNow, type ScheduleAfterResponse } from "./email-dispatch";
import { getEffectiveBrand } from "./branding";
import { audit } from "./audit";

/**
 * ADR-061 Q1 + ADR-062 Q2/Q11 + Bổ sung ADR-062 mục 1–8 — mua không cần đăng ký trước.
 *
 * - Khách điền Họ tên + Email + 1 ô đồng ý (Điều khoản + Chính sách bảo mật) → tạo user PENDING, `hasPassword = false`
 *   (passwordHash = hash chuỗi ngẫu nhiên không ai biết), ghi `UserLegalAcceptance` bản hiệu lực, token `GUEST_ACTIVATION` 7 ngày
 *   (chỉ lưu hash), phiên `guestCheckout` (absolute ≤ 24 giờ), tạo đơn + checkout. Email "Kích hoạt tài khoản và đặt mật khẩu"
 *   gửi sau response. KHÔNG gửi mật khẩu.
 * - Email đã có tài khoản → không gắn đơn, không tạo phiên: guest chưa kích hoạt → mã `EMAIL_EXISTS_GUEST` (câu chốt ở Bổ sung
 *   ADR-062 mục 4); tài khoản thường → `EMAIL_EXISTS` (yêu cầu đăng nhập).
 * - Rate limit trên DB (khoá HMAC): 5 lần/IP/giờ, 3 lần/email/ngày; gửi lại email kích hoạt 3 lần/email/giờ.
 */

export const GUEST_ACTIVATION_TTL_DAYS = 7;
const GUEST_SIGNUP_IP_LIMIT = 5;
const GUEST_SIGNUP_IP_WINDOW_MS = 60 * 60 * 1000;
const GUEST_SIGNUP_EMAIL_LIMIT = 3;
const GUEST_SIGNUP_EMAIL_WINDOW_MS = 24 * 60 * 60 * 1000;
export const GUEST_ACTIVATION_RESEND_LIMIT = 3;
export const GUEST_ACTIVATION_RESEND_WINDOW_MS = 60 * 60 * 1000;

const VALID_PROVIDERS = ["MANUAL_QR", "SEPAY", "MOMO", "MOMO_MANUAL"] as const satisfies readonly PaymentProviderId[];

const guestCheckoutSchema = z.object({
  fullName: z.string().trim().min(1, "Vui lòng nhập họ tên.").max(100, "Họ tên tối đa 100 ký tự."),
  email: z.string().trim().email("Email không hợp lệ.").max(254),
  acceptTerms: z.literal(true, { error: "Bạn cần xác nhận thông tin và đồng ý Điều khoản, Chính sách bảo mật." }),
  provider: z.enum(VALID_PROVIDERS, { error: "Vui lòng chọn cách thanh toán." }).optional(),
});

export type GuestCheckoutFieldErrors = Partial<Record<"fullName" | "email" | "acceptTerms" | "provider", string>>;

export type GuestCheckoutResult =
  | { ok: true; orderCode: string; userId: string; cookies: AuthCookiePayload }
  | { ok: false; error: string; code?: "EMAIL_EXISTS" | "EMAIL_EXISTS_GUEST" | "RATE_LIMITED" | "PRODUCT_UNAVAILABLE" | "VALIDATION"; fieldErrors?: GuestCheckoutFieldErrors };

export interface GuestCheckoutInput {
  tenantSlug: string;
  productSlug: string;
  fullName: unknown;
  email: unknown;
  acceptTerms: unknown;
  provider: unknown;
  ip: string | null;
  userAgent: string | null;
  /** Server Action truyền `after` — email kích hoạt + email đơn gửi sau response. Bỏ trống → không gửi (test). */
  scheduleNotification?: ScheduleAfterResponse;
}

export const EMAIL_EXISTS_GUEST_MESSAGE = "Email này đã được dùng — đăng nhập hoặc gửi lại email kích hoạt.";
const EMAIL_EXISTS_MESSAGE = "Email này đã có tài khoản — vui lòng đăng nhập để mua.";
const PRODUCT_UNAVAILABLE_MESSAGE = "Tài liệu hiện không còn bán.";

function appUrl(): string {
  return getEnv().APP_URL.replace(/\/+$/, "");
}

/** Huỷ mọi token GUEST_ACTIVATION còn dùng được của user rồi phát token mới (Bổ sung ADR-062 mục 5). Trả token thô. */
async function issueGuestActivationToken(tx: Tx | ReturnType<typeof getPrismaClient>, userId: string, now: Date): Promise<string> {
  await tx.verificationToken.updateMany({ where: { userId, type: "GUEST_ACTIVATION", usedAt: null }, data: { usedAt: now } });
  const token = createVerificationToken(GUEST_ACTIVATION_TTL_DAYS * 24, now);
  await tx.verificationToken.create({ data: { userId, type: "GUEST_ACTIVATION", tokenHash: token.tokenHash, expiresAt: token.expiresAt } });
  return token.token;
}

export function guestActivationUrl(rawToken: string): string {
  return `${appUrl()}/verify-email/dat-mat-khau?token=${encodeURIComponent(rawToken)}`;
}

async function sendGuestActivationEmail(email: string, rawToken: string, orderCode: string | null): Promise<void> {
  try {
    const brand = await getEffectiveBrand();
    const rendered = renderGuestActivationEmail({
      appName: brand.name,
      activateUrl: guestActivationUrl(rawToken),
      expiresInDays: GUEST_ACTIVATION_TTL_DAYS,
      orderCode,
    });
    const result = await sendEmailNow({ type: "guest_activation", to: email, ...rendered });
    if (!result.ok) logger.warn({ error: result.error }, "guest: gửi email kích hoạt thất bại");
  } catch (error) {
    logger.warn({ err: error }, "guest: lỗi khi gửi email kích hoạt");
  }
}

/** Lỗi theo ô của zod → câu tiếng Việt cho UI (lỗi đặt dưới từng ô — contract §6.2). */
function fieldErrorsOf(error: z.ZodError): GuestCheckoutFieldErrors {
  const out: GuestCheckoutFieldErrors = {};
  for (const issue of error.issues) {
    const key = issue.path[0] as keyof GuestCheckoutFieldErrors | undefined;
    if (key && !out[key]) out[key] = issue.message;
  }
  return out;
}

export async function startGuestCheckout(input: GuestCheckoutInput): Promise<GuestCheckoutResult> {
  const parsed = guestCheckoutSchema.safeParse({
    fullName: input.fullName,
    email: input.email,
    acceptTerms: input.acceptTerms === true || input.acceptTerms === "on",
    provider: typeof input.provider === "string" && input.provider ? input.provider : undefined,
  });
  if (!parsed.success) return { ok: false, code: "VALIDATION", error: "Vui lòng kiểm tra lại thông tin.", fieldErrors: fieldErrorsOf(parsed.error) };
  const email = normalizeEmail(parsed.data.email);
  const prisma = getPrismaClient();

  // Tài liệu + gian hàng còn bán (kiểm trước khi tạo tài khoản — không để lại user/phiên rác vì tài liệu đã gỡ).
  const tenant = await prisma.tenant.findUnique({ where: { slug: input.tenantSlug }, select: { id: true, slug: true, status: true } });
  if (!tenant || tenant.status !== "ACTIVE") return { ok: false, code: "PRODUCT_UNAVAILABLE", error: PRODUCT_UNAVAILABLE_MESSAGE };
  const product = await withTenant(tenant.id, (tx) =>
    tx.product.findFirst({ where: { tenantId: tenant.id, slug: input.productSlug, status: "PUBLISHED" }, select: { id: true, priceVnd: true } }),
  );
  if (!product) return { ok: false, code: "PRODUCT_UNAVAILABLE", error: PRODUCT_UNAVAILABLE_MESSAGE };
  const provider = parsed.data.provider ?? null;
  if (product.priceVnd > 0) {
    const enabled = await getEnabledProviders(tenant.id);
    if (!provider || !enabled.includes(provider)) {
      return { ok: false, code: "VALIDATION", error: "Vui lòng chọn cách thanh toán.", fieldErrors: { provider: "Vui lòng chọn cách thanh toán." } };
    }
  }

  const rateLimited = { ok: false as const, code: "RATE_LIMITED" as const, error: "Bạn thao tác quá nhanh, vui lòng thử lại sau." };
  if (!(await consumeRateLimit(rateLimitKey("guest_signup_ip", input.ip ?? "unknown"), GUEST_SIGNUP_IP_LIMIT, GUEST_SIGNUP_IP_WINDOW_MS))) return rateLimited;
  if (!(await consumeRateLimit(rateLimitKey("guest_signup_email", email), GUEST_SIGNUP_EMAIL_LIMIT, GUEST_SIGNUP_EMAIL_WINDOW_MS))) return rateLimited;

  const existing = await prisma.user.findUnique({ where: { email }, select: { status: true, hasPassword: true } });
  if (existing) {
    return existing.status === "PENDING" && !existing.hasPassword
      ? { ok: false, code: "EMAIL_EXISTS_GUEST", error: EMAIL_EXISTS_GUEST_MESSAGE, fieldErrors: { email: EMAIL_EXISTS_GUEST_MESSAGE } }
      : { ok: false, code: "EMAIL_EXISTS", error: EMAIL_EXISTS_MESSAGE, fieldErrors: { email: EMAIL_EXISTS_MESSAGE } };
  }

  const now = new Date();
  // Bổ sung ADR-062 mục 8: ô đồng ý duy nhất ghi nhận Điều khoản + Chính sách bảo mật bản đang hiệu lực (bản nào có).
  const [terms, privacy] = await Promise.all([
    getAcceptanceLegalVersion(LEGAL_DOCUMENT_DEFS.terms.key, now),
    getAcceptanceLegalVersion(LEGAL_DOCUMENT_DEFS.privacy.key, now),
  ]);
  const acceptedVersionIds = [terms?.versionId, privacy?.versionId].filter((id): id is string => Boolean(id));
  const unusablePasswordHash = await hashPassword(generateOpaqueToken());
  const policy = await getGuestSessionPolicy();
  const familyId = crypto.randomUUID();
  const refresh = issueRefreshToken(familyId, sessionExpiresAt(now, policy));
  const userAgent = input.userAgent ?? undefined;

  let created: { userId: string; activationToken: string; profileComplete: boolean };
  try {
    created = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email,
          passwordHash: unusablePasswordHash,
          hasPassword: false,
          status: "PENDING",
          profile: { create: { fullName: parsed.data.fullName, consentAt: now } },
        },
        include: { profile: true },
      });
      await recordLegalAcceptances(tx, user.id, acceptedVersionIds, now);
      const activationToken = await issueGuestActivationToken(tx, user.id, now);
      await tx.refreshToken.create({
        data: {
          userId: user.id,
          familyId,
          tokenHash: refresh.tokenHash,
          expiresAt: refresh.expiresAt,
          userAgent,
          ip: input.ip ?? undefined,
          rememberMe: false,
          sessionStartedAt: now,
          deviceLabel: describeUserAgent(userAgent),
          guestCheckout: true,
        },
      });
      return { userId: user.id, activationToken, profileComplete: isProfileComplete(user.profile) };
    });
  } catch (error) {
    // Hai lần gửi đồng thời cùng email: lần thua gặp unique `email`.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { ok: false, code: "EMAIL_EXISTS_GUEST", error: EMAIL_EXISTS_GUEST_MESSAGE, fieldErrors: { email: EMAIL_EXISTS_GUEST_MESSAGE } };
    }
    throw error;
  }

  await audit.log({
    actorId: created.userId,
    scope: "SYSTEM",
    action: "AUTH_GUEST_ACCOUNT_CREATED",
    targetType: "User",
    targetId: created.userId,
    metadata: { tenantId: tenant.id, legalVersions: acceptedVersionIds.length },
    ip: input.ip,
    userAgent: input.userAgent,
  });

  const { accessToken, accessTtlSeconds } = await signSessionAccessToken(
    { userId: created.userId, familyId, role: "USER", emailVerified: false, profileCompleted: created.profileComplete, guestCheckout: true },
    policy,
  );
  const cookies: AuthCookiePayload = {
    accessToken,
    accessTtlSeconds,
    refreshToken: refresh.token,
    refreshMaxAgeSeconds: refreshCookieMaxAgeSeconds(policy, refresh.expiresAt, now),
  };

  let orderCode: string | null = null;
  try {
    const order = await createOrder(created.userId, tenant.slug, product.id);
    orderCode = order.code;
    if (order.totalVnd > 0 && provider) {
      await initiateOrderCheckout(tenant.id, order.id, created.userId, provider, { scheduleNotification: input.scheduleNotification });
    }
  } catch (error) {
    logger.warn({ err: error, tenantId: tenant.id }, "guest: tạo đơn/checkout thất bại sau khi tạo tài khoản");
  }
  const activationToken = created.activationToken;
  input.scheduleNotification?.(() => sendGuestActivationEmail(email, activationToken, orderCode));
  if (!orderCode) return { ok: false, code: "PRODUCT_UNAVAILABLE", error: "Không tạo được đơn — vui lòng thử lại từ trang tài liệu." };
  return { ok: true, orderCode, userId: created.userId, cookies };
}

/**
 * Gửi lại email kích hoạt cho tài khoản guest chưa kích hoạt (Bổ sung ADR-062 mục 5, 7): huỷ token cũ, phát token mới, 3 lần/
 * email/giờ (DB). Người gọi trả CÙNG một câu dù email có tồn tại hay không (chống dò). Trả `false` khi bị giới hạn.
 */
export async function resendGuestActivation(userId: string, email: string): Promise<boolean> {
  if (!(await consumeRateLimit(rateLimitKey("guest_activation_resend", email), GUEST_ACTIVATION_RESEND_LIMIT, GUEST_ACTIVATION_RESEND_WINDOW_MS))) {
    return false;
  }
  const prisma = getPrismaClient();
  const rawToken = await prisma.$transaction((tx) => issueGuestActivationToken(tx, userId, new Date()));
  await sendGuestActivationEmail(email, rawToken, null);
  return true;
}

export type GuestActivationResult = { ok: true; email: string } | { ok: false; error: string; code: "INVALID_TOKEN" | "TOKEN_ALREADY_USED" | "TOKEN_EXPIRED" | "WEAK_PASSWORD" | "PASSWORD_MISMATCH" };

/**
 * Trang "Kích hoạt tài khoản và đặt mật khẩu": token GUEST_ACTIVATION (một lần) → đặt mật khẩu + xác minh email + ACTIVE +
 * `hasPassword = true`; huỷ các token kích hoạt khác của user. Mật khẩu chỉ lưu hash.
 */
export async function activateGuestAccount(rawToken: unknown, password: unknown, confirmPassword: unknown): Promise<GuestActivationResult> {
  if (typeof rawToken !== "string" || !rawToken) return { ok: false, code: "INVALID_TOKEN", error: "Liên kết kích hoạt không hợp lệ." };
  if (typeof password !== "string" || !isValidPassword(password)) {
    return { ok: false, code: "WEAK_PASSWORD", error: "Mật khẩu phải có ít nhất 8 ký tự, gồm cả chữ và số." };
  }
  if (password !== confirmPassword) return { ok: false, code: "PASSWORD_MISMATCH", error: "Mật khẩu nhập lại không khớp." };

  const prisma = getPrismaClient();
  const record = await prisma.verificationToken.findUnique({ where: { tokenHash: hashOpaqueToken(rawToken) } });
  if (!record || record.type !== "GUEST_ACTIVATION") return { ok: false, code: "INVALID_TOKEN", error: "Liên kết kích hoạt không hợp lệ." };
  const now = new Date();
  const status = evaluateVerificationToken(record, now);
  if (status === "used") return { ok: false, code: "TOKEN_ALREADY_USED", error: "Liên kết đã được sử dụng. Bạn có thể đăng nhập hoặc gửi lại email kích hoạt." };
  if (status === "expired") return { ok: false, code: "TOKEN_EXPIRED", error: "Liên kết đã hết hạn. Vui lòng gửi lại email kích hoạt." };

  const passwordHash = await hashPassword(password);
  const email = await prisma.$transaction(async (tx) => {
    // Nhận token nguyên tử — hai lần bấm song song chỉ một lần đặt được mật khẩu.
    const claimed = await tx.verificationToken.updateMany({ where: { id: record.id, usedAt: null }, data: { usedAt: now } });
    if (claimed.count !== 1) return null;
    await tx.verificationToken.updateMany({ where: { userId: record.userId, type: "GUEST_ACTIVATION", usedAt: null }, data: { usedAt: now } });
    // Tài khoản bị khoá (LOCKED) không bao giờ được mở lại bằng liên kết kích hoạt.
    const updated = await tx.user.updateMany({
      where: { id: record.userId, status: { in: ["PENDING", "ACTIVE"] } },
      data: { passwordHash, hasPassword: true, status: "ACTIVE", emailVerifiedAt: now, failedLoginAttempts: 0, passwordResetRequired: false },
    });
    if (updated.count !== 1) return null;
    const user = await tx.user.findUniqueOrThrow({ where: { id: record.userId }, select: { email: true } });
    return user.email;
  });
  if (!email) return { ok: false, code: "TOKEN_ALREADY_USED", error: "Liên kết đã được sử dụng. Bạn có thể đăng nhập hoặc gửi lại email kích hoạt." };
  await audit.log({ actorId: record.userId, scope: "SYSTEM", action: "AUTH_GUEST_ACTIVATED", targetType: "User", targetId: record.userId });
  return { ok: true, email };
}
