import { NextResponse } from "next/server";
import { consumeDownloadToken } from "../../../../lib/download";
import { getRequestId, handleApiError } from "../../../../lib/api-response";

/**
 * §"M9": step 2 — no login required here (possession of the raw single-use
 * token is the credential, same trust model as email-verify/reset-password
 * links), consumes it and 302s to a short-lived presigned GET.
 */
export async function GET(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const requestId = getRequestId(request);
  try {
    const { token } = await params;
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const url = await consumeDownloadToken(token, ip);
    return NextResponse.redirect(url, 302);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
