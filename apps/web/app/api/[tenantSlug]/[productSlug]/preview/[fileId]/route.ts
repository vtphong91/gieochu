import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { AppError, notFound } from "@gieochu/core";
import { getPreviewForPublicRoute } from "../../../../../../lib/product-file-preview";
import { getRequestId, handleApiError } from "../../../../../../lib/api-response";
import { checkRateLimit } from "../../../../../../lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ADR-063 §5 — GET /{tenantSlug}/{productSlug}/preview/{fileId}
 * Trả JSON bản xem trước 20% nội dung thật. Guard tenant ACTIVE + product PUBLISHED + file hợp lệ nằm trong
 * `getPreviewForPublicRoute`. 404 cho mọi trường hợp không hợp lệ (DRAFT/khác tenant/file không CLEAN...).
 *
 * Rate limit: 60 req/phút/IP theo ADR-063 §5. Dùng chung bộ đếm in-memory `checkRateLimit` (apps/web/lib/rate-limit.ts)
 * — đã dùng ở nhiều route khác, đổi sang DB (`rate_limit_counters`, ADR-061 Q1) khi project triển khai helper DB-backed
 * dùng chung. Khoá băm SHA-256(IP) để không lưu IP thô trong state.
 */
const PREVIEW_RATE_LIMIT = 60;
const PREVIEW_RATE_WINDOW_MS = 60_000;

function extractClientIp(request: Request): string {
  // ADR-063 §5: khoá theo IP khách. Vercel/nginx proxy đặt `x-forwarded-for`; lấy IP đầu tiên; `x-real-ip` dự phòng;
  // fallback "unknown" (sẽ chia sẻ 1 bucket — chấp nhận vì chỉ là lớp phòng vệ sơ bộ).
  const xff = request.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

export async function GET(request: Request, { params }: { params: Promise<{ tenantSlug: string; productSlug: string; fileId: string }> }) {
  const requestId = getRequestId(request);
  try {
    const { tenantSlug, productSlug, fileId } = await params;
    if (!tenantSlug || !productSlug || !fileId) throw notFound("Không tìm thấy file xem trước.");

    const ipHash = createHash("sha256").update(extractClientIp(request)).digest("hex");
    if (!checkRateLimit(`preview:${ipHash}`, PREVIEW_RATE_LIMIT, PREVIEW_RATE_WINDOW_MS)) {
      throw new AppError({
        code: "RATE_LIMITED",
        message: "Bạn đã xem trước quá nhiều lần, vui lòng thử lại sau ít phút.",
        httpStatus: 429,
      });
    }

    const result = await getPreviewForPublicRoute(tenantSlug, productSlug, fileId);
    if (!result) throw notFound("Không tìm thấy file xem trước.");

    return NextResponse.json(result);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
