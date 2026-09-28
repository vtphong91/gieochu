import type { Metadata } from "next";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { listPostProductOptions } from "../../../../../lib/post";
import { AdminPageHeader, GhostLinkButton } from "../../../../admin/_ui/kit";
import { IconChevronLeft } from "../../../../admin/_ui/icons";
import { PostEditor } from "../_ui/post-editor";

export const metadata: Metadata = { title: "Viết bài mới" };

/**
 * ADR-029 mục 5 (M10b) — trang tạo bài. Editor dùng chung với trang Sửa (`_ui/post-editor.tsx`): gọi
 * `createPostAction`, lưu xong chuyển sang `/studio/[slug]/posts/[postId]?created=`. Ảnh: chữ ký POST + register "POST".
 */
export default async function StudioNewPostPage({ params }: { params: Promise<{ tenantSlug: string }> }) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/posts/new`);
  const productOptions = await listPostProductOptions(tenant.id);

  // Wrapper là <div> — studio/layout.tsx đã có <main>.
  return (
    <div className="px-5 pt-8 pb-12 lg:px-8">
      <PostEditor
        mode="create"
        tenantSlug={tenant.slug}
        productOptions={productOptions.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
        header={
          <AdminPageHeader
            title="Viết bài mới"
            subtitle="Tiêu đề tuỳ chọn, tối đa 6 ảnh mỗi bài, gắn kèm 1 tài liệu nếu muốn. Bài là bản nháp cho tới khi bạn bấm Đăng bài."
            action={
              <GhostLinkButton href={`/studio/${tenant.slug}/posts`}>
                <IconChevronLeft className="h-4 w-4" /> Danh sách bài viết
              </GhostLinkButton>
            }
          />
        }
      />
    </div>
  );
}
