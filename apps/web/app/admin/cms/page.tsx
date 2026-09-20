import Link from "next/link";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { AdminPageHeader, Badge, DataTable, EmptyState, PrimaryButton, Td, Tr } from "../_ui/kit";
import { IconDoc, IconEdit, IconPlus } from "../_ui/icons";
import { MenuItemButton, RowMenu } from "../_ui/row-menu";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";

export default async function AdminCmsListPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; pageSize?: string }>;
}) {
  await requireAdminAccess("/admin/cms");
  const sp = await searchParams;
  const { page, pageSize, skip, take } = parsePagination(sp);

  const prisma = getPrismaClient();
  const [pages, total] = await Promise.all([
    prisma.cmsPage.findMany({ orderBy: { slug: "asc" }, skip, take }),
    prisma.cmsPage.count(),
  ]);

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Trang CMS"
        subtitle="Nội dung các trang công khai (giới thiệu, chính sách...) không thuộc trang chủ."
        action={
          <Link href="/admin/cms/new">
            <PrimaryButton type="button">
              <IconPlus className="h-4 w-4" /> Tạo trang mới
            </PrimaryButton>
          </Link>
        }
      />

      {pages.length === 0 ? (
        <div className="mt-6">
          <EmptyState icon={<IconDoc className="h-6 w-6" />} title="Chưa có trang CMS nào" description="Tạo trang đầu tiên để bắt đầu quản lý nội dung công khai." />
        </div>
      ) : (
        <div className="mt-6">
          <DataTable head={["Đường dẫn", "Tiêu đề", "Trạng thái", ""]}>
            {pages.map((cmsPage) => (
              <Tr key={cmsPage.id}>
                <Td className="font-mono text-xs text-gray-500">/{cmsPage.slug === "home" ? "" : `p/${cmsPage.slug}`}</Td>
                <Td className="font-medium">{cmsPage.title}</Td>
                <Td>
                  <Badge tone={cmsPage.status === "PUBLISHED" ? "success" : "neutral"}>{cmsPage.status === "PUBLISHED" ? "Xuất bản" : "Nháp"}</Badge>
                </Td>
                <Td>
                  <RowMenu label={`Chức năng cho trang ${cmsPage.title}`}>
                    <Link href={`/admin/cms/${cmsPage.slug}`}>
                      <MenuItemButton type="button" icon={<IconEdit />}>
                        Sửa nội dung
                      </MenuItemButton>
                    </Link>
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
