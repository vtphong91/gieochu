"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { POST_MAX_IMAGES, POST_STATUS_LABELS, POST_TITLE_MAX_LENGTH } from "@gieochu/core/post";
import { TiptapEditor, type TiptapImageUpload } from "../../../../_ui/editor/tiptap-editor";
import type { CloudinarySignatureResult } from "../../../../_ui/cloudinary-actions";
import { Badge, ConfigCard, SelectField } from "../../../../admin/_ui/kit";
import { IconAlertTriangle, IconCheckCircle, IconExternalLink, IconEyeOff, IconNewspaper, IconPackage, IconPin, IconShield, IconTrash } from "../../../../admin/_ui/icons";
import { registerTenantImageAction } from "../../media-actions";
import { GHOST_BTN, GREEN_TEXT, LockedNotice, PRIMARY_BTN, WarningNote } from "../../products/_ui/editor-bits";
import { createPostAction, deletePostAction, getPostImageUploadSignatureAction, pinPostAction, updatePostAction, type PostActionState } from "../actions";
import { countBodyImages, POST_STATUS_TONE, PRODUCT_STATUS_SUFFIX, type StudioPostStatus, type StudioProductStatus } from "./post-bits";

const RED = "#DC2626";
const RED_SOFT = "#FEF2F2";
const RED_LINE = "#FCA5A5";
const AMBER = "#B45309";
const GREEN_SOFT = "#F0FDF4";
const GREEN_LINE = "#BBF7D0";
const GRAY_LINE = "#E5E7EB";
const INK_SOFT = "#6B7280";

/** Field FormData → nhãn trong tóm tắt lỗi (id phần tử nhận focus = tên field). */
const FIELD_LABEL: Record<string, string> = {
  title: "Tiêu đề",
  body: "Nội dung",
  productId: "Tài liệu liên quan",
  status: "Trạng thái",
};

/** Mã lỗi mà trang cần tải lại dữ liệu (bài vừa bị ẩn / bị xoá ở nơi khác). */
const REFRESH_CODES = new Set(["POST_HIDDEN_LOCKED", "POST_NOT_FOUND"]);

const TOO_MANY_IMAGES = `Mỗi bài tối đa ${POST_MAX_IMAGES} ảnh — xoá bớt ảnh trước khi chèn ảnh mới.`;

export interface PostProductOptionView {
  id: string;
  title: string;
  status: StudioProductStatus;
}

/** Bài đang sửa — đã tuần tự hoá ở page (Date → chuỗi đã định dạng giờ VN). */
export interface EditorPost {
  id: string;
  /** "" = không tiêu đề. */
  title: string;
  /** HTML đã sanitize lúc lưu — chỉ nạp vào TiptapEditor. */
  body: string;
  /** HTML sanitize lại lúc đọc (`getPostForEditor`) — dùng cho mọi chỗ render bằng dangerouslySetInnerHTML. */
  bodyHtml: string;
  /** "" = không gắn tài liệu. */
  productId: string;
  status: StudioPostStatus;
  hiddenReason: string | null;
  isPinned: boolean;
  publishedLabel: string | null;
}

/** Kết quả lần lưu đầu ở trang Tạo — trang Sửa nhận qua `?created=`. */
export type PostCreatedNotice = "draft" | "published";

type EditorProps = {
  tenantSlug: string;
  header: ReactNode;
  productOptions: PostProductOptionView[];
} & ({ mode: "create" } | { mode: "edit"; post: EditorPost; notice: PostCreatedNotice | null });

type SubmitKey = "publish" | "draft" | "save" | "unpublish";

function countChars(value: string): number {
  return Array.from(value).length;
}

/** Kết quả "chữ ký" giả để TiptapEditor hiện lỗi ngay khi đã đủ ảnh (không gọi server, không upload). */
function blockedSignature(): CloudinarySignatureResult {
  return {
    ok: false,
    error: TOO_MANY_IMAGES,
    errorCode: "POST_TOO_MANY_IMAGES",
    cloudName: "",
    apiKey: "",
    timestamp: 0,
    folder: "",
    signature: "",
    uploadParams: {},
  };
}

