import { notFound } from "next/navigation";
import { getPrismaClient } from "@gieochu/db";
import { parseHomeSections, type HomeSection } from "@gieochu/core";
import { listHomeProductOptions, listHomeTenantOptions } from "../../../../lib/home";
import { requireAdminAccess } from "../../../../lib/page-guards";
import { AdminPageHeader, SettingsGrid } from "../../_ui/kit";
import { CmsPageForm } from "../cms-page-form";
import { HomeSectionsEditor } from "../home-editor/home-sections-editor";
import { toProductPinOption, toTenantPinOption } from "../home-editor/pin-options";

/** Id đang ghim ở mọi section coaches/documents (live + nháp) — để ô chọn luôn hiện được tên. */
function collectPinnedIds(sections: HomeSection[]): { tenantIds: string[]; productIds: string[] } {
  const tenantIds = new Set<string>();
  const productIds = new Set<string>();
  for (const section of sections) {
    if (section.type === "coaches") section.data.pinnedTenantIds.forEach((id) => tenantIds.add(id));
    if (section.type === "documents") section.data.pinnedProductIds.forEach((id) => productIds.add(id));
  }
  return { tenantIds: [...tenantIds], productIds: [...productIds] };
}

export default async function AdminCmsEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  await requireAdminAccess(`/admin/cms/${slug}`);

  const prisma = getPrismaClient();
  const page = await prisma.cmsPage.findUnique({ where: { slug } });
  if (!page) notFound();

  if (page.slug === "home") {
    // ADR-033 mục 6: parse phòng thủ — dữ liệu nhập tay cũ của stats/search/coaches/documents chuyển sang dạng mới.
    const live = parseHomeSections(page.blocks);
    const draft = page.blocksDraft ? parseHomeSections(page.blocksDraft) : null;
    if (!live) notFound();
    const pinned = collectPinnedIds([...live, ...(draft ?? [])]);
    const [tenantOptions, productOptions] = await Promise.all([
      listHomeTenantOptions({ includeIds: pinned.tenantIds }),
      listHomeProductOptions({ includeIds: pinned.productIds }),
    ]);

    return (
      <main className="px-5 py-8 lg:px-8">
        <AdminPageHeader title="Landing Page CMS" subtitle="Chỉnh nội dung trang chủ. Lưu nháp trước, Publish khi sẵn sàng." />
        <HomeSectionsEditor
          pageId={page.id}
          live={live}
          draft={draft}
          pinOptions={{ tenants: tenantOptions.map(toTenantPinOption), products: productOptions.map(toProductPinOption) }}
        />
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
