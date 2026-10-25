import { randomBytes } from "node:crypto";
import { cache } from "react";
import { isProfileComplete } from "@gieochu/auth";
import {
  isVnProvince,
  normalizeVnPhone,
  PROFILE_FIELD_MESSAGES,
  PROFILE_FULL_NAME_MAX_LENGTH,
} from "@gieochu/core/account-profile";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { AppError, describePlanLimit, formatPlanLimit, logger, rateLimited, type PlanLimitDisplay, type PlanLimitField } from "@gieochu/core";
import { getPrismaClient, withCustomer, withTenant, type SubscriptionStatus } from "@gieochu/db";
import { cookies } from "next/headers";
import { tenantLogoUrl } from "./home";
import { getPublicBucketBaseUrl } from "./product-cover";
import { checkRateLimit } from "./rate-limit";
import { issueAccessCookieForSession } from "./session-access";
import { getCurrentUser, type CurrentUser } from "./session";
import {
  createCloudinaryUploadSignature,
  fetchCloudinaryImageResource,
  getSystemCloudinaryLocation,
  isSystemCloudinaryUploadEnabled,
  type CloudinaryUploadSignature,
  type SystemCloudinaryLocation,
} from "./system-cloudinary";
import { accountFailure, formString, type AccountActionState } from "./account-state";

/**
 * ADR-041 mục C (Hồ sơ `/account`) — dữ liệu hồ sơ cá nhân (L1: `users`, `user_profiles`) + ảnh đại diện.
 * SĐT/Tỉnh là dữ liệu cá nhân tuỳ chọn: chỉ trả về cho CHÍNH user (loader dưới đây chỉ đọc theo `userId` của phiên).
 */

// ───────────────────────── Ảnh đại diện ─────────────────────────

/** ADR-041 C.3: png/jpeg/webp (không SVG/GIF). */
export const AVATAR_FORMATS = ["png", "jpg", "jpeg", "webp"] as const;
/** ≤ 2MB — client kiểm trước khi upload; server kiểm lại bằng số Cloudinary trả về sau upload. */
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
/** Incoming transformation: thu cạnh dài về ≤1024px trước khi Cloudinary lưu bản gốc. */
export const AVATAR_INCOMING_TRANSFORMATION = "c_limit,w_1024,h_1024";
/** Chống lạm dụng chữ ký (không tính hạn mức gói): 10 chữ ký / giờ / user. */
const AVATAR_SIGNATURE_RATE_LIMIT = 10;
const AVATAR_SIGNATURE_WINDOW_MS = 60 * 60 * 1000;
const AVATAR_ASSET_NAME = /^[a-f0-9]{24}$/;

/** Folder tương đối với `uploadFolder` hệ thống. */
function avatarFolder(userId: string): string {
  return `users/${userId}/avatar`;
}

/**
 * URL hiển thị ảnh đại diện từ `avatarKey` (= public id đầy đủ, kể cả thư mục gốc): cắt vuông theo mặt + tối ưu
 * `f_auto,q_auto`. `sizePx` là cạnh hiển thị lớn nhất cần (nên truyền 2x cho màn hình retina).
 */
export function avatarUrlFromKey(avatarKey: string | null | undefined, location: SystemCloudinaryLocation | null, sizePx = 192): string | null {
  if (!avatarKey || !location) return null;
  const size = Math.max(16, Math.min(512, Math.round(sizePx)));
  const base = `https://res.cloudinary.com/${location.cloudName}/image/upload/c_fill,g_face,w_${size},h_${size}/${avatarKey}`;
  return cloudinaryDeliveryUrl(base, { width: size });
}

/**
 * C6 — chữ ký upload ảnh đại diện cho user đã đăng nhập (đã xác minh email — caller dùng `requireVerified()`).
 * `public_id` do server sinh (`<root>/users/<userId>/avatar/<24 hex>`), một chữ ký chỉ tạo đúng 1 asset.
 */
