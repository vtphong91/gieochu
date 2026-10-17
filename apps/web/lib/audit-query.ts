import {
  AUDIT_SCOPE_LABELS,
  auditActionLabel,
  canManageTenant,
  forbidden,
  isAuditAction,
  maskEmail,
  type AuditAction,
  type AuditJsonValue,
  type AuditScopeValue,
} from "@gieochu/core";
import { getPrismaClient, withTenant, type Prisma } from "@gieochu/db";
import { requireRole, requireUser } from "./session";
import { isAuditTableMissing } from "./audit";

/**
 * ADR-037 mục 7 — loader trang xem audit log.
 * - Admin (`/admin/audit`): mọi dòng, lọc actor (email hoặc id), action, tenant (slug hoặc id), khoảng ngày.
 * - Owner (`/studio/{slug}/activity`): CHỈ dòng có `tenantId` của mình — kiểm quyền OWNER ở server, truy vấn luôn
 *   `where tenantId`. Actor ngoài tenant được che: admin hệ thống → "Quản trị hệ thống", khách → `n***@gmail.com`;
 *   IP/User-Agent chỉ hiện khi actor là thành viên tenant.
 * - `audit_logs` là bảng L1 (không RLS) → đọc bằng getPrismaClient(); quyền kiểm tra ngay trong loader.
 * - Bảng chưa tồn tại (code lên trước migration) → `{ status: "unavailable" }`, trang hiện thông báo thay vì 500.
 */

/** Khớp lựa chọn của component Pagination (admin/_ui/pagination.tsx). */
export const AUDIT_PAGE_SIZES = [10, 20, 50, 100] as const;
const DEFAULT_PAGE_SIZE = 20;

/** Bộ lọc thô từ query string (GET form). Ngày dạng `YYYY-MM-DD`, hiểu theo giờ Việt Nam. */
export interface AuditLogSearchParams {
  actor?: string;
  action?: string;
  tenant?: string;
  from?: string;
  to?: string;
  page?: string;
  pageSize?: string;
}

/** Bộ lọc đã chuẩn hoá — trang dùng để điền lại form. */
export interface AuditLogAppliedFilters {
  actor: string;
  action: AuditAction | "";
  tenant: string;
  from: string;
  to: string;
  page: number;
  pageSize: number;
}

export type AuditActorKind = "SYSTEM" | "ADMIN" | "MEMBER" | "USER" | "CUSTOMER" | "DELETED";

export interface AuditActorView {
  /** Chỉ admin thấy id; owner nhận null với actor ngoài tenant. */
  id: string | null;
  kind: AuditActorKind;
  /** Chuỗi hiển thị chính (email, email đã che, "Hệ thống", "Quản trị hệ thống"...). */
  label: string;
  /** Họ tên (nếu có và được phép hiện). */
  name: string | null;
}

export interface AuditLogRowView {
  id: string;
  /** ISO 8601 UTC — trang tự định dạng theo `DISPLAY_TIME_ZONE`. */
  createdAt: string;
  action: string;
  actionLabel: string;
  scope: AuditScopeValue;
  scopeLabel: string;
  actor: AuditActorView;
  /** Chỉ có ở view admin. */
  tenant: { id: string; name: string; slug: string } | { id: string; name: null; slug: null } | null;
  targetType: string | null;
  targetId: string | null;
  metadata: AuditJsonValue;
  ip: string | null;
  userAgent: string | null;
}

export type AuditLogListResult =
  | {
      status: "ok";
      rows: AuditLogRowView[];
      total: number;
      filters: AuditLogAppliedFilters;
      /** Bộ lọc actor/tenant không khớp ai/tenant nào → danh sách rỗng có chủ đích. */
      unmatchedFilter: "actor" | "tenant" | null;
    }
  | { status: "unavailable"; filters: AuditLogAppliedFilters };

// ───────────────────────── Chuẩn hoá bộ lọc ─────────────────────────

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function cleanText(value: string | undefined, max = 200): string {
  return (value ?? "").trim().slice(0, max);
}

function cleanDate(value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!DATE_PATTERN.test(v)) return "";
  return Number.isNaN(new Date(`${v}T00:00:00+07:00`).getTime()) ? "" : v;
}

export function parseAuditLogFilters(sp: AuditLogSearchParams): AuditLogAppliedFilters {
  const size = Number(sp.pageSize);
  const pageSize = (AUDIT_PAGE_SIZES as readonly number[]).includes(size) ? size : DEFAULT_PAGE_SIZE;
  const action = cleanText(sp.action, 64);
  return {
    actor: cleanText(sp.actor),
    action: isAuditAction(action) ? action : "",
    tenant: cleanText(sp.tenant),
    from: cleanDate(sp.from),
    to: cleanDate(sp.to),
    page: Math.max(1, Math.floor(Number(sp.page)) || 1),
    pageSize,
  };
}

