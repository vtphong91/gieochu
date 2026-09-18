import { NextResponse } from "next/server";
import { z } from "zod";
import { rateLimited } from "@gieochu/core";
import { consumeShareLinkDownload } from "../../../../../lib/share-link";
import { getRequestId, handleApiError, parseJsonBody } from "../../../../../lib/api-response";
import { checkRateLimit } from "../../../../../lib/rate-limit";

const requestSchema = z.object({ fileId: z.string().min(1), password: z.string().optional() });

/** §"M9" share link flowchart: password check (if any) -> pick file -> atomic usedCount claim -> presigned GET. No login required (public link). */
export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(request);
  try {
    const { token } = await params;
    // Rate limit by token, not IP — protects against password brute-force regardless of proxying.
    if (!checkRateLimit(`share-link-download:${token}`, 20, 10 * 60 * 1000)) {
      throw rateLimited("Quá nhiều lượt thử, vui lòng thử lại sau ít phút.");
    }
    const input = await parseJsonBody(request, requestSchema);
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const url = await consumeShareLinkDownload(token, input.fileId, input.password, ip);
    return NextResponse.json({ url });
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
