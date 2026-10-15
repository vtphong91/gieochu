import Link from "next/link";
import { HOME_CMS_SLUG, isSystemCmsSlug, SHOP_CMS_SLUG } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { AdminPageHeader, Badge, DataTable, EmptyState, PrimaryButton, Td, Tr } from "../_ui/kit";
import { IconDoc, IconEdit, IconPlus } from "../_ui/icons";
import { MenuItemButton, RowMenu } from "../_ui/row-menu";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";

/** Đường dẫn công khai của trang CMS (ADR-035: `home` → `/`, `shop` → `/cua-hang`, còn lại `/p/{slug}`). */
function publicPathOf(slug: string): string {
  if (slug === HOME_CMS_SLUG) return "/";
  if (slug === SHOP_CMS_SLUG) return "/cua-hang";
  return `/p/${slug}`;
}

/** Trang hệ thống có editor riêng; trang khác dùng form JSON chung. Slug hệ thống lệch hoa/thường (dữ liệu cũ) → không có link sửa. */
function editPathOf(slug: string): string | null {
  if (slug === HOME_CMS_SLUG) return "/admin/cms/home";
  if (slug === SHOP_CMS_SLUG) return "/admin/cms/shop";
  return isSystemCmsSlug(slug) ? null : `/admin/cms/${slug}`;
}

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
                <Td className="font-mono text-xs text-gray-500">{publicPathOf(cmsPage.slug)}</Td>
                <Td className="font-medium">{cmsPage.title}</Td>
                <Td>
                  <Badge tone={cmsPage.status === "PUBLISHED" ? "success" : "neutral"}>{cmsPage.status === "PUBLISHED" ? "Xuất bản" : "Nháp"}</Badge>
                </Td>
                <Td>
                  {editPathOf(cmsPage.slug) ? (
                    <RowMenu label={`Chức năng cho trang ${cmsPage.title}`}>
                      <Link href={editPathOf(cmsPage.slug) ?? ""}>
                        <MenuItemButton type="button" icon={<IconEdit />}>
                          Sửa nội dung
                        </MenuItemButton>
                      </Link>
                    </RowMenu>
                  ) : null}
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
