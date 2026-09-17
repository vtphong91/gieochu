import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { resolveStorefrontAccess } from "@gieochu/core";
import { getBrand } from "@gieochu/config/brand";
import { getCurrentUser } from "../../lib/session";
import { findSlugRedirectTarget, findTenantBySlugForStorefront, getPublishedProducts } from "../../lib/storefront";

async function resolveTenant(tenantSlug: string) {
  const tenant = await findTenantBySlugForStorefront(tenantSlug);
  if (tenant) return tenant;

  const redirectTarget = await findSlugRedirectTarget(tenantSlug);
  if (redirectTarget) redirect(`/${redirectTarget}`);

  return null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ tenantSlug: string }>;
}): Promise<Metadata> {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) return {};
  return { title: tenant.name, description: tenant.bio ?? undefined };
}

export default async function StorefrontPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const tenant = await resolveTenant(tenantSlug);
  if (!tenant) notFound();

  const currentUser = await getCurrentUser();
  const viewer = currentUser?.userId === tenant.ownerId ? "owner" : "guest";
  const decision = resolveStorefrontAccess(tenant.status, viewer);

  if (decision === "NOT_FOUND") notFound();

  const products = await getPublishedProducts(tenant.id);
  const brand = getBrand();

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      {decision === "READ_ONLY" ? (
        <div className="mb-4 rounded bg-amber-100 px-4 py-2 text-sm text-amber-800">
          Trang tạm ngưng bán — chỉ xem, chưa mua được.
        </div>
      ) : null}
      {decision === "LOCKED_NOTICE" ? (
        <div className="mb-4 rounded bg-red-100 px-4 py-2 text-sm text-red-800">
          Trang của bạn đang bị khoá. Liên hệ hỗ trợ để biết thêm chi tiết.
        </div>
      ) : null}

      <h1 className="text-3xl font-bold">{tenant.name}</h1>
      {tenant.bio ? <p className="mt-2 text-gray-600">{tenant.bio}</p> : null}

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Tài liệu</h2>
        {products.length === 0 ? (
          <p className="mt-2 text-sm text-gray-500">Chưa có tài liệu nào được đăng.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {products.map((product) => (
              <li key={product.id} className="rounded border p-3">
                {product.title}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-semibold">Bài viết</h2>
        <p className="mt-2 text-sm text-gray-500">Sẽ có ở M10 — Social Feed và Đánh giá.</p>
      </section>

      <footer className="mt-12 border-t pt-4 text-xs text-gray-400">Vận hành bởi {brand.name}</footer>
    </main>
  );
}
