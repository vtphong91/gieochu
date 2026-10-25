import { AppError, forbidden, notFound, rateLimited } from "@gieochu/core";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import {
  EDITOR_DRAFT_ERROR_CODES,
  EDITOR_DRAFT_HTML_FIELDS,
  EDITOR_DRAFT_NEW_KEY,
  EDITOR_DRAFT_RATE_LIMIT,
  EDITOR_DRAFT_RETENTION_DAYS,
  LEGAL_DRAFT_NEW_PREFIX,
  isSystemEditorDraftEntity,
  isTenantEditorDraftEntity,
  isValidEditorDraftClientId,
  isValidEditorDraftKey,
  parseEditorDraftPayload,
  type EditorDraftEntityType,
  type EditorDraftPayload,
  type SystemEditorDraftEntityType,
  type TenantEditorDraftEntityType,
} from "@gieochu/core/editor-draft";
import { getPrismaClient, withSystemJob, withTenant, type Prisma, type Tx } from "@gieochu/db";
import { checkRateLimit } from "./rate-limit";
import { getSystemCloudinaryCloudName } from "./system-cloudinary";
import { assertTenantCanWrite } from "./tenant-write-guard";

/**
 * ADR-053 bổ sung lần 3 — nháp tự động của editor, lưu trên server, **theo từng người dùng**
 * (docs/ke-hoach-tu-luu-nhap-2026-10-24.md). Autosave KHÔNG BAO GIỜ ghi vào bản đã lưu/live.
 *
 * Hai phạm vi, hai bảng (không trộn L1/L2):
 *  - `{ kind: "TENANT", tenantId }` → `tenant_editor_drafts` (L2) qua `withTenant`, luôn lọc thêm `userId`.
 *  - `{ kind: "SYSTEM" }`             → `system_editor_drafts` (L1) qua `getPrismaClient()`.
 *
 * Nơi gọi (Server Action) PHẢI kiểm quyền mỗi lần trước khi gọi: `requireTenantMember(slug)` rồi truyền `tenant.id` +
 * `user.userId` lấy từ guard; System Center: `requireRole("SYSTEM_ADMIN")`. Module này kiểm thêm: loại/khoá thực thể đúng
 * phạm vi, thực thể thuộc tenant (POST/PRODUCT) hoặc có thật (LEGAL_VERSION ở trạng thái DRAFT), tenant ACTIVE (không
 * autosave khi READ_ONLY/LOCKED), rate limit, kích thước + zod "chế độ nháp", `sanitizeRichTextHtml` cho field HTML.
 *
 * Không ghi audit mỗi lần autosave; không log payload.
 *
 * Xung đột nhiều tab: mỗi lần lưu tăng `revision`. Client gửi `expectedRevision` (revision nó biết, `null` = chưa có nháp)
 * + `clientId` (tab). Lệch revision → `DRAFT_CONFLICT` (409), trừ khi dòng hiện tại do CHÍNH tab đó ghi (phản hồi lần trước
 * bị mất) hoặc client chọn "Ghi đè" (`overwrite: true`).
 */

export type EditorDraftScope = { kind: "TENANT"; tenantId: string } | { kind: "SYSTEM" };

export interface EditorDraftRef {
  entityType: EditorDraftEntityType;
  entityKey: string;
}

export interface EditorDraftView {
  payload: EditorDraftPayload;
  revision: number;
  clientId: string;
  baseUpdatedAt: Date | null;
  updatedAt: Date;
}

export interface SaveEditorDraftInput extends EditorDraftRef {
  payload: unknown;
  clientId: unknown;
  /** Revision client đang giữ; `null` = client chưa biết nháp nào. */
  expectedRevision: unknown;
  /** `updatedAt` của bản đã lưu mà form đang dựa vào (null với thực thể mới). */
  baseUpdatedAt?: unknown;
  /** "Ghi đè" sau xung đột — bỏ qua kiểm revision. */
  overwrite?: boolean;
}

export interface SaveEditorDraftResult {
  revision: number;
  updatedAt: Date;
}

const DRAFT_SELECT = { payload: true, revision: true, clientId: true, baseUpdatedAt: true, updatedAt: true } as const;

function invalid(message = "Bản nháp không hợp lệ."): AppError {
  return new AppError({ code: EDITOR_DRAFT_ERROR_CODES.INVALID, message, httpStatus: 400 });
}

function draftConflict(): AppError {
  return new AppError({
    code: EDITOR_DRAFT_ERROR_CODES.CONFLICT,
    message: "Bản nháp vừa được lưu ở một tab hoặc thiết bị khác.",
    httpStatus: 409,
  });
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002";
}

