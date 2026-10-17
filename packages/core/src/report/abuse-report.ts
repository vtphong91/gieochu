import { z } from "zod";

/**
 * ADR-038 (M12c) — hằng, nhãn và schema gửi báo cáo vi phạm. Không phụ thuộc Node/DB — client component (nút "Báo cáo"
 * phía public, trang admin) import được qua `@gieochu/core/abuse-report`. Ghi/đọc DB ở apps/web/lib/abuse-report.ts.
 */

/** Khớp enum Postgres `AbuseTargetType`. Bình luận chưa có (M10c). */
export const ABUSE_TARGET_TYPES = ["PRODUCT", "REVIEW", "POST"] as const;
export type AbuseTargetTypeValue = (typeof ABUSE_TARGET_TYPES)[number];

/** Khớp enum Postgres `AbuseReportType`. */
export const ABUSE_REPORT_TYPES = ["COPYRIGHT", "INAPPROPRIATE", "SCAM", "OTHER"] as const;
export type AbuseReportTypeValue = (typeof ABUSE_REPORT_TYPES)[number];

/** Khớp enum Postgres `AbuseReportStatus`. */
export const ABUSE_REPORT_STATUSES = ["OPEN", "RESOLVED", "REJECTED"] as const;
export type AbuseReportStatusValue = (typeof ABUSE_REPORT_STATUSES)[number];

/** Khớp enum Postgres `AbuseReportDecision`. */
export const ABUSE_REPORT_DECISIONS = ["HIDE_CONTENT", "ARCHIVE_PRODUCT", "LOCK_TENANT", "REJECT"] as const;
export type AbuseReportDecisionValue = (typeof ABUSE_REPORT_DECISIONS)[number];

export const ABUSE_REPORT_DESCRIPTION_MAX_LENGTH = 2000;
export const ABUSE_REPORT_EVIDENCE_MAX = 5;
export const ABUSE_REPORT_EVIDENCE_URL_MAX_LENGTH = 2000;
export const ABUSE_REPORT_NOTE_MAX_LENGTH = 2000;
/** ADR-038 mục 2: tối đa 5 báo cáo / giờ / IP. */
export const ABUSE_REPORT_RATE_LIMIT = 5;
export const ABUSE_REPORT_RATE_WINDOW_MS = 60 * 60 * 1000;
/** Tên field ô ẩn chống bot (honeypot) — người thật để trống; có giá trị → bỏ qua âm thầm. */
export const ABUSE_REPORT_HONEYPOT_FIELD = "website";

/** Mã lỗi nghiệp vụ (AppError.code) của luồng báo cáo + khoá kiểm duyệt. */
export const ABUSE_REPORT_ERROR_CODES = {
  TARGET_NOT_FOUND: "REPORT_TARGET_NOT_FOUND",
  DUPLICATE: "REPORT_DUPLICATE",
  EMAIL_REQUIRED: "REPORT_EMAIL_REQUIRED",
  UNAVAILABLE: "REPORT_UNAVAILABLE",
  NOT_FOUND: "REPORT_NOT_FOUND",
  ALREADY_RESOLVED: "REPORT_ALREADY_RESOLVED",
  INVALID_DECISION: "REPORT_INVALID_DECISION",
  TARGET_GONE: "REPORT_TARGET_GONE",
  NOT_LOCKED: "CONTENT_NOT_MODERATION_LOCKED",
  CONTENT_LOCKED: "CONTENT_MODERATION_LOCKED",
} as const;

/** Thông điệp chung khi tenant thao tác vào nội dung đang bị khoá kiểm duyệt (ADR-038 mục 5). */
export const CONTENT_MODERATION_LOCKED_MESSAGE =
  "Nội dung đang bị khoá kiểm duyệt do vi phạm nên không thể xuất bản lại, khôi phục hay bỏ ẩn. Vui lòng liên hệ bộ phận hỗ trợ nếu bạn cho rằng đây là nhầm lẫn.";

export const ABUSE_TARGET_TYPE_LABELS: Record<AbuseTargetTypeValue, string> = {
  PRODUCT: "Tài liệu",
  REVIEW: "Đánh giá",
  POST: "Bài viết",
};

export const ABUSE_REPORT_TYPE_LABELS: Record<AbuseReportTypeValue, string> = {
  COPYRIGHT: "Vi phạm bản quyền",
  INAPPROPRIATE: "Nội dung không phù hợp",
  SCAM: "Lừa đảo",
  OTHER: "Vi phạm khác",
};

export const ABUSE_REPORT_STATUS_LABELS: Record<AbuseReportStatusValue, string> = {
  OPEN: "Chờ xử lý",
  RESOLVED: "Đã xử lý",
  REJECTED: "Đã bác bỏ",
};

export const ABUSE_REPORT_DECISION_LABELS: Record<AbuseReportDecisionValue, string> = {
  HIDE_CONTENT: "Ẩn nội dung",
  ARCHIVE_PRODUCT: "Lưu trữ tài liệu",
  LOCK_TENANT: "Khoá gian hàng",
  REJECT: "Bác bỏ",
};

