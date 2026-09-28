import { EXTERNAL_DOCUMENT_EXACT_HOSTS, EXTERNAL_DOCUMENT_WILDCARD_SUFFIXES } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { listActiveCategoriesForStudio } from "../../../../../lib/document-category";
import { AdminPageHeader, GhostLinkButton } from "../../../../admin/_ui/kit";
import { IconChevronLeft } from "../../../../admin/_ui/icons";
import { ProductEditor } from "../_ui/product-editor";

const ALLOWED_HOSTS = [...EXTERNAL_DOCUMENT_EXACT_HOSTS, ...EXTERNAL_DOCUMENT_WILDCARD_SUFFIXES.map((suffix) => `*${suffix}`)];

export default async function NewProductPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/products/new`);
  const categories = await listActiveCategoriesForStudio();

  // ADR-026 §5 + ADR-027 §4 (đã sửa đổi): Tạo và Sửa dùng chung editor 2 cột. Card Tệp tài liệu mở sẵn — thêm
  // file/link lần đầu tự tạo bản nháp Riêng tư; bấm Lưu nháp/Xuất bản tạo sản phẩm rồi sang URL sửa kèm `?created=`.
  return (
    <div className="px-5 pt-8 pb-12 lg:px-8">
      <ProductEditor
        mode="create"
        tenantSlug={tenantSlug}
        header={
          <AdminPageHeader
            title="Tạo tài liệu mới"
            subtitle="Điền thông tin, giá, ảnh đại diện và thêm file hoặc link tài liệu, rồi bấm Xuất bản. Bản nháp được tự lưu khi bạn thêm tài liệu đầu tiên."
            action={
              <GhostLinkButton href={`/studio/${tenantSlug}/products`}>
                <IconChevronLeft className="h-4 w-4" /> Danh sách sản phẩm
              </GhostLinkButton>
            }
          />
        }
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        allowedHosts={ALLOWED_HOSTS}
      />
    </div>
  );
}