function assertRef(scope: EditorDraftScope, ref: EditorDraftRef): void {
  const typeOk = scope.kind === "TENANT" ? isTenantEditorDraftEntity(ref.entityType) : isSystemEditorDraftEntity(ref.entityType);
  if (!typeOk || !isValidEditorDraftKey(ref.entityType, ref.entityKey)) throw invalid();
  if (scope.kind === "TENANT" && (typeof scope.tenantId !== "string" || scope.tenantId.length === 0)) throw invalid();
}

function parseExpectedRevision(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 1) return value;
  throw invalid();
}

function parseBaseUpdatedAt(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  const date = value instanceof Date ? value : typeof value === "string" ? new Date(value) : null;
  if (!date || Number.isNaN(date.getTime())) throw invalid();
  return date;
}

function scopeKey(scope: EditorDraftScope): string {
  return scope.kind === "TENANT" ? `t:${scope.tenantId}` : "s";
}

async function sanitizeHtmlFields(entityType: EditorDraftEntityType, payload: EditorDraftPayload): Promise<EditorDraftPayload> {
  const fields = EDITOR_DRAFT_HTML_FIELDS[entityType].filter((name) => typeof payload[name] === "string" && payload[name] !== "");
  if (fields.length === 0) return payload;
  // Pháp lý không cho ảnh (khớp lib/legal.ts); còn lại chỉ giữ ảnh Cloudinary hệ thống.
  const imageCloudName = entityType === "LEGAL_VERSION" ? null : await getSystemCloudinaryCloudName();
  const result: EditorDraftPayload = { ...payload };
  for (const name of fields) result[name] = sanitizeRichTextHtml(payload[name] as string, { imageCloudName });
  return result;
}

/** POST/PRODUCT có id: thực thể phải thuộc đúng tenant (đọc dưới RLS tenant). */
async function assertTenantEntity(tx: Tx, tenantId: string, entityType: TenantEditorDraftEntityType, entityKey: string): Promise<void> {
  if (entityType === "STOREFRONT" || entityKey === EDITOR_DRAFT_NEW_KEY) return;
  const found =
    entityType === "POST"
      ? await tx.post.findFirst({ where: { id: entityKey, tenantId }, select: { id: true } })
      : await tx.product.findFirst({ where: { id: entityKey, tenantId }, select: { id: true } });
  if (!found) throw notFound("Không tìm thấy nội dung đang soạn.");
}

/** LEGAL_VERSION có id: phiên bản phải tồn tại và còn là DRAFT (PUBLISHED/ARCHIVED bất biến nội dung). */
async function assertSystemEntity(entityType: SystemEditorDraftEntityType, entityKey: string): Promise<void> {
  if (entityType !== "LEGAL_VERSION" || entityKey.startsWith(LEGAL_DRAFT_NEW_PREFIX)) return;
  const version = await getPrismaClient().legalDocumentVersion.findUnique({ where: { id: entityKey }, select: { status: true } });
  if (!version || version.status !== "DRAFT") throw notFound("Không tìm thấy phiên bản nháp.");
}

// ───────────────────────── Đọc ─────────────────────────

export async function getDraft(scope: EditorDraftScope, userId: string, ref: EditorDraftRef): Promise<EditorDraftView | null> {
  assertRef(scope, ref);
  const row =
    scope.kind === "TENANT"
      ? await withTenant(scope.tenantId, (tx) =>
          tx.tenantEditorDraft.findUnique({
            where: {
              tenantId_userId_entityType_entityKey: {
                tenantId: scope.tenantId,
                userId,
                entityType: ref.entityType as TenantEditorDraftEntityType,
                entityKey: ref.entityKey,
              },
            },
            select: DRAFT_SELECT,
          }),
        )
      : await getPrismaClient().systemEditorDraft.findUnique({
          where: { userId_entityType_entityKey: { userId, entityType: ref.entityType as SystemEditorDraftEntityType, entityKey: ref.entityKey } },
          select: DRAFT_SELECT,
        });
  if (!row) return null;
  return { ...row, payload: (row.payload ?? {}) as EditorDraftPayload };
}

// ───────────────────────── Ghi ─────────────────────────

interface DraftWrite {
  payload: Prisma.InputJsonValue;
  clientId: string;
  baseUpdatedAt: Date | null;
}

interface ExistingDraft {
  revision: number;
  clientId: string;
}

