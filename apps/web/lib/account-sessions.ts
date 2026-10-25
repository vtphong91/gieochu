import { describeDeviceKind, describeUserAgent, evaluateSessionTimeouts, resolveSessionPolicy, type DeviceKind } from "@gieochu/auth";
import { AppError, notFound } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import type { CurrentUser } from "./session";
import { getSystemSettings } from "./system-settings";

/**
 * ADR-053 mục 4 — danh sách thiết bị đang đăng nhập của CHÍNH người dùng (`refresh_tokens` là L1, lọc theo `userId`).
 * Một phiên = một `familyId`; bản ghi đại diện là token còn hiệu lực mới nhất (chưa thu hồi, chưa bị thay, chưa hết hạn).
 * Phiên đã quá idle/absolute (chưa kịp bị thu hồi vì không ai gọi refresh) không được liệt kê.
 */

export interface AccountSessionView {
  /** `familyId` — chỉ dùng để đăng xuất đúng phiên của chính người dùng. */
  id: string;
  deviceLabel: string;
  /** Loại thiết bị parse từ User-Agent ở server — chỉ để chọn icon. */
  deviceKind: DeviceKind;
  ip: string | null;
  /** Lúc đăng nhập (phiên trước ADR-053 không có → lúc làm mới gần nhất). */
  startedAt: Date;
  lastActiveAt: Date;
  rememberMe: boolean;
  isCurrent: boolean;
}

const FAMILY_ID_MAX_LENGTH = 100;

export async function listAccountSessions(user: CurrentUser, now: Date = new Date()): Promise<AccountSessionView[]> {
  const [tokens, settings] = await Promise.all([
    getPrismaClient().refreshToken.findMany({
      where: { userId: user.userId, revokedAt: null, replacedById: null, expiresAt: { gt: now } },
      orderBy: { createdAt: "desc" },
      select: { familyId: true, createdAt: true, sessionStartedAt: true, rememberMe: true, deviceLabel: true, userAgent: true, ip: true },
    }),
    getSystemSettings(),
  ]);

  const seen = new Set<string>();
  const sessions: AccountSessionView[] = [];
  for (const token of tokens) {
    if (seen.has(token.familyId)) continue;
    seen.add(token.familyId);
    const policy = resolveSessionPolicy(user.role, token.rememberMe, settings);
    // Cùng quy tắc với /api/auth/refresh: phiên trước ADR-053 tính từ lần làm mới kế tiếp → coi như còn hiệu lực.
    const legacy = token.sessionStartedAt === null;
    const status = evaluateSessionTimeouts(
      { sessionStartedAt: token.sessionStartedAt ?? now, lastActiveAt: legacy ? now : token.createdAt },
      policy,
      now,
    );
    if (status !== "active") continue;
    sessions.push({
      id: token.familyId,
      deviceLabel: token.deviceLabel ?? describeUserAgent(token.userAgent),
      deviceKind: describeDeviceKind(token.userAgent),
      ip: token.ip,
      startedAt: token.sessionStartedAt ?? token.createdAt,
      lastActiveAt: token.createdAt,
      rememberMe: policy.rememberMe,
      isCurrent: token.familyId === user.familyId,
    });
  }
  // Thiết bị này lên đầu, còn lại theo hoạt động gần nhất.
  return sessions.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.lastActiveAt.getTime() - a.lastActiveAt.getTime());
}

/**
 * Đăng xuất một phiên. Quyền sở hữu: `updateMany` luôn lọc `userId` của người gọi — `familyId` của người khác không
 * khớp dòng nào → 404 (không tiết lộ phiên đó có tồn tại hay không).
 */
export async function revokeAccountSession(user: CurrentUser, familyId: unknown, now: Date = new Date()): Promise<{ isCurrent: boolean }> {
  if (typeof familyId !== "string" || familyId.length === 0 || familyId.length > FAMILY_ID_MAX_LENGTH) {
    throw new AppError({ code: "VALIDATION_ERROR", message: "Phiên không hợp lệ.", httpStatus: 400 });
  }
  const revoked = await getPrismaClient().refreshToken.updateMany({
    where: { userId: user.userId, familyId, revokedAt: null },
    data: { revokedAt: now },
  });
  if (revoked.count === 0) throw notFound("Không tìm thấy phiên đăng nhập.");
  return { isCurrent: familyId === user.familyId };
}

/** ADR-053 mục 4: bản ghi phiên hết hạn / đã thu hồi được giữ 90 ngày (tra cứu sự cố), sau đó cron xoá. */
export const SESSION_RECORD_RETENTION_DAYS = 90;

/**
 * Cron `/api/cron/daily`: xoá refresh token đã hết hạn hoặc đã bị thu hồi quá 90 ngày (gồm cả token đã bị thay — chúng hết
 * hạn cùng phiên). Token còn hiệu lực không bao giờ bị xoá. Trả số đếm (không dữ liệu cá nhân).
 */
export async function purgeStaleRefreshTokens(now: Date = new Date()): Promise<{ deleted: number }> {
  const cutoff = new Date(now.getTime() - SESSION_RECORD_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const result = await getPrismaClient().refreshToken.deleteMany({
    where: { OR: [{ expiresAt: { lt: cutoff } }, { revokedAt: { lt: cutoff } }] },
  });
  return { deleted: result.count };
}
