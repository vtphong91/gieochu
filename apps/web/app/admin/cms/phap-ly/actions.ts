"use server";

import { revalidatePath } from "next/cache";
import {
  AppError,
  isLegalDocumentKey,
  LEGAL_DOCUMENT_DEFS,
  LEGAL_ERROR_CODES,
  legalDocumentPath,
  parseVnDateTimeLocal,
  type AuditAction,
  type LegalDocumentKey,
  type LegalReviewStatusValue,
} from "@gieochu/core";
import { audit } from "../../../../lib/audit";
import { publishLegalWorkingDraft, saveLegalWorkingDraft, setLegalWorkingDraftReview, updateLegalDocumentMeta } from "../../../../lib/legal";
import { requireRole } from "../../../../lib/session";

/**
 * ADR-050 mục 3 — editor văn bản pháp lý (`/admin/cms/phap-ly`). Mỗi action tự `requireRole("SYSTEM_ADMIN")`, gọi
 * `lib/legal.ts` (sanitize + luật trạng thái + cổng xuất bản kiểm lại ở server), rồi ghi audit (metadata chỉ khoá văn
 * bản + số phiên bản, không nội dung).
 */

export interface LegalActionState {
  success?: boolean;
  error?: string;
  /** Mã lỗi nghiệp vụ khi `error` có giá trị (vd `LEGAL_VERSION_CONFLICT` = 409 "vừa được thay đổi ở nơi khác"). */
  code?: string;
  /** Trạng thái rà soát của bản nháp làm việc sau thao tác (lưu nháp đổi nội dung → về `PENDING_LEGAL_REVIEW`). */
  reviewStatus?: LegalReviewStatusValue;
  /** Id phiên bản vừa tạo (để editor chọn sẵn). */
  versionId?: string;
  /** Bổ sung ADR-057: mốc `updatedAt` mới của bản nháp làm việc (ISO) — editor dùng làm `expectedUpdatedAt` lần sau. */
  updatedAt?: string;
  /** Lưu nháp không tạo gì vì nội dung trùng bản đã xuất bản. */
  unchanged?: boolean;
}

function toKey(value: unknown): LegalDocumentKey {
  if (!isLegalDocumentKey(value)) throw new AppError({ code: LEGAL_ERROR_CODES.INVALID_INPUT, message: "Văn bản không hợp lệ.", httpStatus: 400 });
  return value;
}

function toActionError(error: unknown): LegalActionState {
  if (error instanceof AppError && error.expose) return { error: error.message, code: error.code };
  throw error;
}

async function logChange(actorId: string, action: AuditAction, key: LegalDocumentKey, versionId: string, version: number, extra: Record<string, unknown> = {}): Promise<void> {
  await audit.log({ actorId, scope: "SYSTEM", action, targetType: "LegalDocumentVersion", targetId: versionId, metadata: { key, version, ...extra } });
}

/**
 * ADR-054: trang văn bản cấp gốc + form ghi chấp thuận (đăng ký: Điều khoản/Bảo mật; mở gian hàng: Người bán) + mọi trang
 * có footer (link "Thông tin" tự ẩn/hiện) — `revalidatePath("/", "layout")` làm mới toàn bộ cây dưới layout gốc.
 */
function revalidate(key: LegalDocumentKey): void {
  revalidatePath("/admin/cms/phap-ly");
  revalidatePath(legalDocumentPath(key));
  revalidatePath("/register");
  revalidatePath("/studio");
  revalidatePath("/", "layout");
}

/**
 * ADR-054 mục 4: mô tả ngắn + tiêu đề/mô tả SEO — lưu thẳng (không nháp, như SEO trang chủ ADR-050 lần 2), áp ngay cho
 * trang đang hiệu lực. Audit chỉ ghi khoá văn bản + cờ trường nào có giá trị (không ghi nội dung).
 */
