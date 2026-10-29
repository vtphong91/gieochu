import { createHmac } from "node:crypto";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, Prisma } from "@gieochu/db";

/**
 * ADR-061 Q1 / Bổ sung ADR-062 mục 7 — bộ đếm rate limit dùng chung giữa các instance (bảng L1 `rate_limit_counters`).
 * Khoá luôn là HMAC (bí mật server) của giá trị gốc — không lưu IP/email thô, không dò ngược bằng bảng băm sẵn.
 */
export function rateLimitKey(scope: string, value: string): string {
  const digest = createHmac("sha256", getEnv().JWT_ACCESS_SECRET).update(`${scope}:${value}`).digest("hex");
  return `${scope}:${digest}`;
}

/**
 * Tăng bộ đếm của `key` trong cửa sổ `windowMs`; trả `true` nếu còn trong giới hạn (lần này được phép). Nguyên tử: tạo dòng mới
 * (unique `key`), trùng thì `UPDATE … RETURNING` (cửa sổ đã hết → đặt lại về 1).
 */
export async function consumeRateLimit(key: string, limit: number, windowMs: number, now = new Date()): Promise<boolean> {
  const prisma = getPrismaClient();
  const resetAt = new Date(now.getTime() + windowMs);
  try {
    await prisma.rateLimitCounter.create({ data: { key, count: 1, resetAt } });
    return 1 <= limit;
  } catch (error) {
    if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
  }
  // Cột `timestamp(3)` lưu UTC không múi giờ — tham số thời gian đổi tường minh sang UTC (mẫu `utcTimestampSql`).
  const nowSql = Prisma.sql`(${now.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const resetSql = Prisma.sql`(${resetAt.toISOString()}::timestamptz AT TIME ZONE 'UTC')`;
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    UPDATE "rate_limit_counters"
    SET "count" = CASE WHEN "resetAt" <= ${nowSql} THEN 1 ELSE "count" + 1 END,
        "resetAt" = CASE WHEN "resetAt" <= ${nowSql} THEN ${resetSql} ELSE "resetAt" END,
        "updatedAt" = ${nowSql}
    WHERE "key" = ${key}
    RETURNING "count"
  `;
  const count = rows[0]?.count ?? Number.POSITIVE_INFINITY;
  return count <= limit;
}

/** Bước cron hằng ngày: xoá bộ đếm đã hết hạn. */
export async function purgeExpiredRateLimitCounters(now = new Date()): Promise<{ deleted: number }> {
  const { count } = await getPrismaClient().rateLimitCounter.deleteMany({ where: { resetAt: { lt: now } } });
  return { deleted: count };
}