/**
 * ADR-029 mục 5 (M10b) — editor Tạo/Sửa bài viết, cùng bố cục editor sản phẩm (ADR-026 §5):
 * - ≥ xl: khung tối đa 1440px; cột chính (tiêu đề tuỳ chọn + nội dung Tiptap) + sidebar 360px. Card xuất bản đứng
 *   đầu sidebar và dính khi cuộn; card "Tài liệu liên quan" và "Ghim" cuộn bình thường.
 * - < xl: 1 cột; card xuất bản ở CUỐI (điền rồi mới lưu) + thanh lưu nhanh dính đáy khi có thay đổi.
 * Nút: chưa đăng → [Đăng bài] (type=button, gửi PUBLISHED) + [Lưu nháp] (submit mặc định — Enter không vô tình đăng);
 * đã đăng → [Lưu thay đổi] (không gửi status = giữ) + [Gỡ bài] (xác nhận, gửi DRAFT) + link "Xem bài đã đăng".
 * Bài HIDDEN: khoá toàn bộ, chỉ xem nội dung + Xoá. Ảnh: chữ ký POST + register "POST"; đếm `<img>` trong nội dung,
 * chặn chèn ảnh thứ 7 ở client (server vẫn kiểm `POST_TOO_MANY_IMAGES`).
 * Submit thủ công (startTransition + dispatch) để form KHÔNG tự reset khi lưu lỗi. Trang Tạo lưu xong → sang trang Sửa.
 */
