/**
 * ADR-050 mục 3 (+ bổ sung) — hằng và luật thuần cho văn bản pháp lý có phiên bản. Đọc/ghi DB ở
 * `apps/web/lib/legal.ts`. File không phụ thuộc gì — client component import qua `@gieochu/core/legal`.
 *
 *  - Bản hiệu lực = PUBLISHED có `effectiveAt <= now` mới nhất (cho phép nhiều bản PUBLISHED, hỗ trợ hiệu lực tương lai).
 *  - Xuất bản yêu cầu CẢ `reviewStatus = APPROVED` VÀ nội dung không còn `[[CẦN XÁC NHẬN` (server kiểm lại).
 *  - Bản đã phát hành bất biến (trigger DB) — sửa = tạo phiên bản mới.
 */

/**
 * ADR-054 — 7 văn bản, mỗi văn bản một URL **cấp gốc** `/{slug}` (route tĩnh trong `apps/web/app/{slug}/`, thắng
 * `app/[tenantSlug]`; slug nằm trong `RESERVED_SLUGS` tenant). Khoá ổn định trong code; `title` chỉ dùng khi tạo dòng
 * `legal_documents` lần đầu (sau đó trang đọc tiêu đề trong DB). Thứ tự khai báo = thứ tự trong editor + cột footer
 * "Thông tin". Thêm văn bản mới: thêm ở đây + tạo thư mục route mỏng + quét slug tenant trùng trên DB.
 */
export const LEGAL_DOCUMENT_DEFS = {
  terms: { key: "terms", slug: "dieu-khoan-su-dung", title: "Điều khoản sử dụng" },
  privacy: { key: "privacy", slug: "chinh-sach-bao-mat", title: "Chính sách bảo mật" },
  content_policy: { key: "content_policy", slug: "chinh-sach-noi-dung", title: "Chính sách nội dung" },
  copyright: { key: "copyright", slug: "cam-ket-ban-quyen", title: "Cam kết bản quyền và nguồn gốc tài liệu" },
  usage_license: { key: "usage_license", slug: "quyen-su-dung-tai-lieu", title: "Quyền sử dụng tài liệu" },
  seller: { key: "seller", slug: "chinh-sach-nguoi-ban", title: "Chính sách người bán" },
  contact: { key: "contact", slug: "lien-he", title: "Liên hệ và thông tin pháp lý" },
} as const;
export type LegalDocumentKey = keyof typeof LEGAL_DOCUMENT_DEFS;

export const LEGAL_DOCUMENT_KEYS = Object.keys(LEGAL_DOCUMENT_DEFS) as LegalDocumentKey[];

/** Slug cấp gốc của mọi văn bản — `RESERVED_SLUGS` (tenant) đọc từ đây. */
export const LEGAL_DOCUMENT_ROOT_SLUGS: readonly string[] = LEGAL_DOCUMENT_KEYS.map((key) => LEGAL_DOCUMENT_DEFS[key].slug);

export function isLegalDocumentKey(value: unknown): value is LegalDocumentKey {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(LEGAL_DOCUMENT_DEFS, value);
}

/** Tiền tố URL cũ (ADR-050) — `/phap-ly/{slug}` nay chỉ redirect 308 sang `/{slug}` (ADR-054). */
export const LEGAL_LEGACY_BASE_PATH = "/phap-ly";

/** `/{slug}` (cấp gốc) của văn bản. */
export function legalDocumentPath(key: LegalDocumentKey): string {
  return `/${LEGAL_DOCUMENT_DEFS[key].slug}`;
}

/** Mô tả ngắn (fallback mô tả SEO) — cùng mức tối đa với mô tả SEO; CHECK DB `legal_documents_meta_length`. */
export const LEGAL_SUMMARY_MAX = 320;

/** Tra khoá từ slug URL; `null` = không phải văn bản đã khai báo. */
export function legalKeyFromSlug(slug: string): LegalDocumentKey | null {
  const entry = LEGAL_DOCUMENT_KEYS.find((key) => LEGAL_DOCUMENT_DEFS[key].slug === slug);
  return entry ?? null;
}

/** Dấu placeholder trong dự thảo (vd `[[CẦN XÁC NHẬN: tên pháp nhân]]`). Còn dấu này → không xuất bản được. */
export const LEGAL_PLACEHOLDER_MARKER = "[[CẦN XÁC NHẬN";

export const LEGAL_CONTENT_MAX = 200_000;
export const LEGAL_CHANGE_SUMMARY_MAX = 1000;

export const LEGAL_VERSION_STATUSES = ["DRAFT", "PUBLISHED", "ARCHIVED"] as const;
export type LegalVersionStatusValue = (typeof LEGAL_VERSION_STATUSES)[number];
export const LEGAL_VERSION_STATUS_LABELS: Record<LegalVersionStatusValue, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

export const LEGAL_REVIEW_STATUSES = ["PENDING_LEGAL_REVIEW", "APPROVED"] as const;
export type LegalReviewStatusValue = (typeof LEGAL_REVIEW_STATUSES)[number];
export const LEGAL_REVIEW_STATUS_LABELS: Record<LegalReviewStatusValue, string> = {
  PENDING_LEGAL_REVIEW: "Chờ rà soát pháp lý",
  APPROVED: "Đã rà soát pháp lý",
};

