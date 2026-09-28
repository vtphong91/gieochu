"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { POST_STATUS_LABELS } from "@gieochu/core/post";
import { Badge, RowActionButton } from "../../../../admin/_ui/kit";
import {
  IconEdit,
  IconExternalLink,
  IconEye,
  IconEyeOff,
  IconPin,
  IconTrash,
} from "../../../../admin/_ui/icons";
import {
  deletePostAction,
  pinPostAction,
  type PostActionState,
} from "../actions";
import {
  POST_STATUS_TONE,
  PRODUCT_STATUS_SUFFIX,
  type StudioPostStatus,
  type StudioProductStatus,
} from "./post-bits";

const INK = "#12213A";
const INK_SOFT = "#6B7280";
const LINE = "#E5E7EB";
const RED = "#B91C1C";
/** Link hành động cùng khung với `RowActionButton size="touch"` (44px dưới lg). */
const ROW_LINK =
  "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-lg px-3.5 text-sm font-semibold transition hover:brightness-95 lg:min-h-8 lg:px-2.5 lg:text-xs";

/** 1 bài trong danh sách — đã tuần tự hoá + định dạng ngày ở page (Server). */
export interface StudioPostListItem {
  id: string;
  /** Tiêu đề thật; null = bài không tiêu đề. */
  title: string | null;
  /** `postDisplayTitle` tính ở server — dùng khi không có tiêu đề. */
  displayTitle: string;
  excerpt: string;
  status: StudioPostStatus;
  hiddenReason: string | null;
  isPinned: boolean;
  /** Dòng thời gian đã định dạng giờ VN, ví dụ "Đăng 14:05 28/09/2026". */
  timeLabel: string;
  /** ISO để gắn `<time dateTime>`. */
  timeIso: string;
  updatedLabel: string | null;
  product: { title: string; status: StudioProductStatus } | null;
  /** Ảnh đầu bài (Cloudinary, đã tối ưu 320px); null = bài không có ảnh. */
  imageUrl: string | null;
}

/**
 * ADR-029 mục 5 (M10b) — danh sách bài viết Studio. Mỗi bài là 1 thẻ (đọc tốt cả mobile, không bảng cuộn ngang):
 * tiêu đề (link sang editor) + nhãn trạng thái/ghim có chữ, trích đoạn 2 dòng, thời gian giờ VN, tài liệu gắn kèm,
 * lý do ẩn. Hàng nút: Sửa (Xem với bài bị ẩn), Xem bài (PUBLISHED, tab mới), Ghim/Bỏ ghim (trừ HIDDEN), Xoá (xác
 * nhận). Server Action revalidate route → danh sách tự cập nhật; kết quả báo qua 1 vùng `role="status"` chung
 * (thẻ bị xoá biến mất nên không đặt thông báo trong thẻ) và focus chuyển về vùng đó sau khi xoá.
 */