/** Ngày giờ VN (UTC+7, không DST) → khoảng UTC; `to` tính hết ngày (exclusive ngày kế tiếp). */
function createdAtWhere(filters: AuditLogAppliedFilters): Prisma.DateTimeFilter | undefined {
  if (!filters.from && !filters.to) return undefined;
  const where: Prisma.DateTimeFilter = {};
  if (filters.from) where.gte = new Date(`${filters.from}T00:00:00+07:00`);
  if (filters.to) where.lt = new Date(new Date(`${filters.to}T00:00:00+07:00`).getTime() + 24 * 60 * 60 * 1000);
  return where;
}

// ───────────────────────── Truy vấn chung ─────────────────────────

type AuditRecord = {
  id: string;
  actorId: string | null;
  scope: AuditScopeValue;
  tenantId: string | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  metadata: Prisma.JsonValue;
  ip: string | null;
  userAgent: string | null;
  createdAt: Date;
};

async function queryAuditLogs(where: Prisma.AuditLogWhereInput, filters: AuditLogAppliedFilters): Promise<{ records: AuditRecord[]; total: number }> {
  const prisma = getPrismaClient();
  const [records, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: (filters.page - 1) * filters.pageSize,
      take: filters.pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);
  return { records, total };
}

async function loadUsers(ids: string[]) {
  if (ids.length === 0) return new Map<string, { id: string; email: string; systemRole: string; fullName: string | null }>();
  const users = await getPrismaClient().user.findMany({
    where: { id: { in: ids } },
    select: { id: true, email: true, systemRole: true, profile: { select: { fullName: true } } },
  });
  return new Map(users.map((u) => [u.id, { id: u.id, email: u.email, systemRole: u.systemRole, fullName: u.profile?.fullName ?? null }]));
}

function baseRow(record: AuditRecord): Omit<AuditLogRowView, "actor" | "tenant" | "ip" | "userAgent"> {
  return {
    id: record.id,
    createdAt: record.createdAt.toISOString(),
    action: record.action,
    actionLabel: auditActionLabel(record.action),
    scope: record.scope,
    scopeLabel: AUDIT_SCOPE_LABELS[record.scope],
    targetType: record.targetType,
    targetId: record.targetId,
    metadata: (record.metadata ?? {}) as AuditJsonValue,
  };
}

const SYSTEM_ACTOR: AuditActorView = { id: null, kind: "SYSTEM", label: "Hệ thống", name: null };

// ───────────────────────── Admin ─────────────────────────

/** `/admin/audit` — chỉ SYSTEM_ADMIN (kiểm lại ở đây, không tin trang gọi). */
export async function listAuditLogs(sp: AuditLogSearchParams): Promise<AuditLogListResult> {
  await requireRole("SYSTEM_ADMIN");
  const filters = parseAuditLogFilters(sp);
  const prisma = getPrismaClient();

  try {
    const where: Prisma.AuditLogWhereInput = {};
    if (filters.action) where.action = filters.action;
    const createdAt = createdAtWhere(filters);
    if (createdAt) where.createdAt = createdAt;

    if (filters.actor) {
      const actor = filters.actor.includes("@")
        ? await prisma.user.findUnique({ where: { email: filters.actor.toLowerCase() }, select: { id: true } })
        : { id: filters.actor };
      if (!actor) return { status: "ok", rows: [], total: 0, filters, unmatchedFilter: "actor" };
      where.actorId = actor.id;
    }
    if (filters.tenant) {
      const tenant = await prisma.tenant.findFirst({
        where: { OR: [{ slug: filters.tenant.toLowerCase() }, { id: filters.tenant }] },
        select: { id: true },
      });
      if (!tenant) return { status: "ok", rows: [], total: 0, filters, unmatchedFilter: "tenant" };
      where.tenantId = tenant.id;
    }

    const { records, total } = await queryAuditLogs(where, filters);
    const users = await loadUsers([...new Set(records.flatMap((r) => (r.actorId ? [r.actorId] : [])))]);
    const tenantIds = [...new Set(records.flatMap((r) => (r.tenantId ? [r.tenantId] : [])))];
    const tenants = new Map(
      (tenantIds.length > 0
        ? await prisma.tenant.findMany({ where: { id: { in: tenantIds } }, select: { id: true, name: true, slug: true } })
        : []
      ).map((t) => [t.id, t]),
    );

    const rows = records.map((record): AuditLogRowView => {
      let actor: AuditActorView = SYSTEM_ACTOR;
      if (record.actorId) {
        const user = users.get(record.actorId);
        if (!user) {
          actor = { id: record.actorId, kind: "DELETED", label: "Người dùng đã xoá", name: null };
        } else if (record.scope === "CUSTOMER") {
          // §7.9: hành động của khách trong 1 tenant — admin không thấy danh tính khách của tenant.
          actor = { id: record.actorId, kind: "CUSTOMER", label: maskEmail(user.email), name: null };
        } else {
          actor = {
            id: user.id,
            kind: user.systemRole === "SYSTEM_ADMIN" ? "ADMIN" : "USER",
            label: user.email,
            name: user.fullName,
          };
        }
      }
      const tenant = record.tenantId ? (tenants.get(record.tenantId) ?? { id: record.tenantId, name: null, slug: null }) : null;
      const hideRequestMeta = record.scope === "CUSTOMER";
      return {
        ...baseRow(record),
        actor,
        tenant,
        ip: hideRequestMeta ? null : record.ip,
        userAgent: hideRequestMeta ? null : record.userAgent,
      };
    });

    return { status: "ok", rows, total, filters, unmatchedFilter: null };
  } catch (error) {
    if (isAuditTableMissing(error)) return { status: "unavailable", filters };
    throw error;
  }
}

