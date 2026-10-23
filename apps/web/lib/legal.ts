import {
  AppError,
  LEGAL_CHANGE_SUMMARY_MAX,
  LEGAL_CONTENT_MAX,
  LEGAL_EFFECTIVE_BACKDATE_TOLERANCE_MS,
  LEGAL_ERROR_CODES,
  LEGAL_PUBLISH_BLOCKER_MESSAGES,
  legalPublishBlockers,
  type LegalReviewStatusValue,
} from "@gieochu/core";
import { sanitizeRichTextHtml } from "@gieochu/core/content/sanitize-html";
import { getPrismaClient, Prisma } from "@gieochu/db";

/**
 * ADR-050 mục 3 (+ bổ sung) — văn bản pháp lý có phiên bản. Cả 3 bảng là L1 (không `tenantId`, không RLS) → đọc/ghi
 * bằng `getPrismaClient()`. Hàm GHI ở đây không tự kiểm quyền: Server Action (`app/admin/cms/phap-ly/actions.ts`) phải
 * `requireRole("SYSTEM_ADMIN")` trước và ghi audit sau.
 *
 * Luật:
 *  - Nội dung luôn sanitize khi lưu (`sanitizeRichTextHtml`, không cho ảnh) và sanitize lại khi render.
 *  - Chỉ sửa được bản DRAFT (trigger DB `legal_document_versions_freeze_content` là lớp thứ hai).
 *  - Xuất bản: phải là DRAFT + `reviewStatus = APPROVED` + không còn `[[CẦN XÁC NHẬN` + có nội dung; kiểm lại ngay trong
 *    câu UPDATE (điều kiện `updatedAt` không đổi) để không lọt thay đổi xen giữa lúc kiểm và lúc ghi.
 *  - Bản hiệu lực = PUBLISHED có `effectiveAt <= now` mới nhất; nhiều bản PUBLISHED cùng lúc được phép; lưu trữ là
 *    thao tác riêng (PUBLISHED → ARCHIVED).
 */

export interface LegalDocumentSpec {
  key: string;
  slug: string;
  title: string;
}

