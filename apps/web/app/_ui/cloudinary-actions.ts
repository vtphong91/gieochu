"use server";

import { AppError } from "@gieochu/core";
import { requireUser } from "../../lib/session";
import { createCloudinaryUploadSignature } from "../../lib/system-cloudinary";

export interface CloudinarySignatureResult {
  ok: boolean;
  error?: string;
  cloudName: string;
  apiKey: string;
  timestamp: number;
  folder: string;
  signature: string;
}

/**
 * Dùng chung cho mọi ô upload ảnh trong toàn hệ thống (Admin: Landing Page
 * CMS/Nhận diện thương hiệu; Studio/TiptapEditor: mô tả sản phẩm...). Chỉ
 * yêu cầu đã đăng nhập (`requireUser`), không giới hạn SYSTEM_ADMIN — chữ ký
 * chỉ chứng minh server có credential Cloudinary hợp lệ, không lộ secret; ranh
 * giới cần giữ là "không cho khách ẩn danh spam upload", không phải theo vai
 * trò cụ thể.
 */
export async function getCloudinaryUploadSignatureAction(): Promise<CloudinarySignatureResult> {
  await requireUser();
  try {
    const sig = await createCloudinaryUploadSignature();
    return { ok: true, ...sig };
  } catch (error) {
    if (error instanceof AppError) {
      return { ok: false, error: error.message, cloudName: "", apiKey: "", timestamp: 0, folder: "", signature: "" };
    }
    throw error;
  }
}