export async function createAvatarUploadSignature(userId: string): Promise<CloudinaryUploadSignature> {
  if (!checkRateLimit(`avatar-signature:${userId}`, AVATAR_SIGNATURE_RATE_LIMIT, AVATAR_SIGNATURE_WINDOW_MS)) {
    throw rateLimited("Bạn đã tải ảnh quá nhiều lần, vui lòng thử lại sau ít phút.");
  }
  const name = randomBytes(12).toString("hex");
  return createCloudinaryUploadSignature({
    publicId: `${avatarFolder(userId)}/${name}`,
    allowedFormats: AVATAR_FORMATS,
    transformation: AVATAR_INCOMING_TRANSFORMATION,
  });
}

export type SaveAvatarState = AccountActionState<{ avatarUrl: string | null }>;

/**
 * C6 — ghi nhận ảnh vừa upload: `publicId` phải thuộc đúng `<root>/users/<userId>/avatar/<24 hex>`; xác minh asset
 * thật qua Cloudinary Admin API (định dạng + dung lượng). Admin API lỗi tạm thời → vẫn lưu (cùng cách ADR-028 với ảnh
 * tenant) vì incoming transformation đã giới hạn kích thước và `allowed_formats` đã nằm trong chữ ký.
 *
 * Ảnh cũ KHÔNG bị xoá trên Cloudinary (chưa có helper Admin API xoá asset — nợ kỹ thuật, xem báo cáo GĐ1).
 */
export async function saveAvatar(userId: string, publicId: unknown): Promise<SaveAvatarState> {
  const location = await getSystemCloudinaryLocation();
  if (!location) {
    return accountFailure("CLOUDINARY_NOT_CONFIGURED", "Tính năng ảnh đại diện tạm chưa dùng được.");
  }
  const prefix = `${location.uploadRoot}/${avatarFolder(userId)}/`;
  if (typeof publicId !== "string" || !publicId.startsWith(prefix) || !AVATAR_ASSET_NAME.test(publicId.slice(prefix.length))) {
    return accountFailure("INVALID_IMAGE_PUBLIC_ID", "Ảnh không hợp lệ, vui lòng tải lại.");
  }

  const lookup = await fetchCloudinaryImageResource(publicId);
  if (lookup.kind === "not_found") {
    return accountFailure("IMAGE_NOT_FOUND", "Không tìm thấy ảnh vừa tải lên — vui lòng tải lại.");
  }
  if (lookup.kind === "found") {
    const format = lookup.resource.format?.toLowerCase() ?? null;
    if (format && !(AVATAR_FORMATS as readonly string[]).includes(format)) {
      return accountFailure("INVALID_IMAGE_FORMAT", "Chỉ nhận ảnh PNG, JPEG hoặc WebP.");
    }
    if (lookup.resource.bytes > AVATAR_MAX_BYTES) {
      return accountFailure("IMAGE_TOO_LARGE", "Ảnh vượt quá 2 MB.");
    }
  } else {
    logger.warn({ userId, reason: lookup.reason }, "account: lưu ảnh đại diện khi chưa xác minh được (Cloudinary Admin API lỗi)");
  }

  await getPrismaClient().userProfile.update({ where: { userId }, data: { avatarKey: publicId } });
  return { ok: true, message: "Đã cập nhật ảnh đại diện.", avatarUrl: avatarUrlFromKey(publicId, location) };
}

export async function removeAvatar(userId: string): Promise<AccountActionState> {
  await getPrismaClient().userProfile.update({ where: { userId }, data: { avatarKey: null } });
  return { ok: true, message: "Đã gỡ ảnh đại diện." };
}

// ───────────────────────── Dữ liệu header (C7) ─────────────────────────

export interface AccountHeaderData {
  email: string;
  fullName: string | null;
  /** 96px (đủ cho avatar 32–48px ở 2x). */
  avatarUrl: string | null;
}

