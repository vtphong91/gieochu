import { NextResponse, type NextRequest } from "next/server";

/**
 * §4.3: proxy.ts only attaches request-scoped metadata and does coarse
 * redirects. It must NEVER be the only auth check — every sensitive route
 * handler / server action / server component re-verifies the JWT itself.
 * Tenant-slug resolution and auth-cookie redirects land in M1/M4.
 */
export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
