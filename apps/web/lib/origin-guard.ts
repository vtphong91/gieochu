import { AppError } from "@gieochu/core";
import { getEnv } from "@gieochu/config";

/**
 * CLAUDE.md §7.7 — Route Handler GHI dữ liệu phải kiểm header `Origin` (Server Actions đã có CSRF sẵn của Next.js).
 *
 * Chấp nhận khi `Origin` trùng:
 *  - origin của `APP_URL` (domain chính thức), hoặc
 *  - origin của chính request (`x-forwarded-host`/`host` + proto) — để Vercel Preview / domain phụ trỏ cùng deployment
 *    vẫn dùng được form của chính nó. Kẻ tấn công cross-site không đặt được `Origin` trùng host mà trình duyệt gửi tới.
 * Thiếu `Origin` → từ chối: mọi trình duyệt hiện đại đều gửi `Origin` cho request POST `fetch`/form.
 */
function originOf(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

function requestOrigin(request: Request): string | null {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim() || request.headers.get("host")?.trim();
  if (!host) return originOf(request.url);
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
  const proto = forwardedProto === "http" || forwardedProto === "https" ? forwardedProto : new URL(request.url).protocol.replace(":", "");
  return originOf(`${proto}://${host}`);
}

export function assertSameOrigin(request: Request): void {
  const origin = originOf(request.headers.get("origin"));
  const allowed = new Set([originOf(getEnv().APP_URL), requestOrigin(request)].filter((v): v is string => Boolean(v)));
  if (!origin || !allowed.has(origin)) {
    throw new AppError({ code: "ORIGIN_MISMATCH", message: "Yêu cầu không hợp lệ (sai nguồn gửi).", httpStatus: 403 });
  }
}
