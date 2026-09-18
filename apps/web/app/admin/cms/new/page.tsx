import { requireAdminAccess } from "../../../../lib/page-guards";
import { CmsPageForm } from "../cms-page-form";

export default async function AdminCmsNewPage() {
  await requireAdminAccess("/admin/cms/new");

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Tạo trang CMS mới</h1>
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
    </main>
  );
}
