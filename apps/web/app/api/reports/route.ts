import { NextResponse } from "next/server";
import { abuseReportSubmissionSchema } from "@gieochu/core";
import { getRequestId, handleApiError, parseJsonBody } from "../../../lib/api-response";
import { assertSameOrigin } from "../../../lib/origin-guard";
import { auditMetaFromRequest } from "../../../lib/audit";
import { getCurrentUser } from "../../../lib/session";
import { submitAbuseReport } from "../../../lib/abuse-report";

export const dynamic = "force-dynamic";

const SUCCESS_MESSAGE = "Cảm ơn bạn đã báo cáo. Chúng tôi sẽ xem xét và phản hồi qua email.";

/**
 * ADR-038 (M12c) — gửi báo cáo vi phạm (ai cũng gửi được).
 *
 * Body JSON: `{ targetType, targetId, type, description, evidenceUrls?, email?, website? }` (schema
 * `abuseReportSubmissionSchema`, @gieochu/core/abuse-report). Đăng nhập → lấy email tài khoản (bỏ qua `email` gửi lên);
 * khách → `email` bắt buộc. `website` là ô ẩn chống bot. Chống spam: 5 báo cáo/giờ/IP (đếm trong `abuse_reports`),
 * chặn trùng (cùng người báo cáo + cùng đối tượng đang OPEN). Đối tượng phải tồn tại và công khai.
 *
 * 201 `{ ok: true, message }` (kể cả khi honeypot bị kích hoạt — không cho bot biết). Lỗi: `{ error: { code, message,
 * requestId } }` — 400 INVALID_JSON / VALIDATION_ERROR / REPORT_EMAIL_REQUIRED, 403 ORIGIN_MISMATCH, 404
 * REPORT_TARGET_NOT_FOUND, 409 REPORT_DUPLICATE, 429 RATE_LIMITED, 503 REPORT_UNAVAILABLE.
 */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    assertSameOrigin(request);
    const submission = await parseJsonBody(request, abuseReportSubmissionSchema);
    const user = await getCurrentUser();
    const meta = auditMetaFromRequest(request);
    await submitAbuseReport({ submission, user, ip: meta.ip, userAgent: meta.userAgent });
    return NextResponse.json({ ok: true, message: SUCCESS_MESSAGE }, { status: 201 });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
