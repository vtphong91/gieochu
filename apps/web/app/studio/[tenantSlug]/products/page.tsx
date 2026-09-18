import Link from "next/link";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { listProducts } from "../../../../lib/product";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

export default async function StudioProductsPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products`);

  const products = await listProducts(tenant.id);

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Sản phẩm</h1>
        <Link
          href={`/studio/${tenantSlug}/products/new`}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm text-white"
        >
          + Tạo sản phẩm
        </Link>
      </div>

      <ul className="mt-6 divide-y rounded border">
        {products.length === 0 ? <li className="p-4 text-sm text-gray-500">Chưa có sản phẩm nào.</li> : null}
        {products.map((product) => (
          <li key={product.id} className="flex items-center justify-between p-4 text-sm">
            <div>
              <Link href={`/studio/${tenantSlug}/products/${product.id}`} className="font-medium hover:underline">
                {product.title}
              </Link>
              <p className="text-gray-500">/{product.slug}</p>
            </div>
            <span>{STATUS_LABEL[product.status] ?? product.status}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
