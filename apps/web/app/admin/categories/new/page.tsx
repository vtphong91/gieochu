import { requireAdminAccess } from "../../../../lib/page-guards";
import { createCategoryAction } from "../actions";
import { AdminPageHeader } from "../../_ui/kit";
import { CategoryForm } from "../category-form";

export default async function AdminNewCategoryPage() {
  await requireAdminAccess("/admin/categories/new");

  return (
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Thêm danh mục tài liệu" subtitle="Tạo danh mục mới để tenant gán sản phẩm vào sau này." />
      {/* Full width theo khung app (quy tắc 2026-10-25) — thay SettingsGrid 2 cột. */}
      <div className="mt-6">
        <CategoryForm
          action={createCategoryAction}
          submitLabel="Tạo danh mục"
          initial={{
            name: "",
            slug: "",
            shortDescription: "",
            description: "",
            imageUrl: "",
            seoTitle: "",
            seoDescription: "",
            ogImageUrl: "",
          }}
        />
      </div>
    </div>
  );
}
