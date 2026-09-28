"use client";

import type { CloudinarySignatureResult } from "../cloudinary-actions";

/**
 * ADR-028 — upload ảnh chèn vào TiptapEditor. Nơi dùng editor truyền `imageUpload` (action ký + đăng ký ảnh);
 * không truyền → editor ẩn nút chèn ảnh (không có ngữ cảnh ký phù hợp).
 */
export interface TiptapImageUpload {
  /** Server Action cấp chữ ký Cloudinary (folder/định dạng đã khoá trong chữ ký). */
  getSignature: () => Promise<CloudinarySignatureResult>;
  /** Ảnh tenant: đăng ký `public_id` sau upload (tính hạn mức), trả URL gốc để chèn. Admin không truyền. */
  register?: (publicId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string; errorCode?: string }>;
  /** Trang nâng gói hiển thị cạnh lỗi `IMAGE_QUOTA_EXCEEDED` (Studio: `/studio/<slug>/billing`). */
  upgradeHref?: string;
}

export const EDITOR_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const EDITOR_IMAGE_ACCEPT = "image/png,image/jpeg,image/webp";
const ACCEPTED_TYPES = new Set(EDITOR_IMAGE_ACCEPT.split(","));

export type EditorImageUploadResult = { ok: true; url: string } | { ok: false; error: string; errorCode?: string };

/** Kiểm tra ở trình duyệt trước khi xin chữ ký — server/Cloudinary vẫn kiểm lại. */
export function validateEditorImage(file: File): string | null {
  if (!ACCEPTED_TYPES.has(file.type)) return "Chỉ chèn được ảnh PNG, JPG hoặc WebP.";
  if (file.size > EDITOR_IMAGE_MAX_BYTES) return "Ảnh tối đa 5MB — hãy nén hoặc giảm kích thước ảnh rồi thử lại.";
  return null;
}

/** Tên file bỏ đuôi, gọn khoảng trắng — alt mặc định khi chèn (người dùng sửa lại được). */
export function altFromFileName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

function postToCloudinary(url: string, body: FormData, onProgress: (percent: number) => void): Promise<{ ok: boolean; data: unknown }> {
  // XHR thay fetch để có tiến độ upload (fetch chưa báo tiến độ gửi body).
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let data: unknown = null;
      try {
        data = JSON.parse(xhr.responseText);
      } catch {
        data = null;
      }
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, data });
    };
    xhr.onerror = () => reject(new Error("network"));
    xhr.send(body);
  });
}

export async function uploadEditorImage(file: File, upload: TiptapImageUpload, onProgress: (percent: number) => void): Promise<EditorImageUploadResult> {
  let sig: CloudinarySignatureResult;
  try {
    sig = await upload.getSignature();
  } catch {
    return {
      ok: false,
      error: "Không lấy được quyền tải ảnh lên. Phiên đăng nhập có thể đã hết hạn hoặc tài khoản không có quyền — tải lại trang rồi thử lại.",
    };
  }
  if (!sig.ok) return { ok: false, error: sig.error ?? "Chưa cấu hình dịch vụ lưu ảnh.", errorCode: sig.errorCode };

  const formData = new FormData();
  formData.append("file", file);
  formData.append("api_key", sig.apiKey);
  formData.append("signature", sig.signature);
  // Gửi NGUYÊN VẸN bộ tham số đã ký (timestamp, folder | public_id, allowed_formats...) — thêm/bớt/sửa sẽ lệch chữ ký.
  for (const [key, value] of Object.entries(sig.uploadParams)) formData.append(key, value);

  let response: { ok: boolean; data: unknown };
  try {
    response = await postToCloudinary(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, formData, onProgress);
  } catch {
    return { ok: false, error: "Tải ảnh lên thất bại — kiểm tra kết nối mạng rồi thử lại." };
  }
  const data = (response.data ?? {}) as { public_id?: string; secure_url?: string; error?: { message?: string } };
  if (!response.ok || !data.public_id || !data.secure_url) {
    return { ok: false, error: data.error?.message ? `Dịch vụ ảnh từ chối: ${data.error.message}` : "Tải ảnh lên thất bại, thử lại sau." };
  }

  if (!upload.register) return { ok: true, url: data.secure_url };
  try {
    const registered = await upload.register(data.public_id);
    return registered.ok ? { ok: true, url: registered.url } : { ok: false, error: registered.error, errorCode: registered.errorCode };
  } catch {
    return { ok: false, error: "Ảnh đã tải lên nhưng chưa ghi nhận được — tải lại trang rồi thử lại." };
  }
}
