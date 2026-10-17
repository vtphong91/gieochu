import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AppError, POST_STATUS_LABELS } from "@gieochu/core";
import { requireTenantMemberPage } from "../../../../../lib/page-guards";
import { getPostForEditor, postDisplayTitle, type PostEditorData } from "../../../../../lib/post";
import { AdminPageHeader, GhostLinkButton } from "../../../../admin/_ui/kit";
import { IconChevronLeft } from "../../../../admin/_ui/icons";
import { formatPostDateTime } from "../_ui/post-bits";
import { PostEditor, type PostCreatedNotice } from "../_ui/post-editor";

export const metadata: Metadata = { title: "Sửa bài viết" };

const CREATED_NOTICES: readonly PostCreatedNotice[] = ["draft", "published"];

/**
 * ADR-029 mục 5 (M10b) — trang sửa bài. Editor dùng chung (`_ui/post-editor.tsx`) gọi `updatePostAction`,
 * `pinPostAction`, `deletePostAction`. Bài HIDDEN → editor khoá, chỉ xem + xoá. Không tồn tại / không thuộc tenant → 404.
 * `?created=draft|published`: trang Tạo chuyển sang kèm kết quả lần lưu đầu (chỉ nhận giá trị đã biết).
 */
export default async function StudioEditPostPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string; postId: string }>;
  searchParams: Promise<{ created?: string | string[] }>;
}) {
  const { tenantSlug, postId } = await params;
  const { created } = await searchParams;
  const notice = CREATED_NOTICES.find((value) => value === created) ?? null;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/posts/${postId}`);

  let data: PostEditorData;
  try {
    data = await getPostForEditor(tenant.id, postId);
  } catch (error) {
    if (error instanceof AppError && error.httpStatus === 404) notFound();
    throw error;
  }
  const { post, productOptions } = data;

  return (
    // Wrapper là <div> — studio/layout.tsx đã có <main>.
    <div className="px-5 pt-8 pb-12 lg:px-8">
      <PostEditor
        mode="edit"
        tenantSlug={tenant.slug}
        notice={notice}
        productOptions={productOptions.map((p) => ({ id: p.id, title: p.title, status: p.status }))}
        post={{
          id: post.id,
          title: post.title ?? "",
          body: post.body,
          bodyHtml: post.bodyHtml,
          productId: post.productId ?? "",
          status: post.status,
          hiddenReason: post.hiddenReason,
          // ADR-038: khoá kiểm duyệt — chỉ nhãn loại vi phạm + thời điểm, không danh tính người báo cáo.
          moderationLock: post.moderationLockedAt
            ? { reason: post.moderationReason, lockedAtLabel: formatPostDateTime(post.moderationLockedAt) }
            : null,
          isPinned: post.isPinned,
          publishedLabel: post.publishedAt ? formatPostDateTime(post.publishedAt) : null,
        }}
        header={
          <AdminPageHeader
            title={postDisplayTitle(post)}
            subtitle={`${POST_STATUS_LABELS[post.status]}${post.isPinned ? " · Đang ghim" : ""} · cập nhật ${formatPostDateTime(post.updatedAt)}`}
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
