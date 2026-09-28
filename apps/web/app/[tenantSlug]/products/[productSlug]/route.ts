import { isReservedProductSlug, productPath } from "@gieochu/core";

/**
 * ADR-030 §1: URL cũ `/{tenantSlug}/products/{productSlug}` → **301** sang URL chuẩn `/{tenantSlug}/{productSlug}`,
 * giữ nguyên query (vd `?reviews=20`); hash do trình duyệt tự giữ qua redirect. Dùng Route Handler (không phải
 * `permanentRedirect()`/`redirects()` trong next.config — cả hai trả 308) để trả đúng mã 301 như ADR.
 *
 * Chỉ đọc, không ghi dữ liệu → không cần kiểm `Origin`. `Location` tương đối, segment được encode trong
 * `productPath` nên không thể thành `//host` (open redirect). Slug dành riêng không bao giờ là trang tài liệu → 404
 * (tránh đẩy `/t/products/posts` sang trang danh sách bài viết).
 */
function redirectToCanonical(request: Request, tenantSlug: string, productSlug: string): Response {
  if (isReservedProductSlug(productSlug)) return new Response(null, { status: 404 });
  const { search } = new URL(request.url);
  return new Response(null, {
    status: 301,
    headers: { Location: `${productPath(tenantSlug, productSlug)}${search}` },
  });
}

export async function GET(request: Request, { params }: { params: Promise<{ tenantSlug: string; productSlug: string }> }) {
  const { tenantSlug, productSlug } = await params;
  return redirectToCanonical(request, tenantSlug, productSlug);
}
