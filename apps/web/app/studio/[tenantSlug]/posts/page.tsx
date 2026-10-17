import Link from "next/link";
import type { Metadata } from "next";
import type { PostStatus } from "@gieochu/db";
import { requireTenantMemberPage } from "../../../../lib/page-guards";
import { isValidPostId, listTenantPosts, postDisplayTitle } from "../../../../lib/post";
import { AdminPageHeader, EmptyState, PrimaryLinkButton } from "../../../admin/_ui/kit";
import { IconNewspaper, IconPlus } from "../../../admin/_ui/icons";
import { formatPostDateTime } from "./_ui/post-bits";
import { StudioPostList, type StudioPostListItem } from "./_ui/post-list";

export const metadata: Metadata = { title: "Bài viết" };

const STATUSES: readonly PostStatus[] = ["DRAFT", "PUBLISHED", "HIDDEN"];

const INK = "#12213A";
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const TAB_CLASS = "inline-flex min-h-11 items-center gap-2 rounded-lg px-4 text-sm font-semibold transition-colors lg:min-h-9";
const TAB_ACTIVE = { background: INK, color: "white" };
const TAB_IDLE = { color: "#4B5563", background: "white", boxShadow: `inset 0 0 0 1px ${LINE}` };
const LINK_BTN = "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border bg-white px-4 text-sm font-semibold hover:bg-gray-50 lg:min-h-10";

const TABS: { status: PostStatus | null; label: string }[] = [
  { status: null, label: "Tất cả" },
  { status: "PUBLISHED", label: "Đã đăng" },
  { status: "DRAFT", label: "Bản nháp" },
  { status: "HIDDEN", label: "Bị ẩn" },
];

const EMPTY_TEXT: Record<PostStatus, { title: string; description: string }> = {
  DRAFT: { title: "Không có bản nháp", description: "Bài bạn “Lưu nháp” hoặc gỡ xuống sẽ nằm ở đây." },
  PUBLISHED: { title: "Chưa có bài nào đã đăng", description: "Bài đã đăng hiện ở trang Bài viết và section “Bài viết” trên trang bán hàng." },
  HIDDEN: { title: "Không có bài bị ẩn", description: "Bài vi phạm quy định bị hệ thống ẩn sẽ hiện ở đây kèm lý do." },
};

function one(value: string | string[] | undefined): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/**
 * ADR-029 mục 5 (M10b) — Studio → Bài viết. searchParams: `status` (DRAFT | PUBLISHED | HIDDEN), `cursor` (id mục cuối
 * trang trước, 20 bài/trang, bài ghim đứng đầu). Tab trạng thái là link (không cần JS, URL chia sẻ được); thao tác
 * trên từng bài ở `_ui/post-list.tsx`.
 */
export default async function StudioPostsPage({
  params,
  searchParams,
}: {
  params: Promise<{ tenantSlug: string }>;
  searchParams: Promise<{ status?: string | string[]; cursor?: string | string[] }>;
}) {
  const { tenantSlug } = await params;
  const { tenant } = await requireTenantMemberPage(tenantSlug, `/studio/${tenantSlug}/posts`);
  const raw = await searchParams;
  const statusParam = one(raw.status);
  const status = STATUSES.find((s) => s === statusParam);
  const cursorParam = one(raw.cursor);
  const cursor = cursorParam && isValidPostId(cursorParam) ? cursorParam : null;

  const page = await listTenantPosts(tenant.id, status ? { status } : {}, cursor);
  const base = `/studio/${tenant.slug}/posts`;
  const tabHref = (s: PostStatus | null) => (s ? `${base}?status=${s}` : base);
  const firstPageHref = tabHref(status ?? null);
  const nextHref = page.nextCursor ? `${base}?${new URLSearchParams({ ...(status ? { status } : {}), cursor: page.nextCursor }).toString()}` : null;

  const items: StudioPostListItem[] = page.items.map((post) => {
    const shownAt = post.publishedAt ?? post.createdAt;
    const edited = post.updatedAt.getTime() - shownAt.getTime() > 60_000;
    return {
      id: post.id,
      title: post.title,
      displayTitle: postDisplayTitle(post),
      excerpt: post.excerpt,
      status: post.status,
      hiddenReason: post.hiddenReason,
      moderationLocked: post.moderationLockedAt !== null,
      moderationReason: post.moderationReason,
      isPinned: post.isPinned,
      timeLabel: `${post.publishedAt ? "Đăng" : "Tạo"} ${formatPostDateTime(shownAt)}`,
      timeIso: shownAt.toISOString(),
      updatedLabel: edited ? `Sửa ${formatPostDateTime(post.updatedAt)}` : null,
      product: post.product ? { title: post.product.title, status: post.product.status } : null,
      imageUrl: post.imageUrl,
    };
  });

  const empty = status ? EMPTY_TEXT[status] : { title: "Chưa có bài viết nào", description: "Chia sẻ kinh nghiệm, cập nhật tài liệu mới hoặc mẹo học tập để khách quay lại trang của bạn." };

  return (
    // Nằm trong app shell Studio (layout đã có <main>) → dùng <div>.
    <div className="px-5 py-8 lg:px-8">
      <AdminPageHeader
        title="Bài viết"
        subtitle="Bài đã đăng hiện ở trang Bài viết của bạn và section “Bài viết” trên trang bán hàng. Ghim 1 bài để luôn đứng đầu."
        action={
          <PrimaryLinkButton href={`${base}/new`}>
            <IconPlus className="h-4 w-4" /> Viết bài
          </PrimaryLinkButton>
        }
      />

      <nav className="mt-6 flex flex-wrap gap-2" aria-label="Lọc theo trạng thái">
        {TABS.map((tab) => {
          const active = (status ?? null) === tab.status;
          return (
            <Link key={tab.label} href={tabHref(tab.status)} className={TAB_CLASS} style={active ? TAB_ACTIVE : TAB_IDLE} aria-current={active ? "page" : undefined}>
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-5">
        {items.length === 0 ? (
          <EmptyState
            icon={<IconNewspaper className="h-6 w-6" />}
            title={cursor ? "Không còn bài nào" : empty.title}
            description={cursor ? "Bạn đã xem hết danh sách." : empty.description}
            action={
              cursor ? (
                <Link href={firstPageHref} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
                  Về trang đầu
                </Link>
              ) : status ? (
                <Link href={base} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
                  Xem tất cả bài viết
                </Link>
              ) : (
                <PrimaryLinkButton href={`${base}/new`}>
                  <IconPlus className="h-4 w-4" /> Viết bài đầu tiên
                </PrimaryLinkButton>
              )
            }
          />
        ) : (
          <StudioPostList tenantSlug={tenant.slug} items={items} />
        )}
      </div>

      {items.length > 0 && (cursor || nextHref) ? (
        <nav className="mt-6 flex flex-wrap items-center gap-3 text-sm" aria-label="Phân trang">
          {cursor ? (
            <Link href={firstPageHref} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
              ← Về trang đầu
            </Link>
          ) : null}
          {nextHref ? (
            <Link href={nextHref} className={LINK_BTN} style={{ borderColor: LINE, color: INK }}>
              Trang sau →
            </Link>
          ) : (
            <span style={{ color: INK_SOFT }}>Đã hết danh sách.</span>
          )}
        </nav>
      ) : null}
    </div>
  );
}
