import Link from "next/link";
import { HOME_CMS_SLUG, isSystemCmsSlug, MENU_CMS_SLUG, PRICING_CMS_SLUG, SHOP_CMS_SLUG, SYSTEM_CMS_SLUGS } from "@gieochu/core";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";
import { AdminPageHeader, Badge, DataTable, EmptyState, PrimaryButton, Td, Tr } from "../_ui/kit";
import { IconDoc, IconEdit, IconPlus } from "../_ui/icons";
import { MenuItemButton, RowMenu } from "../_ui/row-menu";
import { Pagination } from "../_ui/pagination";
import { parsePagination } from "../_ui/pagination-utils";

/** Đường dẫn công khai của trang CMS (ADR-035: `home` → `/`, `shop` → `/cua-hang`; ADR-041: `pricing` → `/pricing`; còn lại `/p/{slug}`). */
function publicPathOf(slug: string): string {
  if (slug === HOME_CMS_SLUG) return "/";
  if (slug === SHOP_CMS_SLUG) return "/cua-hang";
  if (slug === PRICING_CMS_SLUG) return "/pricing";
  if (slug === MENU_CMS_SLUG) return "(header/footer mọi trang)";
  return `/p/${slug}`;
}

/** Trang hệ thống có editor riêng; trang khác dùng form JSON chung. Slug hệ thống lệch hoa/thường (dữ liệu cũ) → không có link sửa. */
function editPathOf(slug: string): string | null {
  if (slug === HOME_CMS_SLUG) return "/admin/cms/home";
  if (slug === SHOP_CMS_SLUG) return "/admin/cms/shop";
  if (slug === PRICING_CMS_SLUG) return "/admin/cms/pricing";
  if (slug === MENU_CMS_SLUG) return "/admin/cms/menu";
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
  // ADR-058 bổ sung: chỉ trang tuỳ chỉnh — ẩn slug hệ thống (home/menu/shop/pricing có mục sửa riêng). Lọc ngay trong truy
  // vấn để tổng số + phân trang khớp với danh sách hiển thị.
  const where = { slug: { notIn: [...SYSTEM_CMS_SLUGS] } };
  const [pages, total] = await Promise.all([
    prisma.cmsPage.findMany({ where, orderBy: { slug: "asc" }, skip, take }),
    prisma.cmsPage.count({ where }),
  ]);

  return (
    // Wrapper <div>: layout admin đã có <main>. ADR-058 bổ sung: mục sidebar riêng "Trang tuỳ chỉnh" (`/p/[slug]`).
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Trang tuỳ chỉnh"
        subtitle="Các trang công khai riêng tại /p/… (giới thiệu, liên hệ...). Trang chủ, menu, cửa hàng và bảng giá có mục sửa riêng."
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
          <EmptyState icon={<IconDoc className="h-6 w-6" />} title="Chưa có trang tuỳ chỉnh nào" description="Tạo trang đầu tiên (vd giới thiệu, liên hệ) — trang hiển thị tại /p/{đường dẫn}." />
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
    </div>
  );
}
