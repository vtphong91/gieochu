"use server";

import { revalidatePath } from "next/cache";
import { AppError } from "@gieochu/core";
import { signatureError, signatureOk, type CloudinarySignatureResult } from "../../../../lib/cloudinary-signature";
import { createPost, deletePost, POST_ERROR_CODES, setPostPinned, updatePost, type TenantPostStatus } from "../../../../lib/post";
import { createTenantImageUploadSignature } from "../../../../lib/tenant-media";
import { requireTenantMember } from "../../../../lib/tenant";

/**
 * ADR-029 mục 5 (M10b) — Server Actions bài viết (Studio). Guard `requireTenantMember` (OWNER); `tenant.id` luôn lấy
 * từ guard. CSRF: cơ chế sẵn có của Server Action (§7.7). Logic + RLS: `lib/post.ts`.
 *
 * Contract trả về (giống `ProductActionState`):
 * - `ok`: thành công. `postId`: id bài (tạo mới → UI chuyển sang `/studio/[slug]/posts/[postId]`).
 * - `published`: trạng thái sau thao tác lưu (`true` = PUBLISHED).
 * - `error`: thông báo chung (tiếng Việt); `errorCode`: mã AppError (vd `POST_TOO_MANY_IMAGES`, `FORBIDDEN`).
 * - `fieldErrors`: lỗi theo field FormData (`title`, `body`, `productId`, `status`).
 */
export interface PostActionState {
  ok?: boolean;
  error?: string;
  errorCode?: string;
  fieldErrors?: Record<string, string>;
  postId?: string;
  published?: boolean;
}

/** Mã lỗi AppError → field FormData để UI hiện lỗi dưới ô nhập. */
const ERROR_FIELD: Record<string, string> = {
  [POST_ERROR_CODES.TITLE_INVALID]: "title",
  [POST_ERROR_CODES.BODY_REQUIRED]: "body",
  [POST_ERROR_CODES.BODY_TOO_LONG]: "body",
  [POST_ERROR_CODES.TOO_MANY_IMAGES]: "body",
  [POST_ERROR_CODES.PRODUCT_INVALID]: "productId",
};

function appErrorToState(error: AppError): PostActionState {
  const field = ERROR_FIELD[error.code];
  return {
    error: error.message,
    errorCode: error.code,
    ...(field ? { fieldErrors: { [field]: error.message } } : {}),
  };
}

async function run(fn: () => Promise<PostActionState>): Promise<PostActionState> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof AppError && error.expose) return appErrorToState(error);
    throw error;
  }
}

/** undefined = field vắng mặt trong FormData; "" = có mặt nhưng rỗng. */
function rawField(formData: FormData, name: string): string | undefined {
  if (!formData.has(name)) return undefined;
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

type ParsedStatus = { ok: true; value: TenantPostStatus | undefined } | { ok: false; state: PostActionState };

/** `status`: `PUBLISHED` (đăng) | `DRAFT` (lưu nháp / gỡ bài). Vắng mặt = giữ nguyên (sửa) hoặc DRAFT (tạo). */
function parseStatus(formData: FormData): ParsedStatus {
  const raw = rawField(formData, "status")?.trim();
  if (raw === undefined || raw === "") return { ok: true, value: undefined };
  if (raw === "PUBLISHED" || raw === "DRAFT") return { ok: true, value: raw };
  const message = "Trạng thái không hợp lệ.";
  return { ok: false, state: { error: message, errorCode: "VALIDATION_ERROR", fieldErrors: { status: message } } };
}

function revalidatePosts(tenantSlug: string, postId?: string): void {
  revalidatePath(`/studio/${tenantSlug}/posts`);
  if (postId) revalidatePath(`/studio/${tenantSlug}/posts/${postId}`);
  revalidatePath(`/${tenantSlug}`);
  revalidatePath(`/${tenantSlug}/posts`);
  if (postId) revalidatePath(`/${tenantSlug}/posts/${postId}`);
}

/**
 * Tạo bài. FormData: `title` (tuỳ chọn, ≤200), `body` (HTML Tiptap — sanitize ở server, ảnh ngoài Cloudinary hệ
 * thống bị loại, ≤6 ảnh), `productId` (tuỳ chọn, rỗng = không gắn), `status` (`PUBLISHED` | `DRAFT`, mặc định DRAFT).
 * Thành công → `{ ok, postId, published }`.
 */
export async function createPostAction(tenantSlug: string, _prevState: PostActionState, formData: FormData): Promise<PostActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  const status = parseStatus(formData);
  if (!status.ok) return status.state;
  return run(async () => {
    const post = await createPost(tenant.id, {
      title: rawField(formData, "title") ?? null,
      body: rawField(formData, "body") ?? "",
      productId: rawField(formData, "productId")?.trim() || null,
      status: status.value ?? "DRAFT",
    });
    revalidatePosts(tenant.slug, post.id);
    return { ok: true, postId: post.id, published: post.status === "PUBLISHED" };
  });
}

/**
 * Sửa bài. Cùng field như tạo; field VẮNG MẶT = giữ nguyên; `productId` có mặt nhưng rỗng = bỏ gắn; `status=DRAFT`
 * trên bài đang đăng = gỡ bài. Bài HIDDEN (vi phạm) → `POST_HIDDEN_LOCKED`. Thành công → `{ ok, postId, published }`.
 */
export async function updatePostAction(
  tenantSlug: string,
  postId: string,
  _prevState: PostActionState,
  formData: FormData,
): Promise<PostActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  const status = parseStatus(formData);
  if (!status.ok) return status.state;
  const rawProduct = rawField(formData, "productId");
  return run(async () => {
    const post = await updatePost(tenant.id, postId, {
      title: rawField(formData, "title"),
      body: rawField(formData, "body"),
      productId: rawProduct === undefined ? undefined : rawProduct.trim() || null,
      status: status.value,
    });
    revalidatePosts(tenant.slug, post.id);
    return { ok: true, postId: post.id, published: post.status === "PUBLISHED" };
  });
}

/** Xoá hẳn bài (không khôi phục). Thành công → `{ ok }` (UI tự chuyển về danh sách). */
export async function deletePostAction(tenantSlug: string, postId: string): Promise<PostActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  return run(async () => {
    await deletePost(tenant.id, postId);
    revalidatePosts(tenant.slug, postId);
    return { ok: true };
  });
}

/** Ghim (`pinned=true`, tự bỏ ghim bài đang ghim khác) / bỏ ghim. Lỗi đua ghim → `POST_PIN_CONFLICT`. */
export async function pinPostAction(tenantSlug: string, postId: string, pinned: boolean): Promise<PostActionState> {
  const { tenant } = await requireTenantMember(tenantSlug);
  return run(async () => {
    await setPostPinned(tenant.id, postId, pinned === true);
    revalidatePosts(tenant.slug, postId);
    return { ok: true, postId };
  });
}

/**
 * ADR-028 + ADR-029 mục 5 — chữ ký upload ảnh trong editor bài viết (folder `tenants/<id>/posts`, tính hạn mức ảnh
 * của gói → `IMAGE_QUOTA_EXCEEDED`). Sau upload: `registerTenantImageAction(tenantSlug, publicId, "POST")`
 * (`../media-actions.ts`) → `url` chèn vào nội dung.
 */
export async function getPostImageUploadSignatureAction(tenantSlug: string): Promise<CloudinarySignatureResult> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    return signatureOk(await createTenantImageUploadSignature(tenant.id, "POST"));
  } catch (error) {
    return signatureError(error);
  }
}
