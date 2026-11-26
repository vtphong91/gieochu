import { describeUserAgent, evaluateSessionTimeouts, resolveSessionPolicy, type SessionPolicy } from "@gieochu/auth";
import { auditActionLabel } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { isAuditTableMissing } from "./audit";
import { getGuestSessionPolicy } from "./jwt-context";
import { requireRole } from "./session";
import { getSystemSettings } from "./system-settings";

/**
 * ADR-073 — dữ liệu trang `/admin/users/[userId]` (System Center). Tự `requireRole("SYSTEM_ADMIN")` (không tin trang gọi).
 *
 * Ranh giới (§7.9 + ADR-073 mục 1–2, kế hoạch Đợt 4 §8):
 * - Chỉ bảng L1: `users`, `user_profiles`, `refresh_tokens`, `user_legal_acceptances` (+ phiên bản/văn bản), `tenants` (chủ sở
 *   hữu) + gói, `audit_logs`. KHÔNG đọc `orders`, `entitlements`, `tenant_customers`, giao dịch.
 * - Không trả `passwordHash`, `tokenHash`, `familyId`, token kích hoạt/đặt lại. Số điện thoại và IP luôn che ở server — số đầy
 *   đủ chỉ qua `revealUserPhoneAction` (có audit).
 * - Nhật ký: allowlist {@link USER_AUDIT_ACTIONS}, `tenantId IS NULL`, không đưa IP/User-Agent của request.
 */

// ───────────────────────── Kiểu dữ liệu (contract Phong ↔ Hiếu, Quốc duyệt) ─────────────────────────

export type AdminUserStatus = "PENDING" | "ACTIVE" | "LOCKED";
export type AdminUserRole = "SUPER_ADMIN" | "ADMIN" | "OWNER" | "USER";

export interface AdminUserSession {
  deviceLabel: string | null;
  ipMasked: string | null;
  rememberMe: boolean;
  startedAt: Date;
  lastActiveAt: Date;
  expiresAt: Date;
}

export type AdminUserAuditKind =
  | "USER_LOCKED"
  | "USER_UNLOCKED"
  | "USER_SESSIONS_REVOKED"
  | "USER_PASSWORD_RESET_REQUIRED"
  | "USER_PHONE_VIEWED"
  | "USER_VERIFICATION_RESENT"
  | "OTHER";

export interface AdminUserAuditEntry {
  id: string;
  kind: AdminUserAuditKind;
  action: string;
  actionLabel: string;
  createdAt: Date;
  actor: { role: "SELF" | "ADMIN" | "SYSTEM"; name: string | null; email: string | null };
  reason: string | null;
  statusChange: { from: string; to: string } | null;
  sessionsRevoked: number | null;
  emailSent: boolean | null;
}

export interface AdminUserDetail {
  id: string;
  email: string;
  fullName: string | null;
  status: AdminUserStatus;
  role: AdminUserRole;
  isSelf: boolean;
  isSuperAdmin: boolean;
  createdAt: Date;
  emailVerifiedAt: Date | null;
  profileCompletedAt: Date | null;
  profile: null | { phoneMasked: string | null; province: string | null; occupation: string | null; consentAt: Date | null };
  security: {
    lastLoginAt: Date | null;
    failedLoginAttempts: number;
    passwordResetRequired: boolean;
    activeSessionCount: number;
    sessions: AdminUserSession[];
  };
  ownedTenant: null | { id: string; name: string; slug: string; status: string; planName: string | null };
  legal: { total: number; acceptances: { documentTitle: string; versionLabel: string; acceptedAt: Date }[] };
  audit: { entries: AdminUserAuditEntry[]; total: number };
  actions: {
    canLock: boolean;
    canUnlock: boolean;
    canRevokeSessions: boolean;
    canResendVerification: boolean;
    canRequestPasswordReset: boolean;
    lockBlocked: "SELF" | "SUPER_ADMIN" | null;
  };
}

// ───────────────────────── Che dữ liệu cá nhân ─────────────────────────

const MASK = "•";

/** `0912345123` → `09•••••123`: giữ 2 ký tự đầu + 3 cuối; chuỗi ≤ 5 ký tự che hết. Rỗng → null. */
export function maskPhone(phone: string | null | undefined): string | null {
  const value = phone?.trim();
  if (!value) return null;
  if (value.length <= 5) return MASK.repeat(value.length);
  return `${value.slice(0, 2)}${MASK.repeat(value.length - 5)}${value.slice(-3)}`;
}