export interface LegalVersionRow {
  id: string;
  version: number;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  reviewStatus: LegalReviewStatusValue;
  contentHtml: string;
  changeSummary: string | null;
  effectiveAt: Date | null;
  publishedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface EffectiveLegalVersion {
  documentId: string;
  key: string;
  slug: string;
  title: string;
  versionId: string;
  version: number;
  /** HTML đã sanitize lúc lưu — trang công khai vẫn sanitize lại + thay `{brand}`. */
  contentHtml: string;
  effectiveAt: Date;
  publishedAt: Date | null;
}

const VERSION_SELECT = {
  id: true,
  version: true,
  status: true,
  reviewStatus: true,
  contentHtml: true,
  changeSummary: true,
  effectiveAt: true,
  publishedAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function legalError(code: string, message: string, httpStatus = 422): AppError {
  return new AppError({ code, message, httpStatus });
}

/** Sanitize nội dung văn bản pháp lý (không cho ảnh: `imageCloudName = null`). */
export function sanitizeLegalHtml(html: string): string {
  return sanitizeRichTextHtml(html, { imageCloudName: null });
}

function normalizeContent(contentHtml: unknown): string {
  if (typeof contentHtml !== "string") throw legalError(LEGAL_ERROR_CODES.INVALID_INPUT, "Nội dung không hợp lệ.", 400);
  const clean = sanitizeLegalHtml(contentHtml);
  if (clean.length > LEGAL_CONTENT_MAX) throw legalError(LEGAL_ERROR_CODES.INVALID_INPUT, `Nội dung quá dài (tối đa ${LEGAL_CONTENT_MAX} ký tự).`, 400);
  return clean;
}

function normalizeSummary(changeSummary: unknown): string | null {
  if (changeSummary === undefined || changeSummary === null) return null;
  if (typeof changeSummary !== "string") throw legalError(LEGAL_ERROR_CODES.INVALID_INPUT, "Tóm tắt thay đổi không hợp lệ.", 400);
  const value = changeSummary.trim();
  if (value.length > LEGAL_CHANGE_SUMMARY_MAX) throw legalError(LEGAL_ERROR_CODES.INVALID_INPUT, `Tóm tắt thay đổi tối đa ${LEGAL_CHANGE_SUMMARY_MAX} ký tự.`, 400);
  return value || null;
}

/** Dòng `legal_documents` theo khoá (tạo nếu chưa có — lần đầu admin tạo bản nháp; không seed). */
export async function ensureLegalDocument(spec: LegalDocumentSpec): Promise<{ id: string }> {
  return getPrismaClient().legalDocument.upsert({
    where: { key: spec.key },
    update: {},
    create: { key: spec.key, slug: spec.slug, title: spec.title },
    select: { id: true },
  });
}

/** Mọi phiên bản của văn bản (mới nhất trước) — cho editor. Chưa có dòng văn bản → []. */
export async function listLegalVersions(key: string): Promise<LegalVersionRow[]> {
  const doc = await getPrismaClient().legalDocument.findUnique({
    where: { key },
    select: { versions: { select: VERSION_SELECT, orderBy: { version: "desc" } } },
  });
  return doc?.versions ?? [];
}

/** Bản đang hiệu lực (PUBLISHED, `effectiveAt <= now`, mới nhất); `null` = chưa có. */
export async function getEffectiveLegalVersion(key: string, now: Date = new Date()): Promise<EffectiveLegalVersion | null> {
  const row = await getPrismaClient().legalDocumentVersion.findFirst({
    where: { status: "PUBLISHED", effectiveAt: { lte: now }, document: { key } },
    orderBy: [{ effectiveAt: "desc" }, { version: "desc" }],
    select: {
      id: true,
      version: true,
      contentHtml: true,
      effectiveAt: true,
      publishedAt: true,
      document: { select: { id: true, key: true, slug: true, title: true } },
    },
  });
  if (!row || !row.effectiveAt) return null;
  return {
    documentId: row.document.id,
    key: row.document.key,
    slug: row.document.slug,
    title: row.document.title,
    versionId: row.id,
    version: row.version,
    contentHtml: row.contentHtml,
    effectiveAt: row.effectiveAt,
    publishedAt: row.publishedAt,
  };
}

/** Tạo phiên bản nháp mới (số = lớn nhất + 1). Nội dung trống được phép (soạn dần). */
export async function createLegalDraft(spec: LegalDocumentSpec, input: { contentHtml: unknown; changeSummary?: unknown; actorId: string }): Promise<LegalVersionRow> {
  const contentHtml = normalizeContent(input.contentHtml);
  const changeSummary = normalizeSummary(input.changeSummary);
  const doc = await ensureLegalDocument(spec);
  const prisma = getPrismaClient();
  try {
    return await prisma.$transaction(async (tx) => {
      const last = await tx.legalDocumentVersion.findFirst({ where: { documentId: doc.id }, orderBy: { version: "desc" }, select: { version: true } });
      return tx.legalDocumentVersion.create({
        data: { documentId: doc.id, version: (last?.version ?? 0) + 1, contentHtml, changeSummary, createdById: input.actorId },
        select: VERSION_SELECT,
      });
    });
  } catch (error) {
    // Hai admin tạo cùng lúc → unique (documentId, version).
    if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2002") {
      throw legalError(LEGAL_ERROR_CODES.CONFLICT, "Có phiên bản khác vừa được tạo, tải lại trang rồi thử lại.", 409);
    }
    throw error;
  }
}

async function loadVersion(key: string, versionId: string): Promise<LegalVersionRow> {
  const row = await getPrismaClient().legalDocumentVersion.findFirst({ where: { id: versionId, document: { key } }, select: VERSION_SELECT });
  if (!row) throw legalError(LEGAL_ERROR_CODES.NOT_FOUND, "Không tìm thấy phiên bản.", 404);
  return row;
}

/** Sửa nội dung / tóm tắt của bản nháp. Đổi nội dung → rà soát quay về PENDING (bản đã duyệt không còn là bản này). */
export async function updateLegalDraft(key: string, versionId: string, input: { contentHtml: unknown; changeSummary?: unknown }): Promise<LegalVersionRow> {
  const current = await loadVersion(key, versionId);
  if (current.status !== "DRAFT") throw legalError(LEGAL_ERROR_CODES.NOT_DRAFT, "Chỉ sửa được bản nháp — muốn thay đổi hãy tạo phiên bản mới.", 409);
  const contentHtml = normalizeContent(input.contentHtml);
  const changeSummary = normalizeSummary(input.changeSummary);
  const contentChanged = contentHtml !== current.contentHtml;
  const result = await getPrismaClient().legalDocumentVersion.updateMany({
    where: { id: versionId, status: "DRAFT", updatedAt: current.updatedAt },
    data: { contentHtml, changeSummary, ...(contentChanged ? { reviewStatus: "PENDING_LEGAL_REVIEW" as const } : {}) },
  });
  if (result.count === 0) throw legalError(LEGAL_ERROR_CODES.CONFLICT, "Phiên bản vừa được thay đổi ở nơi khác, tải lại trang rồi thử lại.", 409);
  return loadVersion(key, versionId);
}

/** Đặt trạng thái rà soát của bản nháp (admin tích "đã rà soát pháp lý" hoặc bỏ tích). */
export async function setLegalReviewStatus(key: string, versionId: string, reviewStatus: LegalReviewStatusValue): Promise<LegalVersionRow> {
  const current = await loadVersion(key, versionId);
  if (current.status !== "DRAFT") throw legalError(LEGAL_ERROR_CODES.NOT_DRAFT, "Chỉ đổi trạng thái rà soát của bản nháp.", 409);
  const result = await getPrismaClient().legalDocumentVersion.updateMany({
    where: { id: versionId, status: "DRAFT", updatedAt: current.updatedAt },
    data: { reviewStatus },
  });
  if (result.count === 0) throw legalError(LEGAL_ERROR_CODES.CONFLICT, "Phiên bản vừa được thay đổi ở nơi khác, tải lại trang rồi thử lại.", 409);
  return loadVersion(key, versionId);
}

/**
 * Xuất bản bản nháp với ngày hiệu lực (`null` = ngay bây giờ; không cho lùi về quá khứ). Server kiểm lại CẢ
 * `reviewStatus = APPROVED` VÀ không còn placeholder; câu UPDATE kèm lại điều kiện để không lọt sửa đổi xen giữa.
 */
export async function publishLegalVersion(key: string, versionId: string, input: { effectiveAt: Date | null; actorId: string; now?: Date }): Promise<LegalVersionRow> {
  const now = input.now ?? new Date();
  const current = await loadVersion(key, versionId);
  const blockers = legalPublishBlockers(current);
  if (blockers.length > 0) {
    throw legalError(LEGAL_ERROR_CODES.PUBLISH_BLOCKED, blockers.map((blocker) => LEGAL_PUBLISH_BLOCKER_MESSAGES[blocker]).join(" "), 422);
  }
  const effectiveAt = input.effectiveAt ?? now;
  if (effectiveAt.getTime() < now.getTime() - LEGAL_EFFECTIVE_BACKDATE_TOLERANCE_MS) {
    throw legalError(LEGAL_ERROR_CODES.INVALID_INPUT, "Ngày hiệu lực không được ở quá khứ.", 400);
  }
  const result = await getPrismaClient().legalDocumentVersion.updateMany({
    where: { id: versionId, status: "DRAFT", reviewStatus: "APPROVED", updatedAt: current.updatedAt },
    data: { status: "PUBLISHED", effectiveAt, publishedAt: now, publishedById: input.actorId },
  });
  if (result.count === 0) throw legalError(LEGAL_ERROR_CODES.CONFLICT, "Phiên bản vừa được thay đổi ở nơi khác, tải lại trang rồi thử lại.", 409);
  return loadVersion(key, versionId);
}

/** Lưu trữ bản đã xuất bản (PUBLISHED → ARCHIVED). Lưu trữ bản đang hiệu lực mà không còn bản nào khác → văn bản "trống". */
export async function archiveLegalVersion(key: string, versionId: string): Promise<LegalVersionRow> {
  const current = await loadVersion(key, versionId);
  if (current.status !== "PUBLISHED") throw legalError(LEGAL_ERROR_CODES.NOT_PUBLISHED, "Chỉ lưu trữ được bản đã xuất bản.", 409);
  await getPrismaClient().legalDocumentVersion.updateMany({ where: { id: versionId, status: "PUBLISHED" }, data: { status: "ARCHIVED" } });
  return loadVersion(key, versionId);
}

// ───────────────────────── Chấp thuận lúc đăng ký ─────────────────────────

/**
 * Chọn phiên bản Điều khoản phải ghi chấp thuận khi đăng ký. Client gửi `termsVersionId` (bản người dùng đã thấy trên
 * form): khác bản đang hiệu lực → 409 (Điều khoản vừa đổi, tải lại). Client không gửi (form cũ còn cache) → dùng bản
 * đang hiệu lực (người dùng vẫn tích ô đồng ý). Chưa có bản hiệu lực → `null` (đăng ký như trước ADR-050).
 */
export function resolveRegistrationTermsVersion(effective: EffectiveLegalVersion | null, submittedVersionId: string | undefined): string | null {
  if (!effective) return null;
  if (submittedVersionId && submittedVersionId !== effective.versionId) {
    throw legalError(LEGAL_ERROR_CODES.TERMS_CHANGED, "Điều khoản sử dụng vừa được cập nhật. Vui lòng tải lại trang, đọc bản mới rồi đăng ký lại.", 409);
  }
  return effective.versionId;
}

/** Ghi chấp thuận trong giao dịch đang mở (cùng giao dịch tạo user). Không lưu IP/User-Agent (ADR-050). */
export async function recordLegalAcceptance(tx: Prisma.TransactionClient, userId: string, versionId: string, acceptedAt: Date): Promise<void> {
  await tx.userLegalAcceptance.create({ data: { userId, versionId, acceptedAt } });
}
