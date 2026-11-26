import { AppError, logger } from "@gieochu/core";
import { getEnv } from "@gieochu/config";
import { getPrismaClient, type TenantStatus, type Tx } from "@gieochu/db";
import { renderTenantLockedEmail, renderTenantUnlockedEmail } from "@gieochu/email";
import { audit } from "./audit";
import { getEffectiveBrand } from "./branding";
import { sendEmailNow } from "./email-dispatch";
import type { CurrentUser } from "./session";
import { getSupportEmail } from "./system-settings";

/**
 * Khoá / mở khoá tenant (System Admin) — dùng chung cho /admin/tenants (+ trang chi tiết, ADR-072) và xử lý báo cáo vi
 * phạm (ADR-038 mục 5). `tenants` không bật RLS (ADR-023 mục 2) nên ghi được bằng client thường hoặc trong transaction có
 * sẵn (withSystemJob). Audit luôn ghi SAU khi nghiệp vụ commit (xem lib/audit.ts).
 *
 * ADR-072 mục 3: khoá/mở khoá thủ công bắt buộc lý do (1–500 ký tự sau trim) — lưu metadata audit `{ reason, previousStatus }`
 * và GỬI NGUYÊN VĂN cho chủ gian hàng trong 1 email sau commit (lỗi gửi chỉ log). Mở khoá luôn đặt ACTIVE.
 */

export const TENANT_LOCK_REASON_MAX_LENGTH = 500;

export const TENANT_LOCK_ERROR_CODES = {
  REASON_INVALID: "TENANT_LOCK_REASON_INVALID",
  ALREADY_LOCKED: "TENANT_ALREADY_LOCKED",
  NOT_LOCKED: "TENANT_NOT_LOCKED",
} as const;

const ID_PATTERN = /^[a-z0-9]{1,40}$/i;

/** Lý do sau trim; null khi rỗng/không phải chuỗi/quá 500 ký tự (đếm theo `length` — khớp giới hạn chuỗi của audit metadata). */
export function normalizeTenantLockReason(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const reason = value.trim();
  if (reason.length === 0 || reason.length > TENANT_LOCK_REASON_MAX_LENGTH) return null;
  return reason;
}

/** Đặt LOCKED trong transaction của caller. Trả trạng thái trước đó; null nếu tenant không tồn tại. */
export async function lockTenantInTx(tx: Tx, tenantId: string): Promise<{ previousStatus: string } | null> {
  const tenant = await tx.tenant.findUnique({ where: { id: tenantId }, select: { status: true } });
  if (!tenant) return null;
  if (tenant.status !== "LOCKED") {
    await tx.tenant.update({ where: { id: tenantId }, data: { status: "LOCKED" } });
  }
  return { previousStatus: tenant.status };
}

export async function auditTenantLocked(actorId: string, tenantId: string, metadata?: Record<string, unknown>): Promise<void> {
  await audit.log({ actorId, scope: "SYSTEM", tenantId, action: "TENANT_LOCKED", targetType: "Tenant", targetId: tenantId, metadata });
}

export interface TenantLockChangeResult {
  previousStatus: TenantStatus;
  /** true khi email báo chủ gian hàng gửi thành công; false = lỗi/chưa cấu hình SMTP (đã log). */
  emailSent: boolean;
}

function tenantNotFound(): AppError {
  return new AppError({ code: "NOT_FOUND", message: "Không tìm thấy gian hàng.", httpStatus: 404 });
}

function requireReason(value: unknown): string {
  const reason = normalizeTenantLockReason(value);
  if (!reason) {
    throw new AppError({
      code: TENANT_LOCK_ERROR_CODES.REASON_INVALID,
      message: `Hãy nhập lý do (tối đa ${TENANT_LOCK_REASON_MAX_LENGTH} ký tự).`,
      httpStatus: 400,
    });
  }
  return reason;
}

function assertSystemAdmin(actor: CurrentUser): void {
  if (actor.role !== "SYSTEM_ADMIN") throw new AppError({ code: "FORBIDDEN", message: "Không có quyền truy cập", httpStatus: 403 });
}

/**
 * Đổi trạng thái có điều kiện: đọc trạng thái hiện tại rồi `updateMany` kèm đúng trạng thái đã đọc — 2 admin bấm cùng lúc
 * thì người sau nhận lỗi trạng thái (không ghi audit/gửi email lần hai).
 */
