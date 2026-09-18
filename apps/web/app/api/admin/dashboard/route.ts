import { NextResponse } from "next/server";
import { requireRole } from "../../../../lib/session";
import { getAdminDashboardSummary } from "../../../../lib/admin-dashboard";
import { getRequestId, handleApiError } from "../../../../lib/api-response";

export async function GET(request: Request) {
  const requestId = getRequestId(request);
  try {
    await requireRole("SYSTEM_ADMIN");
    const summary = await getAdminDashboardSummary();
    return NextResponse.json(summary);
  } catch (error) {
    return handleApiError(error, requestId);
  }
}