/** Quyết định ghi đè / xung đột với dòng hiện có (null = chưa có nháp). */
function checkRevision(existing: ExistingDraft | null, expected: number | null, clientId: string, overwrite: boolean): void {
  if (overwrite) return;
  if (!existing) {
    // Client tưởng còn nháp nhưng nháp đã bị xoá (Lưu/Bỏ ở tab khác) → báo xung đột thay vì âm thầm tạo lại.
    if (expected !== null) throw draftConflict();
    return;
  }
  if (existing.revision === expected) return;
  if (existing.clientId === clientId) return; // Chính tab này ghi lần trước (phản hồi bị mất).
  throw draftConflict();
}

export async function saveDraft(scope: EditorDraftScope, userId: string, input: SaveEditorDraftInput): Promise<SaveEditorDraftResult> {
  const ref: EditorDraftRef = { entityType: input.entityType, entityKey: input.entityKey };
  assertRef(scope, ref);
  if (!isValidEditorDraftClientId(input.clientId)) throw invalid();
  const clientId = input.clientId;
  const expected = parseExpectedRevision(input.expectedRevision);
  const baseUpdatedAt = parseBaseUpdatedAt(input.baseUpdatedAt);
  const overwrite = input.overwrite === true;

  if (!checkRateLimit(`editor-draft:${scopeKey(scope)}:${userId}:${ref.entityType}:${ref.entityKey}`, EDITOR_DRAFT_RATE_LIMIT.limit, EDITOR_DRAFT_RATE_LIMIT.windowMs)) {
    throw rateLimited("Tự lưu quá dày, sẽ thử lại sau ít giây.");
  }

  if (scope.kind === "TENANT") {
    const tenant = await getPrismaClient().tenant.findUnique({ where: { id: scope.tenantId }, select: { status: true } });
    if (!tenant) throw forbidden();
    assertTenantCanWrite(tenant);
  }

  const parsed = parseEditorDraftPayload(ref.entityType, input.payload);
  if (!parsed.ok) throw new AppError({ code: parsed.code, message: parsed.message, httpStatus: parsed.code === EDITOR_DRAFT_ERROR_CODES.TOO_LARGE ? 413 : 400 });
  const write: DraftWrite = {
    payload: (await sanitizeHtmlFields(ref.entityType, parsed.payload)) as Prisma.InputJsonValue,
    clientId,
    baseUpdatedAt,
  };

  try {
    return scope.kind === "TENANT"
      ? await saveTenantDraft(scope.tenantId, userId, ref.entityType as TenantEditorDraftEntityType, ref.entityKey, write, expected, overwrite)
      : await saveSystemDraft(userId, ref.entityType as SystemEditorDraftEntityType, ref.entityKey, write, expected, overwrite);
  } catch (error) {
    // Hai request tạo cùng lúc (2 tab, chưa ai có nháp) — bên thua nhận xung đột.
    if (isUniqueViolation(error)) throw draftConflict();
    throw error;
  }
}

async function saveTenantDraft(
  tenantId: string,
  userId: string,
  entityType: TenantEditorDraftEntityType,
  entityKey: string,
  write: DraftWrite,
  expected: number | null,
  overwrite: boolean,
): Promise<SaveEditorDraftResult> {
  return withTenant(tenantId, async (tx) => {
    await assertTenantEntity(tx, tenantId, entityType, entityKey);
    const where = { tenantId_userId_entityType_entityKey: { tenantId, userId, entityType, entityKey } };
    const existing = await tx.tenantEditorDraft.findUnique({ where, select: { revision: true, clientId: true } });
    checkRevision(existing, expected, write.clientId, overwrite);
    if (!existing) {
      return tx.tenantEditorDraft.create({
        data: { tenantId, userId, entityType, entityKey, ...write, revision: 1 },
        select: { revision: true, updatedAt: true },
      });
    }
    // Điều kiện revision trong WHERE: request song song đọc cùng `existing` thì chỉ một bên cập nhật được.
    const updated = await tx.tenantEditorDraft.updateMany({
      where: { tenantId, userId, entityType, entityKey, revision: existing.revision },
      data: { ...write, revision: existing.revision + 1 },
    });
    if (updated.count === 0) throw draftConflict();
    return { revision: existing.revision + 1, updatedAt: await tenantUpdatedAt(tx, where) };
  });
}

async function tenantUpdatedAt(
  tx: Tx,
  where: Prisma.TenantEditorDraftWhereUniqueInput,
): Promise<Date> {
  const row = await tx.tenantEditorDraft.findUniqueOrThrow({ where, select: { updatedAt: true } });
  return row.updatedAt;
}