export function isLegalReviewStatus(value: unknown): value is LegalReviewStatusValue {
  return typeof value === "string" && (LEGAL_REVIEW_STATUSES as readonly string[]).includes(value);
}

export const LEGAL_ERROR_CODES = {
  PUBLISH_BLOCKED: "LEGAL_PUBLISH_BLOCKED",
  NOT_DRAFT: "LEGAL_VERSION_NOT_DRAFT",
  NOT_FOUND: "LEGAL_VERSION_NOT_FOUND",
  NOT_PUBLISHED: "LEGAL_VERSION_NOT_PUBLISHED",
  INVALID_INPUT: "LEGAL_INVALID_INPUT",
  CONFLICT: "LEGAL_VERSION_CONFLICT",
  TERMS_CHANGED: "LEGAL_TERMS_CHANGED",
  /** ADR-054: văn bản khác Điều khoản (Bảo mật, Người bán…) vừa có bản hiệu lực mới giữa lúc mở form và lúc gửi. */
  DOCUMENT_CHANGED: "LEGAL_DOCUMENT_CHANGED",
  /** ADR-054: văn bản có bản hiệu lực nhưng người dùng chưa tích đồng ý (vd Chính sách người bán khi mở gian hàng). */
  ACCEPTANCE_REQUIRED: "LEGAL_ACCEPTANCE_REQUIRED",
} as const;

export type LegalPublishBlocker = "PLACEHOLDER" | "NOT_APPROVED" | "EMPTY" | "NOT_DRAFT";

export const LEGAL_PUBLISH_BLOCKER_MESSAGES: Record<LegalPublishBlocker, string> = {
  PLACEHOLDER: `Nội dung còn dấu “${LEGAL_PLACEHOLDER_MARKER}…” — điền đủ thông tin trước khi xuất bản.`,
  NOT_APPROVED: "Phiên bản chưa được đánh dấu “Đã rà soát pháp lý”.",
  EMPTY: "Nội dung trống.",
  NOT_DRAFT: "Chỉ xuất bản được phiên bản nháp.",
};

/** Chữ thuần của HTML (bỏ thẻ) — đủ để kiểm trống/placeholder, không dùng để render. */
function stripTags(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ");
}

/** Luật chặn xuất bản (rỗng = được xuất bản). Placeholder kiểm trên cả HTML thô lẫn chữ đã bỏ thẻ. */
export function legalPublishBlockers(version: { status: string; reviewStatus: string; contentHtml: string }): LegalPublishBlocker[] {
  const blockers: LegalPublishBlocker[] = [];
  if (version.status !== "DRAFT") blockers.push("NOT_DRAFT");
  const text = stripTags(version.contentHtml);
  if (text.trim().length === 0) blockers.push("EMPTY");
  if (version.contentHtml.includes(LEGAL_PLACEHOLDER_MARKER) || text.includes(LEGAL_PLACEHOLDER_MARKER)) blockers.push("PLACEHOLDER");
  if (version.reviewStatus !== "APPROVED") blockers.push("NOT_APPROVED");
  return blockers;
}

/** Bản đang hiệu lực trong danh sách phiên bản: PUBLISHED, `effectiveAt <= now`, mới nhất (cùng ngày → số lớn hơn). */
export function pickEffectiveLegalVersion<T extends { status: string; effectiveAt: Date | null; version: number }>(versions: readonly T[], now: Date): T | null {
  let best: T | null = null;
  for (const version of versions) {
    if (version.status !== "PUBLISHED" || !version.effectiveAt || version.effectiveAt.getTime() > now.getTime()) continue;
    if (!best || version.effectiveAt.getTime() > best.effectiveAt!.getTime() || (version.effectiveAt.getTime() === best.effectiveAt!.getTime() && version.version > best.version)) {
      best = version;
    }
  }
  return best;
}

/** Nhãn hiển thị số phiên bản (`version` Int → "1.0", "2.0"…). */
export function legalVersionLabel(version: number): string {
  return `${version}.0`;
}

/** Cho phép đặt hiệu lực sớm hơn hiện tại tối đa chừng này (lệch đồng hồ) — không cho lùi ngày hiệu lực. */
export const LEGAL_EFFECTIVE_BACKDATE_TOLERANCE_MS = 5 * 60 * 1000;

const VN_OFFSET_MINUTES = 7 * 60; // Asia/Ho_Chi_Minh, không có giờ mùa hè.

/**
 * Ô `datetime-local` (giờ Việt Nam, `YYYY-MM-DDTHH:mm`) → Date UTC. Trống → `null` (= ngay bây giờ). Sai định dạng →
 * `undefined`.
 */
export function parseVnDateTimeLocal(value: string): Date | null | undefined {
  const raw = value.trim();
  if (raw.length === 0) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(raw);
  if (!match) return undefined;
  const [, y, mo, d, h, mi] = match.map(Number) as [number, number, number, number, number, number];
  const utc = Date.UTC(y, mo - 1, d, h, mi) - VN_OFFSET_MINUTES * 60 * 1000;
  const date = new Date(utc);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