export function PostEditor(props: EditorProps) {
  const { tenantSlug, header, productOptions } = props;
  const isEdit = props.mode === "edit";
  const post = isEdit ? props.post : null;
  const notice = isEdit ? props.notice : null;
  const status: StudioPostStatus | null = post?.status ?? null;
  const hidden = status === "HIDDEN";
  const published = status === "PUBLISHED";

  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const actionsRef = useRef<HTMLDivElement>(null);
  const [actionsInView, setActionsInView] = useState(false);

  const [title, setTitle] = useState(post?.title ?? "");
  const [body, setBody] = useState(post?.body ?? "");
  const [productId, setProductId] = useState(post?.productId ?? "");
  const [dirty, setDirty] = useState(false);
  const [pendingKey, setPendingKey] = useState<SubmitKey | null>(null);
  const [clientError, setClientError] = useState<PostActionState | null>(null);

  const imageCount = countBodyImages(body);
  // Đọc trong callback ký upload (tạo 1 lần) — luôn là số ảnh mới nhất.
  const imageCountRef = useRef(imageCount);
  useEffect(() => {
    imageCountRef.current = imageCount;
  }, [imageCount]);

  const imageUpload = useMemo<TiptapImageUpload>(
    () => ({
      getSignature: async () => (imageCountRef.current >= POST_MAX_IMAGES ? blockedSignature() : getPostImageUploadSignatureAction(tenantSlug)),
      register: (publicId) => registerTenantImageAction(tenantSlug, publicId, "POST"),
      upgradeHref: `/studio/${tenantSlug}/billing`,
    }),
    [tenantSlug],
  );

  const [state, dispatch, isPending] = useActionState(async (prev: PostActionState, fd: FormData): Promise<PostActionState> => {
    const result = post ? await updatePostAction(tenantSlug, post.id, prev, fd) : await createPostAction(tenantSlug, prev, fd);
    if (result.ok) setDirty(false);
    setPendingKey(null);
    return result;
  }, {});

  // Trang Tạo: lưu xong → trang Sửa của bài vừa tạo, kèm kết quả để trang Sửa báo lại.
  useEffect(() => {
    if (isEdit || !state.ok || !state.postId) return;
    router.replace(`/studio/${tenantSlug}/posts/${state.postId}?created=${state.published ? "published" : "draft"}`);
  }, [state, router, tenantSlug, isEdit]);

  // Trang Sửa mở từ trang Tạo: gỡ `?created=` khỏi URL (tải lại không lặp thông báo).
  useEffect(() => {
    if (notice) window.history.replaceState(null, "", window.location.pathname);
  }, [notice]);

  // Lỗi lưu → focus tóm tắt lỗi; bài vừa bị ẩn/xoá ở nơi khác → tải lại dữ liệu trang.
  useEffect(() => {
    if (state.errorCode && REFRESH_CODES.has(state.errorCode)) router.refresh();
    if ((state.fieldErrors || state.error) && summaryRef.current) summaryRef.current.focus();
  }, [state, router]);

  useEffect(() => {
    if (clientError) summaryRef.current?.focus();
  }, [clientError]);

  // Cảnh báo khi rời trang còn thay đổi chưa lưu.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Thanh lưu nhanh (< xl) ẩn khi khối nút của card xuất bản đang trong tầm nhìn.
  useEffect(() => {
    const el = actionsRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver((entries) => setActionsInView(entries[entries.length - 1]?.isIntersecting ?? false));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const [, startSubmit] = useTransition();
  const [sidePending, startSide] = useTransition();
  const [sideKey, setSideKey] = useState<"pin" | "delete" | null>(null);
  const [sideMessage, setSideMessage] = useState<{ ok: boolean; text: string } | null>(null);

  /** Gửi form. `nextStatus` null = không gửi `status` (giữ trạng thái hiện tại). */
  function submitWith(key: SubmitKey, nextStatus: "PUBLISHED" | "DRAFT" | null) {
    const form = formRef.current;
    if (!form || hidden) return;
    if (!form.reportValidity()) return;
    if (imageCountRef.current > POST_MAX_IMAGES) {
      setClientError({ error: "Chưa lưu được — vui lòng kiểm tra lại.", fieldErrors: { body: `Bài đang có ${imageCountRef.current} ảnh. ${TOO_MANY_IMAGES}` } });
      return;
    }
    const fd = new FormData(form);
    fd.set("title", title);
    fd.set("body", body);
    // Tài liệu không đổi → không gửi (vắng = giữ nguyên; tránh lỗi khi tài liệu đang gắn đã bị lưu trữ).
    if (post && productId === post.productId) fd.delete("productId");
    else fd.set("productId", productId);
    fd.delete("status");
    if (nextStatus) fd.set("status", nextStatus);
    setClientError(null);
    setSideMessage(null);
    setPendingKey(key);
    startSubmit(() => dispatch(fd));
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Submit mặc định (Enter trong ô tiêu đề, nút "Lưu nháp"/"Lưu thay đổi", thanh lưu nhanh): chưa đăng = Lưu nháp.
    if (published) submitWith("save", null);
    else submitWith("draft", "DRAFT");
  }

  function unpublish() {
    const extra = dirty ? "\n\nCác thay đổi đang soạn cũng sẽ được lưu vào bản nháp." : "";
    if (!window.confirm(`Gỡ bài xuống? Bài chuyển về Bản nháp và không còn hiện công khai.${extra}`)) return;
    submitWith("unpublish", "DRAFT");
  }

  function removePost() {
    if (!post) return;
    if (!window.confirm("Xoá vĩnh viễn bài viết này? Không khôi phục được.")) return;
    setSideMessage(null);
    setSideKey("delete");
    startSide(async () => {
      const result = await deletePostAction(tenantSlug, post.id);
      if (result.ok) {
        setDirty(false);
        router.replace(`/studio/${tenantSlug}/posts`);
      } else {
        setSideMessage({ ok: false, text: result.error ?? "Không xoá được bài. Vui lòng thử lại." });
      }
    });
  }

  function togglePin() {
    if (!post) return;
    const next = !post.isPinned;
    setSideMessage(null);
    setSideKey("pin");
    startSide(async () => {
      const result = await pinPostAction(tenantSlug, post.id, next);
      if (result.ok) setSideMessage({ ok: true, text: next ? "Đã ghim bài — bài ghim trước đó (nếu có) đã được bỏ ghim." : "Đã bỏ ghim bài." });
      else setSideMessage({ ok: false, text: result.error ?? "Không cập nhật được ghim. Vui lòng thử lại." });
    });
  }

  const shown = clientError ?? state;
  const fieldErrors = shown.fieldErrors ?? {};
  const errorEntries = Object.entries(fieldErrors);
  const showSummary = errorEntries.length > 0 || Boolean(shown.error);
  const busy = isPending || sidePending;
  const hasResult = Object.keys(state).length > 0;
  const titleCount = countChars(title);
  const selectedProduct = productOptions.find((p) => p.id === productId) ?? null;

  let statusMessage: ReactNode;
  if (isPending) statusMessage = pendingKey === "publish" ? "Đang đăng bài..." : pendingKey === "unpublish" ? "Đang gỡ bài..." : "Đang lưu...";
  else if (dirty)
    statusMessage = (
      <span className="inline-flex items-center gap-2 font-semibold" style={{ color: AMBER }}>
        <span className="h-2 w-2 rounded-full" style={{ background: AMBER }} aria-hidden="true" />
        Có thay đổi chưa lưu
      </span>
    );
  else if (state.ok && state.published === true) statusMessage = <span style={{ color: GREEN_TEXT }}>Đã lưu — bài đang hiển thị công khai.</span>;
  else if (state.ok && state.published === false) statusMessage = <span style={{ color: GREEN_TEXT }}>Đã lưu bản nháp — chỉ bạn thấy.</span>;
  else if (!isEdit) statusMessage = "Bài mới là bản nháp cho tới khi bạn bấm Đăng bài.";
  else if (published) statusMessage = "Bài đang hiển thị công khai.";
  else statusMessage = "Bản nháp — chỉ bạn thấy trong Studio.";

  let quickMessage: ReactNode = null;
  if (isPending) quickMessage = "Đang lưu...";
  else if (dirty)
    quickMessage = (
      <span className="inline-flex items-center gap-2 font-semibold" style={{ color: AMBER }}>
        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: AMBER }} />
        Có thay đổi chưa lưu
      </span>
    );
  else if (state.ok) quickMessage = <span style={{ color: GREEN_TEXT }}>Đã lưu.</span>;
  const showQuickBar = !hidden && !actionsInView && (dirty || isPending || hasResult);

  const ghostStyle = { borderColor: GRAY_LINE, color: brandColors.ink };
  const actionButtons = published ? (
    <div className="space-y-2">
      <button type="submit" disabled={busy} className={`${PRIMARY_BTN} w-full`} style={{ background: brandColors.primary }}>
        {isPending && pendingKey === "save" ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
      <button type="button" onClick={unpublish} disabled={busy} className={`${GHOST_BTN} w-full`} style={ghostStyle}>
        <IconEyeOff className="h-4 w-4" />
        {isPending && pendingKey === "unpublish" ? "Đang gỡ..." : "Gỡ bài (về Bản nháp)"}
      </button>
    </div>
  ) : (
    <div className="grid gap-2">
      {/* type="button": Enter trong ô tiêu đề không kích hoạt nút này (submit mặc định = Lưu nháp). */}
      <button type="button" onClick={() => submitWith("publish", "PUBLISHED")} disabled={busy} className={`${PRIMARY_BTN} w-full`} style={{ background: brandColors.primary }}>
        {isPending && pendingKey === "publish" ? "Đang đăng..." : "Đăng bài"}
      </button>
      <button type="submit" disabled={busy} className={`${GHOST_BTN} w-full`} style={ghostStyle}>
        {isPending && pendingKey === "draft" ? "Đang lưu..." : "Lưu nháp"}
      </button>
    </div>
  );

  const noticeBanner =
    notice && !hasResult ? (
      <p role="status" className="flex items-start gap-2 rounded-xl border px-4 py-3 text-sm" style={{ background: GREEN_SOFT, borderColor: GREEN_LINE, color: GREEN_TEXT }}>
        <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <span>{notice === "published" ? "Đã đăng bài." : "Đã lưu bản nháp. Bấm Đăng bài khi bài đã sẵn sàng."}</span>
      </p>
    ) : null;

  const sideStatus = (
    <p role="status" aria-live="polite" className={sideMessage ? "text-sm" : "sr-only"} style={{ color: sideMessage?.ok ? GREEN_TEXT : RED }}>
      {sideMessage?.text ?? ""}
    </p>
  );

  // ---------- Bài bị ẩn do vi phạm: khoá chỉnh sửa, chỉ xem + xoá ----------
  if (hidden && post) {
    const product = productOptions.find((p) => p.id === post.productId) ?? null;
    return (
      <div className="studio-editor studio-post-editor">
        <div className="mx-auto max-w-[1440px]">
          {header}
          <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
            <div className="min-w-0 space-y-6">
              <ConfigCard icon={<IconNewspaper className="h-5 w-5" />} title="Nội dung bài (chỉ xem)" description="Bài bị ẩn không sửa được.">
                {post.title ? (
                  <p className="font-[family-name:var(--font-heading)] text-lg font-bold [overflow-wrap:anywhere]" style={{ color: brandColors.ink }}>
                    {post.title}
                  </p>
                ) : null}
                {/* Nội dung đã qua sanitizer (whitelist Tiptap) ở server lúc lưu — hiển thị lại cho chính chủ bài. */}
                <div className="gieochu-rich-content rounded-lg border bg-gray-50 px-4 py-3 text-[15px]" style={{ borderColor: GRAY_LINE }} dangerouslySetInnerHTML={{ __html: post.bodyHtml }} />
                {product ? (
                  <p className="text-sm" style={{ color: INK_SOFT }}>
                    Tài liệu gắn kèm: <span className="font-medium" style={{ color: brandColors.ink }}>{product.title}</span>
                  </p>
                ) : null}
              </ConfigCard>
            </div>
            <aside aria-label="Trạng thái bài viết" className="min-w-0 space-y-6">
              <ConfigCard icon={<IconShield className="h-5 w-5" />} title="Trạng thái" badges={<Badge tone="danger">{POST_STATUS_LABELS.HIDDEN}</Badge>}>
                <div className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm" style={{ background: RED_SOFT, borderColor: RED_LINE, color: "#991B1B" }}>
                  <IconEyeOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 [overflow-wrap:anywhere]">
                    <p className="font-semibold">
                      Bị ẩn do vi phạm{post.hiddenReason ? ` — ${post.hiddenReason}` : ""}
                    </p>
                    <p className="mt-0.5">Bài không hiện công khai. Bạn không sửa, đăng lại hay ghim được bài này; chỉ có thể xoá.</p>
                  </div>
                </div>
                <div className="space-y-2 border-t pt-4" style={{ borderColor: GRAY_LINE }}>
                  {sideStatus}
                  <button type="button" onClick={removePost} disabled={busy} className={`${GHOST_BTN} w-full`} style={{ borderColor: RED_LINE, color: RED }}>
                    <IconTrash className="h-4 w-4" />
                    {sidePending && sideKey === "delete" ? "Đang xoá..." : "Xoá bài viết"}
                  </button>
                </div>
              </ConfigCard>
            </aside>
          </div>
        </div>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      className="studio-editor studio-post-editor"
      aria-label={isEdit ? "Sửa bài viết" : "Viết bài mới"}
    >
      <div className="mx-auto max-w-[1440px]">
        {header}

        {noticeBanner ? <div className="mt-6">{noticeBanner}</div> : null}

        {showSummary ? (
          <div
            ref={summaryRef}
            tabIndex={-1}
            role="alert"
            aria-labelledby="post-error-summary-title"
            className="mt-6 rounded-xl border px-4 py-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-red-300"
            style={{ background: RED_SOFT, borderColor: RED_LINE, color: RED }}
          >
            <h2 id="post-error-summary-title" className="flex items-center gap-2 font-semibold">
              <IconAlertTriangle className="h-4 w-4 shrink-0" />
              {shown.error ?? "Chưa lưu được — vui lòng kiểm tra lại."}
            </h2>
            {errorEntries.length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-6">
                {errorEntries.map(([field, message]) => (
                  <li key={field}>
                    {FIELD_LABEL[field] ? (
                      <a href={`#${field}`} className="underline underline-offset-2">
                        {FIELD_LABEL[field]}: {message}
                      </a>
                    ) : (
                      message
                    )}
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        ) : null}

        <div className="mt-6 grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:gap-8">
          {/* Cột chính: tiêu đề tuỳ chọn + nội dung */}
          <div className="min-w-0 space-y-6">
            <ConfigCard icon={<IconNewspaper className="h-5 w-5" />} title="Nội dung bài viết" description={isEdit ? undefined : "Có thể sửa lại mọi thứ sau khi lưu."}>
              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <label htmlFor="title" className="block text-sm font-medium" style={{ color: brandColors.ink }}>
                    Tiêu đề (tuỳ chọn)
                  </label>
                  <span id="title-count" className="shrink-0 text-xs tabular-nums" style={{ color: titleCount >= POST_TITLE_MAX_LENGTH ? AMBER : INK_SOFT }}>
                    {titleCount}/{POST_TITLE_MAX_LENGTH}
                    <span className="sr-only"> ký tự</span>
                  </span>
                </div>
                <input
                  id="title"
                  name="title"
                  value={title}
                  maxLength={POST_TITLE_MAX_LENGTH}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    setDirty(true);
                  }}
                  aria-invalid={fieldErrors.title ? true : undefined}
                  aria-describedby={fieldErrors.title ? "title-error title-count" : "title-hint title-count"}
                  placeholder="Để trống nếu là bài ngắn kiểu cập nhật nhanh"
                  className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none transition-colors focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
                  style={{ borderColor: fieldErrors.title ? RED : GRAY_LINE }}
                />
                {fieldErrors.title ? (
                  <p id="title-error" role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
                    {fieldErrors.title}
                  </p>
                ) : (
                  <p id="title-hint" className="mt-1.5 text-xs" style={{ color: INK_SOFT }}>
                    Không có tiêu đề thì trang công khai dùng đoạn đầu của nội dung.
                  </p>
                )}
              </div>

              <div id="body" tabIndex={-1} className="outline-none">
                <span id="body-label" className="block text-sm font-medium" style={{ color: brandColors.ink }}>
                  Nội dung (bắt buộc)
                </span>
                <div className="mt-1.5" aria-labelledby="body-label" role="group">
                  <TiptapEditor
                    content={body}
                    onChange={(html) => {
                      setBody(html);
                      setDirty(true);
                    }}
                    placeholder="Chia sẻ kinh nghiệm, cập nhật tài liệu mới, mẹo học tập..."
                    imageUpload={imageUpload}
                  />
                </div>
                <p
                  id="body-images"
                  className="mt-1.5 flex items-center gap-1.5 text-xs tabular-nums"
                  style={{ color: imageCount > POST_MAX_IMAGES ? RED : imageCount === POST_MAX_IMAGES ? AMBER : INK_SOFT }}
                >
                  {imageCount > POST_MAX_IMAGES ? <IconAlertTriangle className="h-3.5 w-3.5 shrink-0" /> : null}
                  <span>
                    Ảnh: {imageCount}/{POST_MAX_IMAGES}
                    {imageCount > POST_MAX_IMAGES
                      ? ` — vượt giới hạn, xoá bớt ${imageCount - POST_MAX_IMAGES} ảnh rồi lưu.`
                      : imageCount === POST_MAX_IMAGES
                        ? " — đã đủ, xoá bớt ảnh nếu muốn chèn ảnh khác."
                        : " · PNG, JPG, WebP tối đa 5MB, tính vào hạn mức ảnh của gói."}
                  </span>
                </p>
                {fieldErrors.body ? (
                  <p role="alert" className="mt-1.5 text-sm" style={{ color: RED }}>
                    {fieldErrors.body}
                  </p>
                ) : null}
              </div>
            </ConfigCard>
          </div>

          {/* Sidebar: DOM = [tài liệu, ghim, xuất bản]; ≥ xl card xuất bản lên đầu (không dính khi cuộn — ADR-030). */}
          <aside aria-label="Xuất bản và thuộc tính bài viết" className="flex min-w-0 flex-col gap-6">
            <div className="space-y-6">
              <ConfigCard icon={<IconPackage className="h-5 w-5" />} title="Tài liệu liên quan" description="Gắn tối đa 1 tài liệu — hiện thành thẻ dưới bài viết.">
                <SelectField
                  id="productId"
                  name="productId"
                  label="Tài liệu"
                  value={productId}
                  onChange={(e) => {
                    setProductId(e.target.value);
                    setDirty(true);
                  }}
                  error={fieldErrors.productId}
                  hint={productOptions.length === 0 ? "Chưa có tài liệu nào để gắn." : undefined}
                >
                  <option value="">— Không gắn tài liệu —</option>
                  {productOptions.map((p) => (
                    <option key={p.id} value={p.id} disabled={p.status === "ARCHIVED" && p.id !== productId}>
                      {p.title}
                      {PRODUCT_STATUS_SUFFIX[p.status]}
                    </option>
                  ))}
                </SelectField>
                {selectedProduct && selectedProduct.status !== "PUBLISHED" ? (
                  <WarningNote>
                    {selectedProduct.status === "ARCHIVED"
                      ? "Tài liệu này đã lưu trữ nên thẻ tài liệu không hiện. Chọn tài liệu khác hoặc bỏ gắn."
                      : "Tài liệu đang Riêng tư — thẻ tài liệu chỉ hiện dưới bài khi tài liệu được Công khai."}
                  </WarningNote>
                ) : null}
              </ConfigCard>

              <ConfigCard
                icon={<IconPin className="h-5 w-5" />}
                title="Ghim bài"
                badges={post?.isPinned ? <Badge tone="info">Đang ghim</Badge> : null}
                description="Bài ghim luôn đứng đầu trang Bài viết. Mỗi trang chỉ ghim 1 bài."
              >
                {post ? (
                  <>
                    {post.isPinned && !published ? (
                      <p className="text-sm" style={{ color: INK_SOFT }}>
                        Bài đang ghim nhưng chưa đăng — chỉ hiện công khai sau khi bạn Đăng bài.
                      </p>
                    ) : null}
                    <button type="button" onClick={togglePin} disabled={busy} className={`${GHOST_BTN} w-full`} style={ghostStyle}>
                      <IconPin className="h-4 w-4" />
                      {sidePending && sideKey === "pin" ? "Đang cập nhật..." : post.isPinned ? "Bỏ ghim" : "Ghim bài này"}
                    </button>
                    {!post.isPinned ? (
                      <p className="text-xs" style={{ color: INK_SOFT }}>
                        Nếu đang có bài ghim khác, bài đó sẽ tự bỏ ghim.
                      </p>
                    ) : null}
                  </>
                ) : (
                  <LockedNotice>Lưu bài (nháp hoặc đăng) trước, rồi ghim được.</LockedNotice>
                )}
              </ConfigCard>
            </div>

            {/* Card xuất bản: ≥ xl lên đầu sidebar, cuộn theo trang như các card khác. */}
            <div className="xl:order-first">
                <div id="status" tabIndex={-1} className="rounded-2xl outline-none">
                  <ConfigCard
                    icon={<IconShield className="h-5 w-5" />}
                    title="Xuất bản"
                    badges={status ? <Badge tone={POST_STATUS_TONE[status]}>{POST_STATUS_LABELS[status]}</Badge> : <Badge tone="neutral">Chưa lưu</Badge>}
                    footer={
                      post ? (
                        <div className="flex flex-col gap-2">
                          {published ? (
                            <Link
                              href={`/${tenantSlug}/posts/${post.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm font-semibold sm:min-h-8"
                              style={{ color: brandColors.primary }}
                            >
                              Xem bài đã đăng <IconExternalLink className="h-3.5 w-3.5" />
                              <span className="sr-only">(mở tab mới)</span>
                            </Link>
                          ) : null}
                          {sideStatus}
                          <button type="button" onClick={removePost} disabled={busy} className={`${GHOST_BTN} w-full`} style={{ borderColor: RED_LINE, color: RED }}>
                            <IconTrash className="h-4 w-4" />
                            {sidePending && sideKey === "delete" ? "Đang xoá..." : "Xoá bài viết"}
                          </button>
                        </div>
                      ) : undefined
                    }
                  >
                    {post?.publishedLabel ? (
                      <p className="text-sm" style={{ color: INK_SOFT }}>
                        Đăng lần đầu: <span className="font-medium" style={{ color: brandColors.ink }}>{post.publishedLabel}</span>
                      </p>
                    ) : null}
                    {fieldErrors.status ? (
                      <p role="alert" className="text-sm" style={{ color: RED }}>
                        {fieldErrors.status}
                      </p>
                    ) : null}
                    <div ref={actionsRef} className="space-y-3">
                      <p role="status" aria-live="polite" className="min-h-5 text-sm" style={{ color: INK_SOFT }}>
                        {statusMessage}
                      </p>
                      {actionButtons}
                    </div>
                  </ConfigCard>
                </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Thanh lưu nhanh CHỈ dưới xl (card xuất bản ở cuối form). `invisible` giữ chỗ — không nhảy layout. */}
      <div
        className={`studio-save-bar sticky bottom-0 z-20 -mx-5 mt-6 border-t bg-white px-5 pt-3 transition-[opacity,visibility] duration-150 motion-reduce:transition-none lg:-mx-8 lg:px-8 xl:hidden ${showQuickBar ? "visible opacity-100" : "invisible opacity-0"}`}
        data-visible={showQuickBar ? "true" : "false"}
        style={{ borderColor: GRAY_LINE, boxShadow: "0 -6px 16px rgb(18 33 58 / 0.06)", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center justify-between gap-3">
          <p aria-hidden="true" className="min-w-0 text-sm" style={{ color: INK_SOFT }}>
            {quickMessage}
          </p>
          <button type="submit" disabled={busy} tabIndex={showQuickBar ? undefined : -1} className={`${PRIMARY_BTN} shrink-0`} style={{ background: brandColors.primary }}>
            {isPending ? "Đang lưu..." : published ? "Lưu thay đổi" : "Lưu nháp"}
          </button>
        </div>
      </div>
    </form>
  );
}
