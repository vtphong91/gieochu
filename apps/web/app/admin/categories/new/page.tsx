import { requireAdminAccess } from "../../../../lib/page-guards";
import { createCategoryAction } from "../actions";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { CategoryForm } from "../category-form";

export default async function AdminNewCategoryPage() {
  await requireAdminAccess("/admin/categories/new");

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Thêm danh mục tài liệu" subtitle="Tạo danh mục mới để tenant gán sản phẩm vào sau này." />
      <SettingsGrid>
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
      </SettingsGrid>
    </main>
  );
}
