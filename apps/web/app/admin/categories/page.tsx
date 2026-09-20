import Link from "next/link";
import { requireAdminAccess } from "../../../lib/page-guards";
import { countDocumentCategories, listDocumentCategories } from "../../../lib/document-category";
import { toggleCategoryActiveAction } from "./actions";
import { AdminPageHeader, Badge, DataTable, EmptyState, PrimaryButton, Td, Tr } from "../_ui/kit";
import { IconEdit, IconPlus, IconTag, IconToggleOff, IconToggleOn } from "../_ui/icons";
import { MenuItemButton, RowMenu } from "../_ui/row-menu";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";

export default async function AdminCategoriesListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess("/admin/categories");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const [categories, total] = await Promise.all([listDocumentCategories({ skip, take }), countDocumentCategories()]);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Danh mục tài liệu"
        subtitle="Danh mục do System Admin tạo trước — tenant sẽ gán sản phẩm vào các danh mục này (module sau)."
        action={
          <Link href="/admin/categories/new">
            <PrimaryButton type="button">
              <IconPlus className="h-4 w-4" /> Thêm danh mục
            </PrimaryButton>
          </Link>
        }
      />

      {categories.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<IconTag className="h-6 w-6" />} title="Chưa có danh mục nào" description="Tạo danh mục đầu tiên để bắt đầu phân loại tài liệu." />
        </div>
      ) : (
        <div className="mt-6">
          <DataTable head={["Danh mục", "Đường dẫn", "Trạng thái", ""]}>
            {categories.map((category) => (
              <Tr key={category.id}>
                <Td>
                  <Link href={`/admin/categories/${category.id}`} className="font-medium hover:underline">
                    {category.name}
                  </Link>
                  {category.shortDescription ? <p className="mt-0.5 line-clamp-1 text-xs text-gray-500">{category.shortDescription}</p> : null}
                </Td>
                <Td className="font-mono text-xs text-gray-500">/{category.slug}</Td>
                <Td>
                  <Badge tone={category.isActive ? "success" : "neutral"}>{category.isActive ? "Đang bật" : "Đã tắt"}</Badge>
                </Td>
                <Td>
                  <RowMenu label={`Chức năng cho danh mục ${category.name}`}>
                    <Link href={`/admin/categories/${category.id}`}>
                      <MenuItemButton type="button" icon={<IconEdit />}>
                        Sửa danh mục
                      </MenuItemButton>
                    </Link>
                    <form action={toggleCategoryActiveAction.bind(null, category.id)}>
                      <MenuItemButton tone={category.isActive ? "danger" : "success"} icon={category.isActive ? <IconToggleOff /> : <IconToggleOn />}>
                        {category.isActive ? "Tắt danh mục" : "Bật danh mục"}
                      </MenuItemButton>
                    </form>
                  </RowMenu>
                </Td>
              </Tr>
            ))}
          </DataTable>
          <Pagination total={total} page={page} pageSize={pageSize} />
        </div>
      )}
    </main>
  );
}
