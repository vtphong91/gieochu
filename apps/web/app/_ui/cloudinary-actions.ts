"use server";

import { signatureError, signatureOk, type CloudinarySignatureResult } from "../../lib/cloudinary-signature";
import { requireRole } from "../../lib/session";
import { createCloudinaryUploadSignature } from "../../lib/system-cloudinary";

export type { CloudinarySignatureResult } from "../../lib/cloudinary-signature";

/**
 * Chữ ký upload mặc định của `ImageUploadField` — CHỈ dành cho System Center
 * (CMS trang chủ, nhận diện thương hiệu, danh mục). Tenant có action ký riêng
 * theo folder `tenants/<id>/...` (storefront, ảnh bìa sản phẩm). Trước đây chỉ
 * `requireUser()` nên mọi tài khoản (kể cả khách mua hàng) lấy được chữ ký
 * upload vào folder gốc của Cloudinary nền tảng — đã siết (2026-09-27).
 * `allowed_formats` nằm trong chữ ký; giữ SVG cho logo admin (hiển thị qua
 * `<img>` nên không thực thi script).
 */
const ADMIN_ALLOWED_FORMATS = ["png", "jpg", "jpeg", "webp", "svg"] as const;

export async function getCloudinaryUploadSignatureAction(): Promise<CloudinarySignatureResult> {
  await requireRole("SYSTEM_ADMIN");
  try {
    return signatureOk(await createCloudinaryUploadSignature({ allowedFormats: ADMIN_ALLOWED_FORMATS }));
  } catch (error) {
    return signatureError(error);
  }
}
