import Link from "next/link";
import { getPrismaClient } from "@gieochu/db";
import { requireAdminAccess } from "../../../lib/page-guards";

export default async function AdminCmsListPage() {
  await requireAdminAccess("/admin/cms");

  const prisma = getPrismaClient();
  const pages = await prisma.cmsPage.findMany({ orderBy: { slug: "asc" } });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Trang CMS</h1>
        <Link href="/admin/cms/new" className="text-[var(--color-primary)]">
          + Tạo trang mới
        </Link>
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b text-gray-500">
            <th className="py-2">Slug</th>
            <th className="py-2">Tiêu đề</th>
            <th className="py-2">Trạng thái</th>
            <th className="py-2"></th>
          </tr>
        </thead>
        <tbody>
          {pages.map((page) => (
            <tr key={page.id} className="border-b">
              <td className="py-2">/{page.slug === "home" ? "" : `p/${page.slug}`}</td>
              <td className="py-2">{page.title}</td>
              <td className="py-2">{page.status === "PUBLISHED" ? "Xuất bản" : "Nháp"}</td>
              <td className="py-2">
                <Link href={`/admin/cms/${page.slug}`} className="text-[var(--color-primary)]">
                  Sửa
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