/**
 * IPv4 `113.161.12.34` → `113.161.•••.•••`; IPv6 giữ 2 nhóm đầu (`2001:db8:•••`); IPv4-mapped (`::ffff:1.2.3.4`) che như IPv4.
 * Không nhận dạng được → `•••`. Rỗng → null.
 */
export function maskIp(ip: string | null | undefined): string | null {
  const value = ip?.trim();
  if (!value) return null;
  const v4 = /^(?:::ffff:)?(\d{1,3})\.(\d{1,3})\.\d{1,3}\.\d{1,3}$/i.exec(value);
  if (v4) return `${v4[1]}.${v4[2]}.${MASK.repeat(3)}.${MASK.repeat(3)}`;
  if (value.includes(":")) {
    const groups = value.split(":").filter((g) => g.length > 0);
    if (groups.length >= 2 && groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g))) return `${groups[0]}:${groups[1]}:${MASK.repeat(3)}`;
  }
  return MASK.repeat(3);
}

// ───────────────────────── Nhật ký ─────────────────────────

const ID_PATTERN = /^[a-z0-9]{1,40}$/i;
const SESSION_LIMIT = 20;
const LEGAL_LIMIT = 50;
const AUDIT_LIMIT = 50;

/** Thao tác quản trị trên tài khoản — luôn `targetType User`, `targetId` = người dùng. */
const ADMIN_ACCOUNT_ACTIONS = [
  "USER_LOCKED",
  "USER_UNLOCKED",
  "USER_SESSIONS_REVOKED",
  "USER_PASSWORD_RESET_REQUIRED",
  "USER_PHONE_VIEWED",
  "USER_VERIFICATION_RESENT",
] as const;

/**
 * Sự kiện bảo mật của chính người dùng (actor = target = người dùng). KHÔNG có `AUTH_GUEST_ACCOUNT_CREATED` (gắn với một lần
 * mua ở gian hàng — §7.9) và không có action đơn hàng/khách của gian hàng.
 */
const SELF_SECURITY_ACTIONS = [
  "AUTH_LOGIN_FAILED",
  "AUTH_REFRESH_REUSE",
  "AUTH_PASSWORD_CHANGED",
  "AUTH_EMAIL_CHANGE_REQUESTED",
  "AUTH_EMAIL_CHANGED",
  "AUTH_GUEST_ACTIVATED",
] as const;

export const USER_AUDIT_ACTIONS: readonly string[] = [...ADMIN_ACCOUNT_ACTIONS, ...SELF_SECURITY_ACTIONS];
const ADMIN_ACTION_SET: ReadonlySet<string> = new Set(ADMIN_ACCOUNT_ACTIONS);