export function isAbuseTargetType(value: unknown): value is AbuseTargetTypeValue {
  return typeof value === "string" && (ABUSE_TARGET_TYPES as readonly string[]).includes(value);
}

export function isAbuseReportType(value: unknown): value is AbuseReportTypeValue {
  return typeof value === "string" && (ABUSE_REPORT_TYPES as readonly string[]).includes(value);
}

export function isAbuseReportStatus(value: unknown): value is AbuseReportStatusValue {
  return typeof value === "string" && (ABUSE_REPORT_STATUSES as readonly string[]).includes(value);
}

export function isAbuseReportDecision(value: unknown): value is AbuseReportDecisionValue {
  return typeof value === "string" && (ABUSE_REPORT_DECISIONS as readonly string[]).includes(value);
}

/**
 * Quyết định hợp lệ theo loại đối tượng: ẩn chỉ cho đánh giá/bài viết, lưu trữ chỉ cho tài liệu; khoá gian hàng và bác
 * bỏ áp cho mọi loại.
 */
export function allowedAbuseDecisions(targetType: AbuseTargetTypeValue): AbuseReportDecisionValue[] {
  return targetType === "PRODUCT" ? ["ARCHIVE_PRODUCT", "LOCK_TENANT", "REJECT"] : ["HIDE_CONTENT", "LOCK_TENANT", "REJECT"];
}

/** Biện pháp thực sự tác động tới tenant (gửi email cho chủ gian hàng). */
export function isEnforcementDecision(decision: AbuseReportDecisionValue): boolean {
  return decision !== "REJECT";
}

/** Id cuid2 (chặn chuỗi rác trước khi đưa vào truy vấn). */
const ID_PATTERN = /^[a-z0-9]{1,40}$/i;
const CONTROL_CHARS_EXCEPT_NEWLINE = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F]/g;

/** Văn bản thuần nhiều dòng: NFC, bỏ ký tự điều khiển (giữ xuống dòng), gộp CRLF, trim. */
export function normalizeReportText(value: string): string {
  return value.normalize("NFC").replace(/\r\n?/g, "\n").replace(CONTROL_CHARS_EXCEPT_NEWLINE, "").trim();
}

/** Độ dài theo code point — khớp `char_length` của Postgres trong CHECK. */
export function codePointLength(value: string): number {
  return Array.from(value).length;
}

/** URL bằng chứng: chỉ http/https, ≤2000 ký tự. Trả URL đã chuẩn hoá (`URL.href`) hoặc null. */
export function normalizeEvidenceUrl(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > ABUSE_REPORT_EVIDENCE_URL_MAX_LENGTH) return null;
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  const href = url.href;
  return href.length > ABUSE_REPORT_EVIDENCE_URL_MAX_LENGTH ? null : href;
}

/**
 * Body JSON của `POST /api/reports`. `email` bắt buộc khi chưa đăng nhập (kiểm ở route — schema không biết phiên).
 * `website` là honeypot. Mô tả/URL được chuẩn hoá trong `transform`.
 */
export const abuseReportSubmissionSchema = z.object({
  targetType: z.enum(ABUSE_TARGET_TYPES, { error: "Đối tượng báo cáo không hợp lệ." }),
  targetId: z.string({ error: "Thiếu đối tượng báo cáo." }).regex(ID_PATTERN, "Đối tượng báo cáo không hợp lệ."),
  type: z.enum(ABUSE_REPORT_TYPES, { error: "Vui lòng chọn loại vi phạm." }),
  description: z
    .string({ error: "Vui lòng mô tả vi phạm." })
    .transform(normalizeReportText)
    .refine((value) => value.length > 0, "Vui lòng mô tả vi phạm.")
    .refine(
      (value) => codePointLength(value) <= ABUSE_REPORT_DESCRIPTION_MAX_LENGTH,
      `Mô tả tối đa ${ABUSE_REPORT_DESCRIPTION_MAX_LENGTH} ký tự.`,
    ),
  evidenceUrls: z
    .array(z.string(), { error: "Link bằng chứng không hợp lệ." })
    .max(ABUSE_REPORT_EVIDENCE_MAX, `Tối đa ${ABUSE_REPORT_EVIDENCE_MAX} link bằng chứng.`)
    .optional()
    .transform((list, ctx) => {
      const out: string[] = [];
      for (const raw of list ?? []) {
        if (raw.trim() === "") continue;
        const url = normalizeEvidenceUrl(raw);
        if (!url) {
          ctx.addIssue({ code: "custom", message: "Link bằng chứng phải bắt đầu bằng http:// hoặc https://." });
          return z.NEVER;
        }
        if (!out.includes(url)) out.push(url);
      }
      return out;
    }),
  email: z
    .string()
    .trim()
    .max(320, "Email không hợp lệ.")
    .optional()
    .transform((value) => (value ? value.toLowerCase() : undefined))
    .refine((value) => value === undefined || z.email().safeParse(value).success, "Email không hợp lệ."),
  [ABUSE_REPORT_HONEYPOT_FIELD]: z.string().max(500).optional(),
});

export type AbuseReportSubmission = z.infer<typeof abuseReportSubmissionSchema>;
