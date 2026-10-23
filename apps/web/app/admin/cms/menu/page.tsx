import { isSystemCmsSlug, NAV_PAGE_LABELS, NAV_PAGE_PATHS, type NavPageKey } from "@gieochu/core";
import { DISPLAY_TIME_ZONE } from "@gieochu/core/system-settings";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { getSiteMenuEditorData } from "../../../../lib/site-menu";
import { AdminPageHeader, Notice } from "../../_ui/kit";
import { MenuEditor, type MenuPageOption } from "./menu-editor";

/**
 * ADR-050 mục 1 — editor menu header/footer (`CmsPage` slug `menu`). Segment tĩnh `menu` thắng `[slug]`, xử lý được
 * cả khi chưa có dòng (loader trả menu mặc định). Wrapper <div>: layout admin đã có <main>.
 */
export default async function AdminMenuCmsPage() {
  await requireAdminAccess("/admin/cms/menu");
  const [data, cmsPages] = await Promise.all([
    getSiteMenuEditorData(),
    getPrismaClient().cmsPage.findMany({ select: { slug: true, title: true, status: true }, orderBy: { slug: "asc" }, take: 200 }),
  ]);

  const pageOptions: MenuPageOption[] = [
    ...(Object.keys(NAV_PAGE_PATHS) as NavPageKey[]).map((key) => ({ value: key, label: `${NAV_PAGE_LABELS[key]} (${NAV_PAGE_PATHS[key]})`, published: true })),
    ...cmsPages
      .filter((page) => !isSystemCmsSlug(page.slug) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug))
      .map((page) => ({ value: `cms:${page.slug}`, label: `Trang CMS: ${page.title} (/p/${page.slug})`, published: page.status === "PUBLISHED" })),
  ];

  const updatedAtLabel = data.updatedAt
    ? data.updatedAt.toLocaleString("vi-VN", { timeZone: DISPLAY_TIME_ZONE, hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" })
    : null;

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Menu header & footer"
        subtitle="Chỉnh các mục menu đầu trang, nút kêu gọi và các cột chân trang dùng chung mọi trang công khai. Lưu nháp trước, Xuất bản khi sẵn sàng."
      />
      <div className="mt-6">
        <Notice tone="info">
          Dòng bản quyền dùng được <code>{"{năm}"}</code> (năm hiện tại theo giờ Việt Nam) và <code>{"{brand}"}</code> (tên nền tảng). “Đăng nhập” và menu tài
          khoản do hệ thống tự hiện theo trạng thái đăng nhập — không cấu hình ở đây.
        </Notice>
      </div>
      <MenuEditor
        initialMenu={data.menu}
        live={data.live}
        initialHasDraft={data.hasDraft}
        initialStatus={data.status}
        updatedAtLabel={updatedAtLabel}
        pageOptions={pageOptions}
      />
    </div>
  );
}
