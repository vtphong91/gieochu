import { cache } from "react";
import { isCloudinaryImageUrl } from "@gieochu/core";
import { getSystemStorageConfig } from "./system-storage";

/**
 * Public-bucket base URL (admin-configured, `/admin/settings/storage`), bỏ dấu `/` cuối. `cache()` gộp trong
 * một request (storefront đọc cả sản phẩm + hồ sơ). `null` = chưa cấu hình storage/publicBaseUrl.
 */
export const getPublicBucketBaseUrl = cache(async function getPublicBucketBaseUrl(): Promise<string | null> {
  const storageConfig = await getSystemStorageConfig();
  const base = storageConfig?.publicConfig.publicBaseUrl?.trim();
  return base ? base.replace(/\/+$/, "") : null;
});

export interface ProductCoverSource {
  coverImageUrl: string | null;
  coverImageKey: string | null;
}

/** Có ảnh bìa dùng được cho điều kiện xuất bản (ADR-027 §3): Cloudinary hợp lệ HOẶC key R2 cũ. */
export function hasProductCover(product: ProductCoverSource): boolean {
  return Boolean(product.coverImageUrl && isCloudinaryImageUrl(product.coverImageUrl)) || Boolean(product.coverImageKey);
}

/**
 * ADR-027 §3: URL ảnh bìa hiệu lực — ưu tiên `coverImageUrl` (Cloudinary, kiểm lại host khi đọc để dữ liệu
 * lỡ lọt vào DB không vượt CSP `img-src`), fallback `coverImageKey` trên bucket public R2 (dữ liệu cũ).
 */
export function resolveProductCoverUrl(product: ProductCoverSource, publicBaseUrl: string | null): string | null {
  if (product.coverImageUrl && isCloudinaryImageUrl(product.coverImageUrl)) return product.coverImageUrl;
  return product.coverImageKey && publicBaseUrl ? `${publicBaseUrl}/${product.coverImageKey}` : null;
}

/** Bản async cho một sản phẩm — chỉ đọc cấu hình storage khi thật sự cần fallback R2. */
export async function getProductCoverUrl(product: ProductCoverSource): Promise<string | null> {
  if (product.coverImageUrl && isCloudinaryImageUrl(product.coverImageUrl)) return product.coverImageUrl;
  if (!product.coverImageKey) return null;
  return resolveProductCoverUrl(product, await getPublicBucketBaseUrl());
}
