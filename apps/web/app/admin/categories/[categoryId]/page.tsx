import { notFound } from "next/navigation";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getDocumentCategory } from "../../../../lib/document-category";
import { updateCategoryAction } from "../actions";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { CategoryForm } from "../category-form";

export default async function AdminEditCategoryPage({ params }: { params: Promise<{ categoryId: string }> }) {
  await requireAdminAccess("/admin/categories");
  const { categoryId } = await params;

  const category = await getDocumentCategory(categoryId);
  if (!category) notFound();

  return (
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title={category.name} subtitle={`Sửa danh mục — /${category.slug}`} />
      <SettingsGrid>
        <CategoryForm
          action={updateCategoryAction.bind(null, categoryId)}
          submitLabel="Lưu thay đổi"
          initial={{
            name: category.name,
            slug: category.slug,
            shortDescription: category.shortDescription ?? "",
            description: category.description ?? "",
            imageUrl: category.imageUrl ?? "",
            seoTitle: category.seoTitle ?? "",
            seoDescription: category.seoDescription ?? "",
            ogImageUrl: category.ogImageUrl ?? "",
          }}
        />
      </SettingsGrid>
    </div>
  );
}
