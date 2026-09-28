"use server";

import { AppError } from "@gieochu/core";
import { signatureError, signatureOk, type CloudinarySignatureResult } from "../../../lib/cloudinary-signature";
import { createTenantImageUploadSignature, isTenantMediaUsage, registerTenantImage } from "../../../lib/tenant-media";
import { requireTenantMember } from "../../../lib/tenant";

/**
 * ADR-028 — Server Action ảnh tenant trên Cloudinary hệ thống (Studio). Guard `requireTenantMember` (OWNER);
 * `tenant.id` luôn lấy từ guard, không từ client. Hạn mức ảnh + sổ asset: `lib/tenant-media.ts`.
 */

/** Chữ ký upload ảnh trong editor mô tả sản phẩm (folder `tenants/<id>/content`). Vượt hạn mức → `errorCode: "IMAGE_QUOTA_EXCEEDED"`. */
export async function getContentImageUploadSignatureAction(tenantSlug: string): Promise<CloudinarySignatureResult> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    return signatureOk(await createTenantImageUploadSignature(tenant.id, "CONTENT"));
  } catch (error) {
    return signatureError(error);
  }
}

export type RegisterTenantImageResult =
  | {
      ok: true;
      /** `secure_url` Cloudinary để lưu (form/HTML mô tả); hiển thị qua `cloudinaryDeliveryUrl`. */
      url: string;
      /** false = chưa xác minh được dung lượng với Cloudinary (tạm tính 5MB, đối soát sau). */
      verified: boolean;
    }
  | { ok: false; error: string; errorCode: string };

/**
 * Gọi NGAY sau khi upload lên Cloudinary thành công, với `public_id` Cloudinary trả về và đúng `usage` của chữ ký
 * đã dùng (`CONTENT` | `PRODUCT_COVER` | `STOREFRONT` | `POST`). Server tự đọc dung lượng thật qua Admin API.
 * Lỗi: `INVALID_IMAGE_PUBLIC_ID` (ảnh không thuộc folder tenant/mục đích này), `IMAGE_NOT_FOUND` (Cloudinary không
 * có ảnh — upload hỏng), `INVALID_IMAGE_USAGE`, `CLOUDINARY_NOT_CONFIGURED`.
 */
export async function registerTenantImageAction(tenantSlug: string, publicId: string, usage: string): Promise<RegisterTenantImageResult> {
  try {
    const { tenant } = await requireTenantMember(tenantSlug);
    if (!isTenantMediaUsage(usage)) {
      throw new AppError({ code: "INVALID_IMAGE_USAGE", message: "Loại ảnh không hợp lệ.", httpStatus: 400 });
    }
    if (typeof publicId !== "string" || publicId.length === 0 || publicId.length > 300) {
      throw new AppError({ code: "INVALID_IMAGE_PUBLIC_ID", message: "Ảnh không thuộc thư mục của trang này.", httpStatus: 400 });
    }
    const registered = await registerTenantImage(tenant.id, publicId, usage);
    return { ok: true, ...registered };
  } catch (error) {
    if (error instanceof AppError && error.expose) return { ok: false, error: error.message, errorCode: error.code };
    throw error;
  }
}
