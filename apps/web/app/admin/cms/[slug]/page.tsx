import { notFound } from "next/navigation";
import { getPrismaClient } from "@gieochu/db";
import { homeSectionsSchema } from "@gieochu/core";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { CmsPageForm } from "../cms-page-form";
import { HomeSectionsEditor } from "../home-editor/home-sections-editor";

export default async function AdminCmsEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAdminAccess(`/admin/cms/${slug}`);

  const prisma = getPrismaClient();
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page) notFound();

  if (page.slug === "home") {
    const live = homeSectionsSchema.safeParse(page.blocks);
    const draft = page.blocksDraft ? homeSectionsSchema.safeParse(page.blocksDraft) : null;
    if (!live.success) notFound();

    return (
      <main className="px-5 py-8 lg:px-8">
        <AdminPageHeader title="Landing Page CMS" subtitle="Chỉnh nội dung trang chủ. Lưu nháp trước, Publish khi sẵn sàng." />
        <HomeSectionsEditor pageId={page.id} live={live.data} draft={draft?.success ? draft.data : null} />
      </main>
    );
  }

  return (
    <main className="px-5 py-8 lg:px-8">
      <AdminPageHeader title={`Sửa trang CMS — ${page.title}`} />
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
    </main>
  );
}