function asRecord(value: unknown): Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function metaString(meta: Record<string, unknown>, key: string): string | null {
  const value = meta[key];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function metaNumber(meta: Record<string, unknown>, key: string): number | null {
  const value = meta[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function metaBoolean(meta: Record<string, unknown>, key: string): boolean | null {
  const value = meta[key];
  return typeof value === "boolean" ? value : null;
}

async function loadAudit(userId: string): Promise<AdminUserDetail["audit"]> {
  const prisma = getPrismaClient();
  // actorId = người dùng: chỉ sự kiện tự thực hiện trên chính tài khoản; targetId = người dùng: mọi action trong allowlist.
  // Thao tác của người dùng (nếu là admin) lên tài khoản KHÁC không hiện ở đây.
  const where = {
    tenantId: null,
    action: { in: [...USER_AUDIT_ACTIONS] },
    OR: [
      { targetType: "User", targetId: userId },
      { actorId: userId, action: { in: [...SELF_SECURITY_ACTIONS] } },
    ],
  };
  let rows: { id: string; action: string; actorId: string | null; metadata: unknown; createdAt: Date }[];
  let total: number;
  try {
    [rows, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: AUDIT_LIMIT,
        // Không chọn ip/userAgent của request.
        select: { id: true, action: true, actorId: true, metadata: true, createdAt: true },
      }),
      prisma.auditLog.count({ where }),
    ]);
  } catch (error) {
    if (isAuditTableMissing(error)) return { entries: [], total: 0 };
    throw error;
  }

  const actorIds = [...new Set(rows.flatMap((row) => (row.actorId ? [row.actorId] : [])))];
  const actors =
    actorIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: actorIds } }, select: { id: true, email: true, profile: { select: { fullName: true } } } })
      : [];
  const actorById = new Map(actors.map((user) => [user.id, user]));

  const entries = rows.map((row): AdminUserAuditEntry => {
    const meta = asRecord(row.metadata);
    const kind: AdminUserAuditKind = ADMIN_ACTION_SET.has(row.action) ? (row.action as AdminUserAuditKind) : "OTHER";
    const actorUser = row.actorId ? actorById.get(row.actorId) : undefined;
    const actor: AdminUserAuditEntry["actor"] = !row.actorId
      ? { role: "SYSTEM", name: null, email: null }
      : { role: row.actorId === userId ? "SELF" : "ADMIN", name: actorUser?.profile?.fullName ?? null, email: actorUser?.email ?? null };

    let statusChange: AdminUserAuditEntry["statusChange"] = null;
    if (kind === "USER_LOCKED") {
      const from = metaString(meta, "previousStatus");
      statusChange = from ? { from, to: "LOCKED" } : null;
    } else if (kind === "USER_UNLOCKED") {
      // Bản ghi trước ADR-073 không có newStatus — khi đó mở khoá luôn về ACTIVE.
      statusChange = { from: "LOCKED", to: metaString(meta, "newStatus") ?? "ACTIVE" };
    }
    const isLockEntry = kind === "USER_LOCKED" || kind === "USER_UNLOCKED";
    const revokes = kind === "USER_LOCKED" || kind === "USER_SESSIONS_REVOKED" || kind === "USER_PASSWORD_RESET_REQUIRED";
    const emails = isLockEntry || kind === "USER_PASSWORD_RESET_REQUIRED" || kind === "USER_VERIFICATION_RESENT";
    return {
      id: row.id,
      kind,
      action: row.action,
      actionLabel: auditActionLabel(row.action),
      createdAt: row.createdAt,
      actor,
      reason: isLockEntry ? metaString(meta, "reason") : null,
      statusChange,
      sessionsRevoked: revokes ? metaNumber(meta, "revokedSessions") : null,
      emailSent: emails ? metaBoolean(meta, "emailSent") : null,
    };
  });
  return { entries, total };
}

// ───────────────────────── Phiên đăng nhập ─────────────────────────

/**
 * Phiên còn hiệu lực theo cùng quy tắc `/account/security` (ADR-053): mỗi `familyId` lấy token chưa thu hồi/chưa bị thay/chưa hết
 * hạn mới nhất, bỏ phiên đã quá idle/absolute. Chính sách theo vai trò HIỆN TẠI của người dùng; phiên khách vãng lai ≤ 24 giờ.
 */