export async function saveLegalDocumentMetaAction(keyInput: unknown, input: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    const meta = await updateLegalDocumentMeta(LEGAL_DOCUMENT_DEFS[key], input);
    await audit.log({
      actorId: actor.userId,
      scope: "SYSTEM",
      action: "LEGAL_DOCUMENT_META_UPDATED",
      targetType: "LegalDocument",
      targetId: key,
      metadata: { key, hasSummary: meta.summary !== null, hasSeoTitle: meta.seoTitle !== null, hasSeoDescription: meta.seoDescription !== null },
    });
    revalidatePath("/admin/cms/phap-ly");
    revalidatePath(legalDocumentPath(key));
    return { success: true };
  } catch (error) {
    return toActionError(error);
  }
}

// ───────────────────────── Editor một nội dung (bổ sung ADR-057) ─────────────────────────
// Không chọn phiên bản ở client: server tự tìm bản nháp làm việc. `expectedUpdatedAt` = `draft.updatedAt` editor đã nạp
// (`null` khi chưa có nháp) — lệch → lỗi "vừa được thay đổi ở nơi khác". Audit giữ các action cũ.

/** Lưu nháp (sửa bản nháp làm việc, chưa có thì tạo). Audit: LEGAL_VERSION_UPDATED / LEGAL_VERSION_CREATED. */
export async function saveLegalDraftAction(keyInput: unknown, contentHtml: unknown, expectedUpdatedAt: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    const { row, created } = await saveLegalWorkingDraft(LEGAL_DOCUMENT_DEFS[key], { contentHtml, expectedUpdatedAt, actorId: actor.userId });
    if (!row) return { success: true, unchanged: true };
    await logChange(actor.userId, created ? "LEGAL_VERSION_CREATED" : "LEGAL_VERSION_UPDATED", key, row.id, row.version);
    revalidate(key);
    return { success: true, versionId: row.id, updatedAt: row.updatedAt.toISOString(), reviewStatus: row.reviewStatus };
  } catch (error) {
    return toActionError(error);
  }
}

/** Tích/bỏ "Đã rà soát nội dung" của bản nháp làm việc. Audit: LEGAL_REVIEW_STATUS_CHANGED. */
export async function setLegalReviewAction(keyInput: unknown, approved: unknown, expectedUpdatedAt: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    if (typeof approved !== "boolean") return { error: "Trạng thái rà soát không hợp lệ." };
    const row = await setLegalWorkingDraftReview(key, { approved, expectedUpdatedAt });
    await logChange(actor.userId, "LEGAL_REVIEW_STATUS_CHANGED", key, row.id, row.version, { reviewStatus: row.reviewStatus });
    revalidate(key);
    return { success: true, versionId: row.id, updatedAt: row.updatedAt.toISOString(), reviewStatus: row.reviewStatus };
  } catch (error) {
    return toActionError(error);
  }
}

/**
 * Xuất bản bản nháp làm việc. `input.effectiveAtLocal`: ô `datetime-local` giờ VN (trống = ngay); `input.asDraftRelease`:
 * công bố dạng bản dự thảo (ADR-057 mục 3 — server từ chối cho tới khi có migration). Audit: LEGAL_VERSION_PUBLISHED kèm cờ.
 */
export async function publishLegalAction(keyInput: unknown, input: unknown, expectedUpdatedAt: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    const raw = (typeof input === "object" && input !== null ? input : {}) as { effectiveAtLocal?: unknown; asDraftRelease?: unknown };
    const effectiveAt = parseVnDateTimeLocal(typeof raw.effectiveAtLocal === "string" ? raw.effectiveAtLocal : "");
    if (effectiveAt === undefined) return { error: "Ngày hiệu lực không hợp lệ." };
    const asDraftRelease = raw.asDraftRelease === true;
    const row = await publishLegalWorkingDraft(key, { effectiveAt, asDraftRelease, expectedUpdatedAt, actorId: actor.userId });
    await logChange(actor.userId, "LEGAL_VERSION_PUBLISHED", key, row.id, row.version, { effectiveAt: row.effectiveAt?.toISOString() ?? null, isDraftRelease: asDraftRelease });
    revalidate(key);
    return { success: true, versionId: row.id, updatedAt: row.updatedAt.toISOString() };
  } catch (error) {
    return toActionError(error);
  }
}