/** C7 — dữ liệu tối thiểu cho SiteHeader / header Studio của CHÍNH user đang đăng nhập. `cache()` theo request. */
export const getAccountHeaderData = cache(async function getAccountHeaderData(userId: string): Promise<AccountHeaderData | null> {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    select: { email: true, profile: { select: { fullName: true, avatarKey: true } } },
  });
  if (!user) return null;
  const location = user.profile?.avatarKey ? await getSystemCloudinaryLocation() : null;
  return {
    email: user.email,
    fullName: user.profile?.fullName?.trim() || null,
    avatarUrl: avatarUrlFromKey(user.profile?.avatarKey, location, 96),
  };
});

// ───────────────────────── Tổng quan (C1) ─────────────────────────

export interface OwnedTenantOverview {
  name: string;
  slug: string;
  logoUrl: string | null;
  plan: { id: string; name: string; isFree: boolean };
  /** Enum đủ 6 giá trị; thực tế sau ADR-021 chỉ còn ACTIVE / GRACE / CANCELED / EXPIRED (TRIALING chỉ ở dữ liệu cũ, PAST_DUE không bao giờ gán). */
  subscriptionStatus: SubscriptionStatus;
  currentPeriodEnd: Date | null;
  graceEndsAt: Date | null;
  /**
   * ADR-041 A.4: `limit` là số thô từ `Plan` (`-1` = không giới hạn, `0` = không được phép). UI dựa vào `display.kind`
   * (`UNLIMITED` | `NONE` | `LIMITED`) — chỉ vẽ thanh % khi `LIMITED`; `label` là chuỗi hạn mức đã định dạng.
   */
  usage: { products: PlanUsage; storageMb: PlanUsage };
}

export interface PlanUsage {
  used: number;
  limit: number;
  display: PlanLimitDisplay;
  /** `formatPlanLimit`: "50 tài liệu" | "500 MB" | "5 GB" | "Không giới hạn" | "Không có". */
  label: string;
}

function planUsage(field: PlanLimitField, used: number, limit: number): PlanUsage {
  return { used, limit, display: describePlanLimit(limit), label: formatPlanLimit(field, limit) };
}

export interface AccountOverview {
  email: string;
  emailVerifiedAt: Date | null;
  fullName: string;
  phone: string | null;
  province: string | null;
  avatarUrl: string | null;
  /** Cloudinary hệ thống đã cấu hình + đang bật → cho tải ảnh đại diện; false → UI ẩn nút tải, hiện ghi chú. */
  avatarUploadEnabled: boolean;
  /** Yêu cầu đổi email đang chờ xác minh (chưa hết hạn), hoặc null. */
  pendingEmail: { email: string; expiresAt: Date } | null;
  ownedTenant: OwnedTenantOverview | null;
  libraryCount: number;
  /** Đơn PENDING còn hạn thanh toán của chính user. */
  pendingOrderCount: number;
}

/**
 * C1 — loader `/account` + `/account/profile`. Caller đã `requireVerifiedAccess()` và truyền `user` của phiên (không
 * nhận id từ client). `ownedTenant` chỉ đọc bảng L1 (`tenants`, `subscriptions`, `plans`) + đếm tài liệu của chính gian
 * hàng user sở hữu (qua `withTenant`) — không đọc đơn/khách của gian hàng. `libraryCount`/`pendingOrderCount` qua
 * `withCustomer` (L3 của chính user).
 */