async function saveSystemDraft(
  userId: string,
  entityType: SystemEditorDraftEntityType,
  entityKey: string,
  write: DraftWrite,
  expected: number | null,
  overwrite: boolean,
): Promise<SaveEditorDraftResult> {
  await assertSystemEntity(entityType, entityKey);
  return getPrismaClient().$transaction(async (tx) => {
    const where = { userId_entityType_entityKey: { userId, entityType, entityKey } };
    const existing = await tx.systemEditorDraft.findUnique({ where, select: { revision: true, clientId: true } });
    checkRevision(existing, expected, write.clientId, overwrite);
    if (!existing) {
      return tx.systemEditorDraft.create({
        data: { userId, entityType, entityKey, ...write, revision: 1 },
        select: { revision: true, updatedAt: true },
      });
    }
    const updated = await tx.systemEditorDraft.updateMany({
      where: { userId, entityType, entityKey, revision: existing.revision },
      data: { ...write, revision: existing.revision + 1 },
    });
    if (updated.count === 0) throw draftConflict();
    const row = await tx.systemEditorDraft.findUniqueOrThrow({ where, select: { updatedAt: true } });
    return { revision: existing.revision + 1, updatedAt: row.updatedAt };
  });
}

// ───────────────────────── Xoá ─────────────────────────

/**
 * Xoá nháp của chính người dùng — gọi khi Lưu nháp / Lưu / Xuất bản / Khôi phục live / Bỏ / xoá thực thể. Không chặn tenant
 * READ_ONLY (xoá dữ liệu của chính mình), không lỗi khi không có nháp.
 */
export async function discardDraft(scope: EditorDraftScope, userId: string, ref: EditorDraftRef): Promise<void> {
  assertRef(scope, ref);
  if (scope.kind === "TENANT") {
    await withTenant(scope.tenantId, (tx) =>
      tx.tenantEditorDraft.deleteMany({
        where: { tenantId: scope.tenantId, userId, entityType: ref.entityType as TenantEditorDraftEntityType, entityKey: ref.entityKey },
      }),
    );
    return;
  }
  await getPrismaClient().systemEditorDraft.deleteMany({
    where: { userId, entityType: ref.entityType as SystemEditorDraftEntityType, entityKey: ref.entityKey },
  });
}

// ───────────────────────── Cron dọn ─────────────────────────

/**
 * Cron `/api/cron/daily` (bước 9 kế hoạch — chưa gắn): xoá nháp không động tới quá 30 ngày và nháp mồ côi:
 *  - Studio: bài viết / tài liệu đã bị xoá (khoá khác `"new"` mà không còn dòng cùng tenant). Bảng L2 qua `withSystemJob`
 *    (posts/products có nhánh SELECT system_job nên NOT EXISTS thấy đúng dữ liệu).
 *  - System Center: phiên bản pháp lý không còn hoặc không còn DRAFT; người dùng không còn là SYSTEM_ADMIN.
 * Trả số đếm (không dữ liệu cá nhân).
 */
export async function purgeStaleDrafts(now: Date = new Date()): Promise<{ tenantDeleted: number; systemDeleted: number }> {
  const cutoff = new Date(now.getTime() - EDITOR_DRAFT_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  const tenantDeleted = await withSystemJob(
    (tx) => tx.$executeRaw`
      DELETE FROM "tenant_editor_drafts" d
      WHERE d."updatedAt" < ${cutoff}
         OR (d."entityType" = 'POST' AND d."entityKey" <> ${EDITOR_DRAFT_NEW_KEY}
             AND NOT EXISTS (SELECT 1 FROM "posts" p WHERE p."id" = d."entityKey" AND p."tenantId" = d."tenantId"))
         OR (d."entityType" = 'PRODUCT' AND d."entityKey" <> ${EDITOR_DRAFT_NEW_KEY}
             AND NOT EXISTS (SELECT 1 FROM "products" p WHERE p."id" = d."entityKey" AND p."tenantId" = d."tenantId"))`,
  );
  const systemDeleted = await getPrismaClient().$executeRaw`
    DELETE FROM "system_editor_drafts" d
    WHERE d."updatedAt" < ${cutoff}
       OR NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = d."userId" AND u."systemRole" = 'SYSTEM_ADMIN')
       OR (d."entityType" = 'LEGAL_VERSION' AND d."entityKey" NOT LIKE ${`${LEGAL_DRAFT_NEW_PREFIX}%`}
           AND NOT EXISTS (SELECT 1 FROM "legal_document_versions" v WHERE v."id" = d."entityKey" AND v."status" = 'DRAFT'))`;
  return { tenantDeleted, systemDeleted };
}
