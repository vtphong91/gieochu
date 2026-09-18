import { notFound } from "next/navigation";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { CmsPageForm } from "../cms-page-form";

export default async function AdminCmsEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAdminAccess(`/admin/cms/${slug}`);

  const prisma = getPrismaClient();
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page) notFound();

  return (
    <main className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">Sửa trang CMS — {page.title}</h1>
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
    </main>
  );
}