export async function getAccountOverview(user: CurrentUser): Promise<AccountOverview> {
  const prisma = getPrismaClient();
  const now = new Date();
  const [dbUser, tenant, pending, libraryCount, pendingOrderCount] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.userId },
      select: {
        email: true,
        emailVerifiedAt: true,
        profile: { select: { fullName: true, phone: true, province: true, avatarKey: true } },
      },
    }),
    prisma.tenant.findUnique({
      where: { ownerId: user.userId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoKey: true,
        storageUsedBytes: true,
        subscription: { select: { status: true, currentPeriodEnd: true, graceEndsAt: true, plan: true } },
      },
    }),
    findPendingEmailChange(user.userId, now),
    withCustomer(user.userId, (tx) => tx.entitlement.count({ where: { userId: user.userId } })),
    withCustomer(user.userId, (tx) =>
      tx.order.count({ where: { customerId: user.userId, status: "PENDING", expiresAt: { gt: now } } }),
    ),
  ]);

  const [location, avatarUploadEnabled, publicBaseUrl, publishedCount] = await Promise.all([
    dbUser.profile?.avatarKey ? getSystemCloudinaryLocation() : Promise.resolve(null),
    isSystemCloudinaryUploadEnabled(),
    tenant?.logoKey ? getPublicBucketBaseUrl() : Promise.resolve(null),
    tenant ? withTenant(tenant.id, (tx) => tx.product.count({ where: { tenantId: tenant.id, status: "PUBLISHED" } })) : Promise.resolve(0),
  ]);

  let ownedTenant: OwnedTenantOverview | null = null;
  // Bất biến: tenant + subscription tạo cùng transaction (`create-tenant.ts`), subscription chỉ xoá theo cascade tenant;
  // `plan-limits.ts` cũng `findUniqueOrThrow`. Thiếu subscription = dữ liệu hỏng → ghi log, không bịa gói.
  if (tenant && !tenant.subscription) logger.warn({ tenantId: tenant.id }, "account: tenant không có subscription");
  if (tenant?.subscription) {
    const sub = tenant.subscription;
    ownedTenant = {
      name: tenant.name,
      slug: tenant.slug,
      logoUrl: tenantLogoUrl(tenant.logoKey, publicBaseUrl),
      plan: { id: sub.plan.id, name: sub.plan.name, isFree: sub.plan.isFree },
      subscriptionStatus: sub.status,
      // Gói Free không có hạn thực tế (ADR-021) — UI hiện "Không hết hạn".
      currentPeriodEnd: sub.plan.isFree ? null : sub.currentPeriodEnd,
      graceEndsAt: sub.graceEndsAt,
      usage: {
        products: planUsage("maxProducts", publishedCount, sub.plan.maxProducts),
        storageMb: planUsage("storageMb", Math.round((tenant.storageUsedBytes / (1024 * 1024)) * 10) / 10, sub.plan.storageMb),
      },
    };
  }

  return {
    email: dbUser.email,
    emailVerifiedAt: dbUser.emailVerifiedAt,
    fullName: dbUser.profile?.fullName ?? "",
    phone: dbUser.profile?.phone ?? null,
    province: dbUser.profile?.province ?? null,
    avatarUrl: avatarUrlFromKey(dbUser.profile?.avatarKey, location),
    avatarUploadEnabled,
    pendingEmail: pending,
    ownedTenant,
    libraryCount,
    pendingOrderCount,
  };
}

/**
 * `getAccountOverview()` của user ĐANG ĐĂNG NHẬP, ghi nhớ theo request (`cache()` không tham số) — layout `/account`
 * (nhóm "Gian hàng của bạn", số đơn chờ ở sidebar) và trang Tổng quan / Hồ sơ dùng chung một lần truy vấn. Chưa đăng
 * nhập / chưa xác minh email → `null` (trang tự `requireVerifiedAccess()` để redirect; layout coi như không có dữ liệu).
 */
export const getCachedAccountOverview = cache(async function getCachedAccountOverview(): Promise<AccountOverview | null> {
  const user = await getCurrentUser();
  if (!user || !user.emailVerified) return null;
  return getAccountOverview(user);
});

