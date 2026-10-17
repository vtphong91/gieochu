import { headers } from "next/headers";
import { unstable_rethrow } from "next/navigation";
import {
  extractAuditIp,
  logger,
  normalizeAuditUserAgent,
  sanitizeAuditMetadata,
  type AuditAction,
  type AuditScopeValue,
} from "@gieochu/core";
import { getPrismaClient, type Prisma } from "@gieochu/db";

/**
 * ADR-037 (M12a) — ghi audit log (`audit_logs`, bảng L1 — không RLS, ghi bằng getPrismaClient()).
 *
 * Nguyên tắc:
 * - **Không làm hỏng nghiệp vụ chính:** mọi lỗi ghi (kể cả bảng chưa tồn tại khi code lên trước migration — P2021)
 *   chỉ `logger`, KHÔNG ném. Hàm trả `true/false` để test/nơi cần biết kiểm tra.
 * - **Ghi SAU khi nghiệp vụ commit, ngoài transaction nghiệp vụ** (lựa chọn có chủ đích): ghi trong cùng transaction
 *   thì lỗi audit (bảng chưa có, mất kết nối) sẽ rollback cả nghiệp vụ — trái nguyên tắc trên; đổi lại, nếu process
 *   chết giữa commit nghiệp vụ và lệnh ghi audit thì mất 1 dòng audit (chấp nhận được với MVP).
 * - **Metadata đã lọc** (`sanitizeAuditMetadata`): bỏ khoá secret/token/password/hash..., cắt độ dài. Nơi gọi vẫn phải
 *   tự giữ §7.9: hành động của tenant chỉ ghi id — không email khách, không chi tiết đơn.
 * - `ip`/`userAgent`: `undefined` → tự lấy từ request hiện tại (`headers()`, chỉ có trong Server Action / Route
 *   Handler / Server Component); `null` → không ghi. Ngoài phạm vi request (cron chạy nền, test) → null.
 */
export interface AuditLogInput {
  /** User thực hiện; `null` = hệ thống (webhook, cron, job). */
  actorId: string | null;
  scope: AuditScopeValue;
  /** Có giá trị khi hành động thuộc về 1 tenant — owner thấy dòng này ở /studio/{slug}/activity. */
  tenantId?: string | null;
  action: AuditAction;
  targetType?: string | null;
  targetId?: string | null;
  metadata?: Record<string, unknown>;
  ip?: string | null;
  userAgent?: string | null;
}

export interface AuditRequestMeta {
  ip: string | null;
  userAgent: string | null;
}

/** ip/userAgent từ một `Request` (Route Handler) — ip lấy phần tử đầu của `x-forwarded-for`, cắt độ dài. */
export function auditMetaFromRequest(request: Request): AuditRequestMeta {
  return {
    ip: extractAuditIp(request.headers.get("x-forwarded-for"), request.headers.get("x-real-ip")),
    userAgent: normalizeAuditUserAgent(request.headers.get("user-agent")),
  };
}

/** ip/userAgent của request hiện tại qua `headers()`; ngoài phạm vi request → cả hai null. */
export async function auditMetaFromHeaders(): Promise<AuditRequestMeta> {
  try {
    const store = await headers();
    return {
      ip: extractAuditIp(store.get("x-forwarded-for"), store.get("x-real-ip")),
      userAgent: normalizeAuditUserAgent(store.get("user-agent")),
    };
  } catch (error) {
    // headers() trong lúc prerender ném lỗi nội bộ của Next — phải để Next xử lý, không nuốt.
    unstable_rethrow(error);
    return { ip: null, userAgent: null };
  }
}

/** Bảng `audit_logs` chưa tồn tại (code lên trước migration) — P2021 (Prisma) hoặc 42P01 (Postgres, raw query). */
export function isAuditTableMissing(error: unknown): boolean {
  if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2021") return true;
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /42P01|audit_logs.*does not exist|does not exist.*audit_logs/i.test(text);
}

async function log(input: AuditLogInput): Promise<boolean> {
  try {
    const needsRequestMeta = input.ip === undefined || input.userAgent === undefined;
    const requestMeta = needsRequestMeta ? await auditMetaFromHeaders() : { ip: null, userAgent: null };
    const ip = input.ip === undefined ? requestMeta.ip : extractAuditIp(input.ip);
    const userAgent = input.userAgent === undefined ? requestMeta.userAgent : normalizeAuditUserAgent(input.userAgent);

    await getPrismaClient().auditLog.create({
      data: {
        actorId: input.actorId,
        scope: input.scope,
        tenantId: input.tenantId ?? null,
        action: input.action,
        targetType: input.targetType ?? null,
        targetId: input.targetId ?? null,
        metadata: sanitizeAuditMetadata(input.metadata) as Prisma.InputJsonValue,
        ip,
        userAgent,
      },
    });
    return true;
  } catch (error) {
    unstable_rethrow(error);
    if (isAuditTableMissing(error)) {
      logger.warn({ action: input.action }, "audit: bảng audit_logs chưa có (migration M12a chưa áp) — bỏ qua ghi");
    } else {
      logger.error({ err: error, action: input.action }, "audit: ghi audit_logs thất bại");
    }
    return false;
  }
}

export interface AuditPurgeResult {
  deleted: number;
  /** true khi bảng chưa tồn tại (code lên trước migration) — bước cron coi là bỏ qua, không lỗi. */
  skipped: boolean;
}

/**
 * ADR-037 mục 3 — xoá dòng audit cũ hơn 12 tháng (cron hằng ngày `/api/cron/daily`). Trong 1 transaction: đặt cờ phiên
 * `gieochu.audit_purge = 'on'` (SET LOCAL — hết hiệu lực khi transaction kết thúc, không rò sang kết nối pool khác),
 * rồi DELETE. Trigger `audit_logs_guard_delete` vẫn kiểm từng dòng (cờ + > 12 tháng) — điều kiện WHERE ở đây chỉ để
 * không chạm dòng mới (dòng mới bị trigger chặn sẽ làm hỏng cả lệnh). So sánh theo UTC giống trigger.
 */
async function purgeExpired(): Promise<AuditPurgeResult> {
  try {
    const deleted = await getPrismaClient().$transaction(async (tx) => {
      await tx.$executeRaw`SET LOCAL gieochu.audit_purge = 'on'`;
      return tx.$executeRaw`DELETE FROM "audit_logs" WHERE "createdAt" < (now() AT TIME ZONE 'UTC') - interval '12 months'`;
    });
    return { deleted, skipped: false };
  } catch (error) {
    if (isAuditTableMissing(error)) {
      logger.warn("audit.purge: bảng audit_logs chưa có (migration M12a chưa áp) — bỏ qua");
      return { deleted: 0, skipped: true };
    }
    throw error;
  }
}

export const audit = { log, purgeExpired };