async function loadSessions(userId: string, role: "USER" | "SYSTEM_ADMIN", now: Date): Promise<{ count: number; sessions: AdminUserSession[] }> {
  const [tokens, settings] = await Promise.all([
    getPrismaClient().refreshToken.findMany({
      where: { userId, revokedAt: null, replacedById: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      // Không chọn tokenHash / familyId ra ngoài hàm (familyId chỉ dùng để gộp).
      select: { familyId: true, createdAt: true, sessionStartedAt: true, rememberMe: true, deviceLabel: true, userAgent: true, ip: true, expiresAt: true, guestCheckout: true },
    }),
    getSystemSettings(),
  ]);
  const guestPolicy = tokens.some((token) => token.guestCheckout) ? await getGuestSessionPolicy() : null;
  const seen = new Set<string>();
  const sessions: AdminUserSession[] = [];
  for (const token of tokens) {
    if (seen.has(token.familyId)) continue;
    seen.add(token.familyId);
    const policy: SessionPolicy =
      token.guestCheckout && guestPolicy ? guestPolicy : resolveSessionPolicy(role, token.rememberMe, settings);
    const legacy = token.sessionStartedAt === null;
    const status = evaluateSessionTimeouts(
      { sessionStartedAt: token.sessionStartedAt ?? now, lastActiveAt: legacy ? now : token.createdAt },
      policy,
      now,
    );
    if (status !== "active") continue;
    sessions.push({
      deviceLabel: token.deviceLabel ?? (token.userAgent ? describeUserAgent(token.userAgent) : null),
      ipMasked: maskIp(token.ip),
      rememberMe: policy.rememberMe,
      startedAt: token.sessionStartedAt ?? token.createdAt,
      lastActiveAt: token.createdAt,
      expiresAt: token.expiresAt,
    });
  }
  sessions.sort((a, b) => b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
  return { count: sessions.length, sessions: sessions.slice(0, SESSION_LIMIT) };
}

// ───────────────────────── Chi tiết ─────────────────────────

/** ADR-073 mục 1 — dữ liệu trang `/admin/users/[userId]`. null khi id sai định dạng hoặc người dùng không tồn tại. */
export async function getAdminUserDetail(userId: string, options: { now?: Date } = {}): Promise<AdminUserDetail | null> {
  const actor = await requireRole("SYSTEM_ADMIN");
  if (typeof userId !== "string" || !ID_PATTERN.test(userId)) return null;
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    // Chọn tường minh — không bao giờ lấy passwordHash.
    select: {
      id: true,
      email: true,
      status: true,
      systemRole: true,
      isSuperAdmin: true,
      createdAt: true,
      emailVerifiedAt: true,
      profileCompletedAt: true,
      lastLoginAt: true,
      failedLoginAttempts: true,
      passwordResetRequired: true,
      profile: { select: { fullName: true, phone: true, province: true, occupation: true, consentAt: true } },
      ownedTenant: { select: { id: true, name: true, slug: true, status: true, subscription: { select: { plan: { select: { name: true } } } } } },
    },
  });
  if (!user) return null;
  const now = options.now ?? new Date();

  const [sessionInfo, legalTotal, legalRows, audit] = await Promise.all([
    loadSessions(user.id, user.systemRole, now),
    prisma.userLegalAcceptance.count({ where: { userId: user.id } }),
    prisma.userLegalAcceptance.findMany({
      where: { userId: user.id },
      orderBy: [{ acceptedAt: "desc" }, { id: "desc" }],
      take: LEGAL_LIMIT,
      select: { acceptedAt: true, version: { select: { version: true, document: { select: { title: true } } } } },
    }),
    loadAudit(user.id),
  ]);

  const isSelf = user.id === actor.userId;
  const role: AdminUserRole = user.isSuperAdmin ? "SUPER_ADMIN" : user.systemRole === "SYSTEM_ADMIN" ? "ADMIN" : user.ownedTenant ? "OWNER" : "USER";
  const protectedTarget = isSelf || user.isSuperAdmin;

  return {
    id: user.id,
    email: user.email,
    fullName: user.profile?.fullName ?? null,
    status: user.status,
    role,
    isSelf,
    isSuperAdmin: user.isSuperAdmin,
    createdAt: user.createdAt,
    emailVerifiedAt: user.emailVerifiedAt,
    profileCompletedAt: user.profileCompletedAt,
    profile: user.profile
      ? {
          phoneMasked: maskPhone(user.profile.phone),
          province: user.profile.province ?? null,
          occupation: user.profile.occupation ?? null,
          consentAt: user.profile.consentAt ?? null,
        }
      : null,
    security: {
      lastLoginAt: user.lastLoginAt,
      failedLoginAttempts: user.failedLoginAttempts,
      passwordResetRequired: user.passwordResetRequired,
      activeSessionCount: sessionInfo.count,
      sessions: sessionInfo.sessions,
    },
    ownedTenant: user.ownedTenant
      ? {
          id: user.ownedTenant.id,
          name: user.ownedTenant.name,
          slug: user.ownedTenant.slug,
          status: user.ownedTenant.status,
          planName: user.ownedTenant.subscription?.plan.name ?? null,
        }
      : null,
    legal: {
      total: legalTotal,
      acceptances: legalRows.map((row) => ({
        documentTitle: row.version.document.title,
        versionLabel: `Phiên bản ${row.version.version}`,
        acceptedAt: row.acceptedAt,
      })),
    },
    audit,
    actions: {
      canLock: user.status !== "LOCKED" && !protectedTarget,
      canUnlock: user.status === "LOCKED",
      canRevokeSessions: sessionInfo.count >= 1 && !protectedTarget,
      canResendVerification: user.status === "PENDING",
      canRequestPasswordReset: user.status === "ACTIVE" && !protectedTarget,
      lockBlocked: isSelf ? "SELF" : user.isSuperAdmin ? "SUPER_ADMIN" : null,
    },
  };
}
