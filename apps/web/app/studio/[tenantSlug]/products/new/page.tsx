import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { CreateProductForm } from "./create-form";

export default async function NewProductPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products/new`);

  return (
    <main className="mx-auto max-w-md px-4 py-10">
      <h1 className="text-2xl font-bold">Tạo sản phẩm mới</h1>
      <CreateProductForm tenantSlug={tenantSlug} />
    </main>
  );
}