async function changeTenantStatus(
  tenantId: string,
  target: "LOCKED" | "ACTIVE",
): Promise<{ previousStatus: TenantStatus; name: string; slug: string; ownerEmail: string }> {
  if (!ID_PATTERN.test(tenantId)) throw tenantNotFound();
  const wrongState = () =>
    target === "LOCKED"
      ? new AppError({ code: TENANT_LOCK_ERROR_CODES.ALREADY_LOCKED, message: "Gian hàng đã bị khoá.", httpStatus: 409 })
      : new AppError({ code: TENANT_LOCK_ERROR_CODES.NOT_LOCKED, message: "Gian hàng không ở trạng thái bị khoá.", httpStatus: 409 });

  const prisma = getPrismaClient();
  const tenant = await prisma.tenant.findUnique({
    where: { id: tenantId },
    select: { id: true, name: true, slug: true, status: true, owner: { select: { email: true } } },
  });
  if (!tenant) throw tenantNotFound();
  const allowed = target === "LOCKED" ? tenant.status !== "LOCKED" : tenant.status === "LOCKED";
  if (!allowed) throw wrongState();
  const { count } = await prisma.tenant.updateMany({ where: { id: tenant.id, status: tenant.status }, data: { status: target } });
  if (count === 0) throw wrongState();
  return { previousStatus: tenant.status, name: tenant.name, slug: tenant.slug, ownerEmail: tenant.owner.email };
}

async function notifyOwner(
  kind: "LOCKED" | "UNLOCKED",
  tenant: { id: string; name: string; slug: string; ownerEmail: string },
  reason: string,
): Promise<boolean> {
  try {
    const [brand, supportEmail] = await Promise.all([getEffectiveBrand(), getSupportEmail()]);
    const data = {
      appName: brand.name,
      tenantName: tenant.name,
      reason,
      supportEmail,
      studioUrl: `${getEnv().APP_URL.replace(/\/+$/, "")}/studio/${tenant.slug}`,
    };
    const rendered = kind === "LOCKED" ? renderTenantLockedEmail(data) : renderTenantUnlockedEmail(data);
    const result = await sendEmailNow({ type: kind === "LOCKED" ? "tenant_locked" : "tenant_unlocked", to: tenant.ownerEmail, ...rendered });
    if (!result.ok) logger.warn({ tenantId: tenant.id, kind, error: result.error }, "tenant_lock: gửi email cho chủ gian hàng thất bại");
    return result.ok;
  } catch (error) {
    logger.error({ err: error, tenantId: tenant.id, kind }, "tenant_lock: lỗi khi gửi email cho chủ gian hàng");
    return false;
  }
}

/** ADR-072 — System Admin khoá gian hàng (ACTIVE/READ_ONLY → LOCKED) kèm lý do; audit + 1 email chủ gian hàng sau commit. */
export async function lockTenant(actor: CurrentUser, tenantId: string, rawReason: unknown): Promise<TenantLockChangeResult> {
  assertSystemAdmin(actor);
  const reason = requireReason(rawReason);
  const changed = await changeTenantStatus(tenantId, "LOCKED");
  await auditTenantLocked(actor.userId, tenantId, { reason, previousStatus: changed.previousStatus });
  const emailSent = await notifyOwner("LOCKED", { id: tenantId, ...changed }, reason);
  return { previousStatus: changed.previousStatus, emailSent };
}

/** ADR-072 — System Admin mở khoá gian hàng (LOCKED → luôn ACTIVE) kèm lý do; audit + 1 email chủ gian hàng sau commit. */
export async function unlockTenant(actor: CurrentUser, tenantId: string, rawReason: unknown): Promise<TenantLockChangeResult> {
  assertSystemAdmin(actor);
  const reason = requireReason(rawReason);
  const changed = await changeTenantStatus(tenantId, "ACTIVE");
  await audit.log({
    actorId: actor.userId,
    scope: "SYSTEM",
    tenantId,
    action: "TENANT_UNLOCKED",
    targetType: "Tenant",
    targetId: tenantId,
    metadata: { reason, previousStatus: changed.previousStatus },
  });
  const emailSent = await notifyOwner("UNLOCKED", { id: tenantId, ...changed }, reason);
  return { previousStatus: changed.previousStatus, emailSent };
}