// ───────────────────────── Owner ─────────────────────────

/**
 * `/studio/{slug}/activity` — chỉ OWNER (`canManageTenant`) của đúng `tenantId` (kiểm lại ở đây qua tenant_members,
 * withTenant). Truy vấn luôn `where: { tenantId }`; bộ lọc actor/tenant của admin bị bỏ qua.
 */
export async function listTenantAuditLogs(tenantId: string, sp: AuditLogSearchParams): Promise<AuditLogListResult> {
  const user = await requireUser();
  const member = await withTenant(tenantId, (tx) =>
    tx.tenantMember.findUnique({ where: { tenantId_userId: { tenantId, userId: user.userId } }, select: { role: true } }),
  );
  if (!member || !canManageTenant(member.role)) throw forbidden("Bạn không có quyền xem nhật ký hoạt động của trang này.");

  const filters = { ...parseAuditLogFilters(sp), actor: "", tenant: "" };

  try {
    const where: Prisma.AuditLogWhereInput = { tenantId };
    if (filters.action) where.action = filters.action;
    const createdAt = createdAtWhere(filters);
    if (createdAt) where.createdAt = createdAt;

    const { records, total } = await queryAuditLogs(where, filters);
    const actorIds = [...new Set(records.flatMap((r) => (r.actorId ? [r.actorId] : [])))];
    const [users, members] = await Promise.all([
      loadUsers(actorIds),
      actorIds.length > 0
        ? withTenant(tenantId, (tx) => tx.tenantMember.findMany({ where: { tenantId, userId: { in: actorIds } }, select: { userId: true } }))
        : Promise.resolve([] as { userId: string }[]),
    ]);
    const memberIds = new Set(members.map((m) => m.userId));

    const rows = records.map((record): AuditLogRowView => {
      let actor: AuditActorView = SYSTEM_ACTOR;
      let isMember = false;
      if (record.actorId) {
        const actorUser = users.get(record.actorId);
        isMember = memberIds.has(record.actorId);
        if (isMember && actorUser) {
          actor = { id: actorUser.id, kind: "MEMBER", label: actorUser.email, name: actorUser.fullName };
        } else if (actorUser?.systemRole === "SYSTEM_ADMIN" || record.scope === "SYSTEM") {
          // Hành động cấp hệ thống (khoá tenant, xác nhận hoá đơn...) — không lộ admin cụ thể.
          actor = { id: null, kind: "ADMIN", label: "Quản trị hệ thống", name: null };
        } else if (actorUser) {
          // Khách hàng (hoặc người không còn là thành viên) — chỉ email đã che.
          actor = { id: null, kind: "USER", label: maskEmail(actorUser.email), name: null };
        } else {
          actor = { id: null, kind: "DELETED", label: "Người dùng đã xoá", name: null };
        }
      }
      return {
        ...baseRow(record),
        actor,
        tenant: null,
        ip: isMember ? record.ip : null,
        userAgent: isMember ? record.userAgent : null,
      };
    });

    return { status: "ok", rows, total, filters, unmatchedFilter: null };
  } catch (error) {
    if (isAuditTableMissing(error)) return { status: "unavailable", filters };
    throw error;
  }
}
