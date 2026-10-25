"use server";

import { revalidatePath } from "next/cache";
import {
  AppError,
  isLegalDocumentKey,
  isLegalReviewStatus,
  LEGAL_DOCUMENT_DEFS,
  LEGAL_ERROR_CODES,
  legalDocumentPath,
  parseVnDateTimeLocal,
  type AuditAction,
  type LegalDocumentKey,
} from "@gieochu/core";
import { audit } from "../../../../lib/audit";
import { archiveLegalVersion, createLegalDraft, publishLegalVersion, setLegalReviewStatus, updateLegalDocumentMeta, updateLegalDraft } from "../../../../lib/legal";
import { requireRole } from "../../../../lib/session";

/**
 * ADR-050 mục 3 — editor văn bản pháp lý (`/admin/cms/phap-ly`). Mỗi action tự `requireRole("SYSTEM_ADMIN")`, gọi
 * `lib/legal.ts` (sanitize + luật trạng thái + cổng xuất bản kiểm lại ở server), rồi ghi audit (metadata chỉ khoá văn
 * bản + số phiên bản, không nội dung).
 */

export interface LegalActionState {
  success?: boolean;
  error?: string;
  /** Id phiên bản vừa tạo (để editor chọn sẵn). */
  versionId?: string;
}

function toKey(value: unknown): LegalDocumentKey {
  if (!isLegalDocumentKey(value)) throw new AppError({ code: LEGAL_ERROR_CODES.INVALID_INPUT, message: "Văn bản không hợp lệ.", httpStatus: 400 });
  return value;
}

function toVersionId(value: unknown): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 64) {
    throw new AppError({ code: LEGAL_ERROR_CODES.INVALID_INPUT, message: "Phiên bản không hợp lệ.", httpStatus: 400 });
  }
  return value;
}

function toActionError(error: unknown): LegalActionState {
  if (error instanceof AppError && error.expose) return { error: error.message };
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

export async function createLegalDraftAction(keyInput: unknown, contentHtml: unknown, changeSummary: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    const version = await createLegalDraft(LEGAL_DOCUMENT_DEFS[key], { contentHtml, changeSummary, actorId: actor.userId });
    await logChange(actor.userId, "LEGAL_VERSION_CREATED", key, version.id, version.version);
    revalidate(key);
    return { success: true, versionId: version.id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function updateLegalDraftAction(keyInput: unknown, versionIdInput: unknown, contentHtml: unknown, changeSummary: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    const version = await updateLegalDraft(key, toVersionId(versionIdInput), { contentHtml, changeSummary });
    await logChange(actor.userId, "LEGAL_VERSION_UPDATED", key, version.id, version.version);
    revalidate(key);
    return { success: true, versionId: version.id };
  } catch (error) {
    return toActionError(error);
  }
}

export async function setLegalReviewStatusAction(keyInput: unknown, versionIdInput: unknown, reviewStatus: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    if (!isLegalReviewStatus(reviewStatus)) return { error: "Trạng thái rà soát không hợp lệ." };
    const version = await setLegalReviewStatus(key, toVersionId(versionIdInput), reviewStatus);
    await logChange(actor.userId, "LEGAL_REVIEW_STATUS_CHANGED", key, version.id, version.version, { reviewStatus });
    revalidate(key);
    return { success: true, versionId: version.id };
  } catch (error) {
    return toActionError(error);
  }
}

/** `effectiveAtLocal`: ô `datetime-local` giờ Việt Nam; trống = ngay bây giờ. */
export async function publishLegalVersionAction(keyInput: unknown, versionIdInput: unknown, effectiveAtLocal: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    const effectiveAt = parseVnDateTimeLocal(typeof effectiveAtLocal === "string" ? effectiveAtLocal : "");
    if (effectiveAt === undefined) return { error: "Ngày hiệu lực không hợp lệ." };
    const version = await publishLegalVersion(key, toVersionId(versionIdInput), { effectiveAt, actorId: actor.userId });
    await logChange(actor.userId, "LEGAL_VERSION_PUBLISHED", key, version.id, version.version, { effectiveAt: version.effectiveAt?.toISOString() ?? null });
    revalidate(key);
    return { success: true, versionId: version.id };
  } catch (error) {
    return toActionError(error);
  }
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

export async function archiveLegalVersionAction(keyInput: unknown, versionIdInput: unknown): Promise<LegalActionState> {
  try {
    const actor = await requireRole("SYSTEM_ADMIN");
    const key = toKey(keyInput);
    const version = await archiveLegalVersion(key, toVersionId(versionIdInput));
    await logChange(actor.userId, "LEGAL_VERSION_ARCHIVED", key, version.id, version.version);
    revalidate(key);
    return { success: true, versionId: version.id };
  } catch (error) {
    return toActionError(error);
  }
}