export function StudioPostList({
  tenantSlug,
  items,
}: {
  tenantSlug: string;
  items: StudioPostListItem[];
}) {
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const liveRef = useRef<HTMLDivElement>(null);
  const base = `/studio/${tenantSlug}/posts`;

  function run(
    postId: string,
    action: () => Promise<PostActionState>,
    successText: string,
    focusLive: boolean,
  ) {
    setError(null);
    setAnnouncement("");
    setPendingId(postId);
    startTransition(async () => {
      const result = await action();
      setPendingId(null);
      if (result.ok) {
        setAnnouncement(successText);
        if (focusLive) liveRef.current?.focus();
      } else {
        setError(
          result.error ?? "Thao tác không thành công. Vui lòng thử lại.",
        );
        liveRef.current?.focus();
      }
    });
  }

  function remove(post: StudioPostListItem) {
    const name = post.title ?? post.displayTitle;
    if (!window.confirm(`Xoá vĩnh viễn bài “${name}”? Không khôi phục được.`))
      return;
    run(
      post.id,
      () => deletePostAction(tenantSlug, post.id),
      `Đã xoá bài “${name}”.`,
      true,
    );
  }

  function togglePin(post: StudioPostListItem) {
    const pinned = !post.isPinned;
    run(
      post.id,
      () => pinPostAction(tenantSlug, post.id, pinned),
      pinned
        ? "Đã ghim bài — bài ghim trước đó (nếu có) đã được bỏ ghim."
        : "Đã bỏ ghim bài.",
      false,
    );
  }

  return (
    <>
      <div
        ref={liveRef}
        tabIndex={-1}
        className="outline-none focus-visible:ring-2 focus-visible:ring-[#0F3B82]/30"
      >
        <p
          role="status"
          aria-live="polite"
          className={
            announcement
              ? "mb-3 rounded-lg border px-3.5 py-2.5 text-sm font-medium text-green-800"
              : "sr-only"
          }
          style={
            announcement
              ? { background: "#F0FDF4", borderColor: "#BBF7D0" }
              : undefined
          }
        >
          {announcement}
        </p>
        {error ? (
          <p
            role="alert"
            className="mb-3 rounded-lg border px-3.5 py-2.5 text-sm"
            style={{
              background: "#FEF2F2",
              borderColor: "#FCA5A5",
              color: RED,
            }}
          >
            {error}
          </p>
        ) : null}
      </div>

      <ul className="space-y-3" aria-label="Danh sách bài viết">
        {items.map((post) => {
          const hidden = post.status === "HIDDEN";
          const busy = isPending && pendingId === post.id;
          const titleId = `post-${post.id}-title`;
          const editHref = `${base}/${post.id}`;
          return (
            <li key={post.id}>
              <article
                aria-labelledby={titleId}
                aria-busy={busy || undefined}
                className="relative overflow-hidden rounded-2xl border bg-white p-4 sm:p-5"
                style={{
                  borderColor: hidden ? "#FCA5A5" : LINE,
                  opacity: busy ? 0.7 : 1,
                }}
              >
                {post.isPinned ? (
                  <span
                    aria-hidden="true"
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ background: "#0F3B82" }}
                  />
                ) : null}
                <div className="flex items-start gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={POST_STATUS_TONE[post.status]}>
                        {POST_STATUS_LABELS[post.status]}
                      </Badge>
                      {post.isPinned ? (
                        <Badge tone="info">
                          <IconPin className="mr-1 h-3.5 w-3.5" />
                          Đang ghim
                        </Badge>
                      ) : null}
                    </div>

                    <h2
                      id={titleId}
                      className="mt-2 font-[family-name:var(--font-heading)] text-base leading-snug font-semibold [overflow-wrap:anywhere]"
                    >
                      <Link
                        href={editHref}
                        className="underline-offset-2 hover:underline"
                        style={{ color: INK }}
                      >
                        {post.title ?? post.displayTitle}
                      </Link>
                      {post.title ? null : (
                        <span
                          className="ml-2 align-middle text-xs font-normal"
                          style={{ color: INK_SOFT }}
                        >
                          (không tiêu đề)
                        </span>
                      )}
                    </h2>

                    {post.excerpt && post.title ? (
                      <p
                        className="mt-1 line-clamp-2 text-sm leading-relaxed [overflow-wrap:anywhere]"
                        style={{ color: "#374151" }}
                      >
                        {post.excerpt}
                      </p>
                    ) : null}

                    <p
                      className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs"
                      style={{ color: INK_SOFT }}
                    >
                      <time dateTime={post.timeIso}>{post.timeLabel}</time>
                      {post.updatedLabel ? (
                        <span>{post.updatedLabel}</span>
                      ) : null}
                      {post.product ? (
                        <span className="[overflow-wrap:anywhere]">
                          Tài liệu:{" "}
                          <span className="font-medium" style={{ color: INK }}>
                            {post.product.title}
                          </span>
                          {PRODUCT_STATUS_SUFFIX[post.product.status]}
                        </span>
                      ) : null}
                    </p>

                    {hidden ? (
                      <p
                        className="mt-3 flex items-start gap-2 rounded-lg border px-3 py-2 text-sm"
                        style={{
                          background: "#FEF2F2",
                          borderColor: "#FCA5A5",
                          color: RED,
                        }}
                      >
                        <IconEyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                        <span>
                          <strong className="font-semibold">
                            Bị ẩn do vi phạm
                          </strong>
                          {post.hiddenReason ? (
                            <> — {post.hiddenReason}</>
                          ) : null}
                          . Bài không hiện công khai và không sửa được; bạn chỉ
                          có thể xoá.
                        </span>
                      </p>
                    ) : null}
                  </div>
                  {post.imageUrl ? (
                    // Ảnh trang trí (tiêu đề đã là tên của thẻ) → alt rỗng. Khung tỉ lệ cố định, không nhảy layout.
                    <div className="relative aspect-[4/3] w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:w-28">
                      {/* eslint-disable-next-line @next/next/no-img-element -- ảnh Cloudinary hệ thống, URL đã tối ưu 320px ở server */}
                      <img
                        src={post.imageUrl}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover"
                      />
                    </div>
                  ) : null}
                </div>

                <div
                  className="mt-3 flex flex-wrap items-center gap-2 border-t pt-3"
                  style={{ borderColor: LINE }}
                >
                  <Link
                    href={editHref}
                    className={ROW_LINK}
                    style={{ background: "#E8F1FF", color: "#0F3B82" }}
                  >
                    {hidden ? (
                      <IconEye className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    ) : (
                      <IconEdit className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    )}
                    {hidden ? "Xem" : "Sửa"}
                    <span className="sr-only">
                      {" "}
                      bài {post.title ?? post.displayTitle}
                    </span>
                  </Link>
                  {post.status === "PUBLISHED" ? (
                    <a
                      href={`/${tenantSlug}/posts/${post.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={ROW_LINK}
                      style={{ background: "#F3F4F6", color: "#374151" }}
                    >
                      <IconExternalLink className="h-4 w-4 lg:h-3.5 lg:w-3.5" />
                      Xem bài
                      <span className="sr-only"> đã đăng (mở tab mới)</span>
                    </a>
                  ) : null}
                  {!hidden ? (
                    <RowActionButton
                      size="touch"
                      type="button"
                      tone={post.isPinned ? "neutral" : "primary"}
                      disabled={isPending}
                      onClick={() => togglePin(post)}
                    >
                      <IconPin className="mr-1.5 h-4 w-4 lg:h-3.5 lg:w-3.5" />
                      {busy
                        ? "Đang lưu..."
                        : post.isPinned
                          ? "Bỏ ghim"
                          : "Ghim"}
                    </RowActionButton>
                  ) : null}
                  <RowActionButton
                    size="touch"
                    type="button"
                    tone="danger"
                    disabled={isPending}
                    onClick={() => remove(post)}
                    className="ml-auto inline-flex min-h-11 items-center justify-center rounded-lg px-3.5 text-sm font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 lg:min-h-8 lg:px-2.5 lg:text-xs"
                  >
                    <IconTrash className="mr-1.5 h-4 w-4 lg:h-3.5 lg:w-3.5" />
                    Xoá
                    <span className="sr-only">
                      {" "}
                      bài {post.title ?? post.displayTitle}
                    </span>
                  </RowActionButton>
                </div>
              </article>
            </li>
          );
        })}
      </ul>
    </>
  );
}
