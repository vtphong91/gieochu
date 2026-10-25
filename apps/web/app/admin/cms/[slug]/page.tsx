import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPrismaClient } from "@gieochu/db";
import { HOME_CMS_SLUG, isSystemCmsSlug } from "@gieochu/core";
import { getHomeStats } from "../../../../lib/home";
import { getHomeCmsEditorData } from "../../../../lib/home-cms";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { ModuleTabs } from "../../_ui/module-tabs";
import { CMS_HOME_TAB, CMS_TABS, CMS_TABS_LABEL } from "../_ui/cms-tabs";
import { CmsPageForm } from "../cms-page-form";
import { HomeSectionsEditor } from "../home-editor/home-sections-editor";
import { toProductPinOption, toTenantPinOption } from "../home-editor/pin-options";

/** ADR-058: title riêng cho tab "Trang chủ" của nhóm Trang CMS; trang tuỳ chỉnh dùng tiêu đề trang. */
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  return { title: slug === HOME_CMS_SLUG ? "Trang chủ — Trang CMS" : "Sửa trang tuỳ chỉnh" };
}

export default async function AdminCmsEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAdminAccess(`/admin/cms/${slug}`);
  // ADR-035 bổ sung: slug hệ thống khác `home` (vd `shop` — có route tĩnh `/admin/cms/shop`) không mở form JSON chung.
  if (isSystemCmsSlug(slug) && slug !== HOME_CMS_SLUG) notFound();

  if (slug === HOME_CMS_SLUG) {
    // ADR-050: mở được cả khi chưa có dòng `home` (editor nạp nội dung mặc định, lần lưu đầu tạo dòng).
    // ADR-050 lần 3: số liệu thật (cùng `getHomeStats` của trang chủ, chỉ số đếm công khai) để admin chọn ngưỡng thẻ Hero.
    const [data, liveStats] = await Promise.all([getHomeCmsEditorData(), getHomeStats()]);
    // ADR-058: tab "Trang chủ" của nhóm Trang CMS — h1 là tên nhóm, subtitle nói rõ tab đang sửa gì.
    // Wrapper <div>: layout admin đã có <main>.
    return (
      <div className="px-5 py-8 lg:px-8">
        <AdminPageHeader title="Trang CMS" subtitle="Trang chủ — chỉnh nội dung trang chủ. Lưu nháp trước, Xuất bản khi sẵn sàng. Dùng {brand} thay cho tên nền tảng." />
        <ModuleTabs label={CMS_TABS_LABEL} items={CMS_TABS} current={CMS_HOME_TAB} />
        <HomeSectionsEditor
          live={data.live}
          initialSections={data.sections}
          initialHasDraft={data.hasDraft}
          initialStatus={data.status}
          initialSeo={{ seoTitle: data.seoTitle, seoDescription: data.seoDescription }}
          liveStats={liveStats}
          pinOptions={{ tenants: data.pinOptions.tenants.map(toTenantPinOption), products: data.pinOptions.products.map(toProductPinOption) }}
        />
      </div>
    );
  }

  const prisma = getPrismaClient();
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page) notFound();

  return (
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title={`Sửa trang tuỳ chỉnh — ${page.title}`} />
      <SettingsGrid>
        <CmsPageForm
          slugEditable={false}
          initial={{
            slug: page.slug,
            title: page.title,
            blocksJson: JSON.stringify(page.blocks, null, 2),
            seoTitle: page.seoTitle ?? "",
            seoDescription: page.seoDescription ?? "",
            status: page.status,
          }}
        />
      </SettingsGrid>
    </div>
  );
}