/** Yêu cầu đổi email mới nhất còn hiệu lực của user (L1 `verification_tokens`). */
export async function findPendingEmailChange(userId: string, now = new Date()): Promise<{ email: string; expiresAt: Date } | null> {
  const row = await getPrismaClient().verificationToken.findFirst({
    where: { userId, type: "EMAIL_CHANGE", usedAt: null, expiresAt: { gt: now }, newEmail: { not: null } },
    orderBy: { createdAt: "desc" },
    select: { newEmail: true, expiresAt: true },
  });
  return row?.newEmail ? { email: row.newEmail, expiresAt: row.expiresAt } : null;
}

// ───────────────────────── Cập nhật hồ sơ (C2) ─────────────────────────

export type UpdateProfileState = AccountActionState;

/**
 * C2 — họ tên bắt buộc (1–80), SĐT/Tỉnh tuỳ chọn (chuỗi rỗng = xoá). SĐT chuẩn hoá về `0XXXXXXXXX`; Tỉnh phải thuộc
 * `VN_PROVINCES` — ngoại lệ: giữ nguyên giá trị cũ đã lưu (dữ liệu nhập tự do trước ADR-041) để user không bị chặn lưu
 * khi chỉ sửa ô khác. Ký lại access token để claim `pc` phản ánh ngay.
 */
export async function updateProfile(user: CurrentUser, formData: FormData): Promise<UpdateProfileState> {
  const values = {
    fullName: formString(formData, "fullName"),
    phone: formString(formData, "phone"),
    province: formString(formData, "province"),
  };
  const fullName = values.fullName.trim().replace(/\s+/g, " ");
  const phoneRaw = values.phone.trim();
  const provinceRaw = values.province.trim();

  const prisma = getPrismaClient();
  const current = await prisma.userProfile.findUnique({ where: { userId: user.userId }, select: { province: true } });
  if (!current) throw new AppError({ code: "PROFILE_NOT_FOUND", message: "Không tìm thấy hồ sơ.", httpStatus: 404 });

  const fieldErrors: Record<string, string> = {};
  if (!fullName) fieldErrors.fullName = PROFILE_FIELD_MESSAGES.fullNameRequired;
  else if (fullName.length > PROFILE_FULL_NAME_MAX_LENGTH) fieldErrors.fullName = PROFILE_FIELD_MESSAGES.fullNameTooLong;

  const phone = phoneRaw ? normalizeVnPhone(phoneRaw) : null;
  if (phoneRaw && !phone) fieldErrors.phone = PROFILE_FIELD_MESSAGES.phoneInvalid;

  const province = provinceRaw || null;
  if (province && !isVnProvince(province) && province !== current.province) {
    fieldErrors.province = PROFILE_FIELD_MESSAGES.provinceInvalid;
  }

  if (Object.keys(fieldErrors).length > 0) {
    return accountFailure("VALIDATION_ERROR", "Vui lòng kiểm tra lại các ô được đánh dấu.", { fieldErrors, values });
  }

  const updated = await prisma.userProfile.update({
    where: { userId: user.userId },
    data: { fullName, phone, province },
  });
  const complete = isProfileComplete(updated);
  const dbUser = await prisma.user.update({
    where: { id: user.userId },
    // Giữ hành vi cũ: chỉ ghi mốc khi đủ hồ sơ, không xoá mốc khi user bỏ trống SĐT/Tỉnh (claim `pc` vẫn tính lại).
    data: complete ? { profileCompletedAt: new Date() } : {},
    select: { id: true, systemRole: true, emailVerifiedAt: true },
  });

  if (complete !== user.profileCompleted) {
    // ADR-053: ký lại theo chính sách của phiên hiện tại (claim `rm`, TTL, kiểu cookie) — cùng helper với login/refresh.
    await issueAccessCookieForSession(await cookies(), {
      userId: dbUser.id,
      familyId: user.familyId,
      role: dbUser.systemRole,
      emailVerified: Boolean(dbUser.emailVerifiedAt),
      profileCompleted: complete,
    });
  }

  return { ok: true, message: "Đã lưu hồ sơ." };
}
