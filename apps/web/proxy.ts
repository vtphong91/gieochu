import { NextResponse, type NextRequest } from "next/server";

// Turbopack/webpack dev HMR runs client code through eval() — a strict
// script-src blocks that outright and silently kills hydration (a form's
// onSubmit handler never attaches, so it falls back to a native HTML GET
// submit — e.g. login credentials appearing in the URL). Production builds
// never need eval for this.
const SCRIPT_EVAL_SOURCE = process.env.NODE_ENV === "production" ? "" : " 'unsafe-eval'";

/**
 * §4.3 + §7.8: proxy.ts attaches request-scoped metadata (x-request-id) and
 * does coarse redirects — it must NEVER be the only auth check, every
 * sensitive route handler/server action/server component re-verifies the
 * JWT itself. It also generates the CSP nonce here (not a static header in
 * next.config.ts) because Next's App Router injects its own inline
 * <script> tags per request (RSC hydration payload) — a static `script-src
 * 'self'` with no nonce/'unsafe-inline' blocks those too, breaking client
 * interactivity on every page, dev AND production. Next automatically
 * applies this nonce to the scripts it injects once it sees one in the
 * outgoing CSP header (https://nextjs.org/docs/app/guides/content-security-policy).
 */
export function proxy(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    // res.cloudinary.com: hiển thị ảnh đã upload (secure_url trả về từ Cloudinary).
    "img-src 'self' data: blob: https://res.cloudinary.com",
    // Next.js nhúng font tối ưu (Be Vietnam Pro/Inter) dạng data: URI — không khai
    // riêng thì rơi về default-src 'self' (không có data:), trình duyệt chặn im
    // lặng và chữ hiện font hệ thống thay vì đúng font thương hiệu.
    "font-src 'self' data:",
    "style-src 'self' 'unsafe-inline'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${SCRIPT_EVAL_SOURCE}`,
    // api.cloudinary.com: browser upload thẳng lên Cloudinary (ImageUploadField) —
    // default-src 'self' vốn áp cho fetch() luôn (connect-src rơi về default-src nếu
    // không khai riêng), thiếu dòng này khiến mọi request upload bị CSP chặn im lặng
    // (fetch throw TypeError, UI chỉ thấy "Upload thất bại — kiểm tra kết nối mạng").
    "connect-src 'self' https://api.cloudinary.com",
  ].join("; ");

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("x-request-id", requestId);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
