import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimited } from "@gieochu/core";
import { requireUser } from "../../../lib/session";
import { requestDownload } from "../../../lib/download";
import { getRequestId, handleApiError, parseJsonBody } from "../../../lib/api-response";
import { checkRateLimit } from "../../../lib/rate-limit";

const requestSchema = z.object({ fileId: z.string().min(1) });

/** §"M9": step 1 — validate + issue a single-use token; the actual bytes are only ever reachable via `GET /api/downloads/{token}`. */
export async function POST(request: Request) {
  const requestId = getRequestId(request);
  try {
    const user = await requireUser();
    if (!checkRateLimit(`download-request:${user.userId}`, 20, 10 * 60 * 1000)) {
      throw rateLimited("Bạn đã yêu cầu tải quá nhiều lần, vui lòng thử lại sau ít phút.");
    }
    const input = await parseJsonBody(request, requestSchema);
    const result = await requestDownload(user.userId, input.fileId);
    return NextResponse.json({ url: `/api/downloads/${result.token}`, expiresAt: result.expiresAt });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
