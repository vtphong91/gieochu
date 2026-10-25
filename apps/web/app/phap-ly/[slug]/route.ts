import { legalDocumentPath, legalKeyFromSlug } from "@gieochu/core";

/**
 * ADR-054 mục 1 — URL cũ `/phap-ly/{slug}` (ADR-050) → 308 sang URL cấp gốc `/{slug}` (giữ query). Slug không phải văn
 * bản đã khai báo → 404. Không đọc DB: văn bản chưa có bản hiệu lực vẫn redirect, trang đích tự trả 404.
 * `Location` tương đối (RFC 9110) — không dựng origin từ `request.url` (sau reverse proxy có thể là host nội bộ).
 */
export const dynamic = "force-dynamic";

function redirectLegacy(request: Request, slug: string): Response {
  const key = legalKeyFromSlug(slug);
  if (!key) return new Response("Not Found", { status: 404, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  const { search } = new URL(request.url);
  return new Response(null, { status: 308, headers: { Location: `${legalDocumentPath(key)}${search}` } });
}

export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  return redirectLegacy(request, (await params).slug);
}

export async function HEAD(request: Request, { params }: { params: Promise<{ slug: string }> }): Promise<Response> {
  return redirectLegacy(request, (await params).slug);
}
