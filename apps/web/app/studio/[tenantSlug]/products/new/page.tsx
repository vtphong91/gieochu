import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { AdminPageHeader, SettingsGrid } from "../../../../admin/_ui/kit";
import { CreateProductForm } from "./create-form";

export default async function NewProductPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products/new`);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Tạo sản phẩm mới" subtitle="Điền thông tin cơ bản — có thể bổ sung mô tả, ảnh, file sau." />
      <SettingsGrid>
        <CreateProductForm tenantSlug={tenantSlug} />
      </SettingsGrid>
    </main>
  );
}
