import { AppError } from "@gieochu/core";
import type { CloudinaryUploadSignature } from "./system-cloudinary";

/**
 * Kết quả mọi Server Action cấp chữ ký upload Cloudinary (admin + tenant) — contract cho `ImageUploadField` /
 * editor. `ok: false` → `error` (tiếng Việt, hiển thị được) + `errorCode` (vd `IMAGE_QUOTA_EXCEEDED` để UI gợi ý
 * nâng gói, `CLOUDINARY_NOT_CONFIGURED`). `ok: true` → client gửi `uploadParams` NGUYÊN VẸN kèm `file`, `api_key`,
 * `signature` lên `https://api.cloudinary.com/v1_1/<cloudName>/image/upload`.
 */
export interface CloudinarySignatureResult extends CloudinaryUploadSignature {
  ok: boolean;
  error?: string;
  errorCode?: string;
}

export function signatureOk(signature: CloudinaryUploadSignature): CloudinarySignatureResult {
  return { ok: true, ...signature };
}

/** AppError hiển thị được → `ok: false`; lỗi khác ném tiếp (Next trả lỗi chung, không lộ chi tiết). */
export function signatureError(error: unknown): CloudinarySignatureResult {
  if (error instanceof AppError && error.expose) {
    return {
      ok: false,
      error: error.message,
      errorCode: error.code,
      cloudName: "",
      apiKey: "",
      timestamp: 0,
      folder: "",
      signature: "",
      uploadParams: {},
    };
  }
  throw error;
}
