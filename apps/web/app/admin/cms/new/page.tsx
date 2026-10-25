import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { CmsPageForm } from "../cms-page-form";

export default async function AdminCmsNewPage() {
  await requireAdminAccess("/admin/cms/new");

  return (
    // Wrapper <div>: layout admin đã có <main>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader title="Tạo trang tuỳ chỉnh mới" />
      <SettingsGrid>
        <CmsPageForm
          slugEditable
          initial={{
            slug: "",
            title: "",
            blocksJson: JSON.stringify({ richText: "" }, null, 2),
            seoTitle: "",
            seoDescription: "",
            status: "DRAFT",
          }}
        />
      </SettingsGrid>
    </div>
  );
}
