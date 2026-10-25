import { cache } from "react";
import { z } from "zod";
import { getEnv } from "@gieochu/config";
import {
  AppError,
  cmsSeoSchema,
  isLegalDocumentKey,
  LEGAL_CHANGE_SUMMARY_MAX,
  LEGAL_CONTENT_MAX,
  LEGAL_EFFECTIVE_BACKDATE_TOLERANCE_MS,
  LEGAL_ERROR_CODES,
  LEGAL_PUBLISH_BLOCKER_MESSAGES,
  LEGAL_SUMMARY_MAX,
  legalPublishBlockers,
  type LegalDocumentKey,
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

function siteOrigin(): string | null {
  try {
    return new URL(getEnv().APP_URL).origin;
  } catch {
    return null;
  }
}

/**
 * Sanitize nội dung văn bản pháp lý (không cho ảnh: `imageCloudName = null`). ADR-054 mục 7: chế độ `trustedLinks` — link
 * nội bộ (đường dẫn `/…`, `#…`, cùng origin `APP_URL`) mở cùng tab, link ngoài `target="_blank" rel="noopener noreferrer"`.
 * Chỉ áp cho văn bản pháp lý (System Admin soạn) — nội dung tenant giữ nguyên hành vi cũ.
 */
export function sanitizeLegalHtml(html: string): string {
  return sanitizeRichTextHtml(html, { imageCloudName: null, trustedLinks: { siteOrigin: siteOrigin() } });
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

/** Bảng văn bản pháp lý chưa tồn tại (code chạy trước khi áp migration ADR-050). */
export function isLegalTableMissing(error: unknown): boolean {
  if (typeof error === "object" && error !== null && (error as { code?: unknown }).code === "P2021") return true;
  const text = error instanceof Error ? `${error.message} ${String((error as { cause?: unknown }).cause ?? "")}` : String(error);
  return /42P01|legal_document.*does not exist|does not exist.*legal_document/i.test(text);
}

/** Bản đang hiệu lực (PUBLISHED, `effectiveAt <= now`, mới nhất); `null` = chưa có. */
export async function getEffectiveLegalVersion(key: string, now: Date = new Date()): Promise<EffectiveLegalVersion | null> {
  try {
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
  } catch (error) {
    if (isLegalTableMissing(error)) return null;
    throw error;
  }
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

// ───────────────────────── Mô tả ngắn + SEO (ADR-054 mục 4) ─────────────────────────

export interface LegalDocumentMeta {
  title: string;
  summary: string | null;
  seoTitle: string | null;
  seoDescription: string | null;
}

/**
 * Mô tả ngắn + SEO của văn bản (cột trên `legal_documents`, không theo phiên bản). Chưa có dòng (chưa tạo nháp nào) →
 * `null`. Đọc riêng, KHÔNG gộp vào `getEffectiveLegalVersion` (đăng ký dùng hàm đó — không phụ thuộc cột mới).
 */
export async function getLegalDocumentMeta(key: string): Promise<LegalDocumentMeta | null> {
  return getPrismaClient().legalDocument.findUnique({
    where: { key },
    select: { title: true, summary: true, seoTitle: true, seoDescription: true },
  });
}

const legalMetaSchema = cmsSeoSchema.extend({
  summary: z.string().trim().max(LEGAL_SUMMARY_MAX, `Mô tả ngắn tối đa ${LEGAL_SUMMARY_MAX} ký tự.`),
});

/**
 * Lưu thẳng mô tả ngắn + SEO (không nháp — như SEO trang chủ, ADR-050 lần 2): trim, giới hạn độ dài, chuỗi rỗng → `null`.
 * Tạo dòng văn bản nếu chưa có (cho phép soạn SEO trước khi có phiên bản). Caller phải `requireRole("SYSTEM_ADMIN")`.
 */
export async function updateLegalDocumentMeta(spec: LegalDocumentSpec, input: unknown): Promise<LegalDocumentMeta> {
  const parsed = legalMetaSchema.safeParse(input);
  if (!parsed.success) throw legalError(LEGAL_ERROR_CODES.INVALID_INPUT, parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.", 400);
  const doc = await ensureLegalDocument(spec);
  return getPrismaClient().legalDocument.update({
    where: { id: doc.id },
    data: {
      summary: parsed.data.summary || null,
      seoTitle: parsed.data.seoTitle || null,
      seoDescription: parsed.data.seoDescription || null,
    },
    select: { title: true, summary: true, seoTitle: true, seoDescription: true },
  });
}

export type LegalDocumentAdminStatus = "NONE" | "DRAFT_ONLY" | "EFFECTIVE" | "SCHEDULED";

/**
 * Trạng thái từng văn bản cho bộ chọn của editor (một truy vấn, không đọc nội dung): chưa có phiên bản / chỉ có nháp /
 * đang hiệu lực / chỉ có bản hẹn hiệu lực tương lai; kèm cờ có bản nháp. Khoá trong DB không còn khai báo bị bỏ.
 */
export async function listLegalDocumentStatuses(now: Date = new Date()): Promise<Map<LegalDocumentKey, { status: LegalDocumentAdminStatus; hasDraft: boolean }>> {
  const docs = await getPrismaClient().legalDocument.findMany({
    select: { key: true, versions: { select: { status: true, effectiveAt: true } } },
  });
  const result = new Map<LegalDocumentKey, { status: LegalDocumentAdminStatus; hasDraft: boolean }>();
  for (const doc of docs) {
    if (!isLegalDocumentKey(doc.key)) continue;
    const published = doc.versions.filter((v) => v.status === "PUBLISHED" && v.effectiveAt);
    const effective = published.some((v) => v.effectiveAt!.getTime() <= now.getTime());
    const scheduled = published.some((v) => v.effectiveAt!.getTime() > now.getTime());
    const hasDraft = doc.versions.some((v) => v.status === "DRAFT");
    const status: LegalDocumentAdminStatus = effective ? "EFFECTIVE" : scheduled ? "SCHEDULED" : hasDraft ? "DRAFT_ONLY" : "NONE";
    result.set(doc.key, { status, hasDraft });
  }
  return result;
}

// ───────────────────────── Văn bản đang hiệu lực (menu, link) ─────────────────────────

/**
 * Khoá các văn bản ĐÃ KHAI BÁO trong code đang có bản hiệu lực — MỘT truy vấn, `cache()` theo request (header + footer +
 * form cùng trang chỉ đọc một lần). Dùng để ẩn link menu/footer tới văn bản chưa hiệu lực (ADR-054 mục 3, 6).
 */
export const getEffectiveLegalKeys = cache(async function getEffectiveLegalKeys(): Promise<ReadonlySet<LegalDocumentKey>> {
  const rows = await getPrismaClient().legalDocument.findMany({
    where: { versions: { some: { status: "PUBLISHED", effectiveAt: { lte: new Date() } } } },
    select: { key: true },
  });
  return new Set(rows.map((row) => row.key).filter(isLegalDocumentKey));
});

// ───────────────────────── Chấp thuận theo phiên bản ─────────────────────────

/**
 * Chọn phiên bản phải ghi chấp thuận. Client gửi id bản người dùng đã thấy trên form: khác bản đang hiệu lực → 409 (văn
 * bản vừa đổi, tải lại). Client không gửi (form cũ còn cache) → dùng bản đang hiệu lực (người dùng vẫn tích ô đồng ý).
 * Chưa có bản hiệu lực → `null` (bỏ qua như trước ADR-050).
 */
export function resolveAcceptedLegalVersion(
  effective: EffectiveLegalVersion | null,
  submittedVersionId: string | undefined,
  changed: { code: string; message: string },
): string | null {
  if (!effective) return null;
  if (submittedVersionId && submittedVersionId !== effective.versionId) throw legalError(changed.code, changed.message, 409);
  return effective.versionId;
}

/** Phiên bản Điều khoản ghi khi đăng ký (giữ mã lỗi `LEGAL_TERMS_CHANGED` của ADR-050). */
export function resolveRegistrationTermsVersion(effective: EffectiveLegalVersion | null, submittedVersionId: string | undefined): string | null {
  return resolveAcceptedLegalVersion(effective, submittedVersionId, {
    code: LEGAL_ERROR_CODES.TERMS_CHANGED,
    message: "Điều khoản sử dụng vừa được cập nhật. Vui lòng tải lại trang, đọc bản mới rồi đăng ký lại.",
  });
}

/** ADR-054 mục 5: phiên bản Chính sách bảo mật ghi khi đăng ký (cùng ô đồng ý với Điều khoản). */
export function resolveRegistrationPrivacyVersion(effective: EffectiveLegalVersion | null, submittedVersionId: string | undefined): string | null {
  return resolveAcceptedLegalVersion(effective, submittedVersionId, {
    code: LEGAL_ERROR_CODES.DOCUMENT_CHANGED,
    message: "Chính sách bảo mật vừa được cập nhật. Vui lòng tải lại trang, đọc bản mới rồi đăng ký lại.",
  });
}

/**
 * ADR-054 mục 5: Chính sách người bán khi mở gian hàng. Có bản hiệu lực → BẮT BUỘC tích ô đồng ý (server kiểm, không tin
 * client ẩn/hiện checkbox) và id gửi lên (nếu có) phải là bản hiệu lực. Chưa có bản hiệu lực → `null`, ô bị bỏ qua.
 */
export function resolveSellerPolicyAcceptance(effective: EffectiveLegalVersion | null, input: { accepted: boolean; submittedVersionId: string | undefined }): string | null {
  if (!effective) return null;
  if (!input.accepted) throw legalError(LEGAL_ERROR_CODES.ACCEPTANCE_REQUIRED, `Bạn cần đồng ý ${effective.title} để mở gian hàng.`, 400);
  return resolveAcceptedLegalVersion(effective, input.submittedVersionId, {
    code: LEGAL_ERROR_CODES.DOCUMENT_CHANGED,
    message: `${effective.title} vừa được cập nhật. Vui lòng tải lại trang, đọc bản mới rồi thử lại.`,
  });
}

/** Ghi chấp thuận trong giao dịch đang mở (cùng giao dịch tạo user). Không lưu IP/User-Agent (ADR-050). */
export async function recordLegalAcceptance(tx: Prisma.TransactionClient, userId: string, versionId: string, acceptedAt: Date): Promise<void> {
  await tx.userLegalAcceptance.create({ data: { userId, versionId, acceptedAt } });
}

/**
 * Ghi nhiều chấp thuận trong giao dịch đang mở; đã có `(userId, versionId)` thì bỏ qua (`ON CONFLICT DO NOTHING` — không
 * cần quyền UPDATE, bảng append-only). Dùng khi mở gian hàng (người dùng có thể đã chấp thuận bản đó trước).
 */
export async function recordLegalAcceptances(tx: Prisma.TransactionClient, userId: string, versionIds: readonly string[], acceptedAt: Date): Promise<number> {
  const unique = [...new Set(versionIds)];
  if (unique.length === 0) return 0;
  const result = await tx.userLegalAcceptance.createMany({ data: unique.map((versionId) => ({ userId, versionId, acceptedAt })), skipDuplicates: true });
  return result.count;
}
