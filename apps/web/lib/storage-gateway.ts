import { getEnv } from "@gieochu/config";
import { sealStorageTicket, type StorageTicketMethod } from "@gieochu/core";
import type { PresignedUpload } from "@gieochu/storage";
import type { StorageProvider } from "./system-storage";

/**
 * ADR-045 Storage Gateway. Provider có trong env `STORAGE_GATEWAY_PROVIDERS` → URL giao cho trình duyệt là
 * `/_s/<vé>` cùng origin; nginx `auth_request` gọi `/api/internal/storage/ticket` để giải vé rồi `proxy_pass` tới
 * storage nội bộ. Provider không có trong danh sách (mặc định) → trả presigned URL nguyên vẹn như trước.
 */
export const STORAGE_GATEWAY_PATH_PREFIX = "/_s/";

export function isStorageGatewayEnabled(): boolean {
  return getEnv().STORAGE_GATEWAY_PROVIDERS.length > 0;
}

export function isGatewayProvider(provider: StorageProvider): boolean {
  return getEnv().STORAGE_GATEWAY_PROVIDERS.includes(provider);
}

export interface ToClientStorageUrlInput {
  presignedUrl: string;
  /** Provider của S3 client đã KÝ URL này (không phải activeProvider nếu file nằm ở provider khác). */
  provider: StorageProvider;
  method: StorageTicketMethod;
  /** Thời hạn presign đã dùng khi ký — vé hết hạn cùng lúc. */
  ttlSeconds: number;
  maxBytes?: number;
}

export function toClientStorageUrl(input: ToClientStorageUrlInput): string {
  if (!isGatewayProvider(input.provider)) return input.presignedUrl;

  const url = new URL(input.presignedUrl);
  const ticket = sealStorageTicket(
    {
      method: input.method,
      target: `${url.pathname}${url.search}`,
      exp: Math.floor(Date.now() / 1000) + input.ttlSeconds,
      maxBytes: input.maxBytes,
    },
    getEnv().STORAGE_ENCRYPTION_KEY,
  );
  return `${STORAGE_GATEWAY_PATH_PREFIX}${ticket}`;
}

/** Bọc kết quả presign upload: giữ nguyên shape JSON trả client (upload-client.ts không đổi), chỉ thay `url`. */
export function toClientUpload(upload: PresignedUpload, provider: StorageProvider, ttlSeconds: number, sizeBytes: number): PresignedUpload {
  if (!isGatewayProvider(provider)) return upload;

  if (upload.mode === "single") {
    return {
      ...upload,
      url: toClientStorageUrl({ presignedUrl: upload.url, provider, method: "PUT", ttlSeconds, maxBytes: sizeBytes }),
    };
  }
  return {
    ...upload,
    parts: upload.parts.map((part) => ({
      ...part,
      url: toClientStorageUrl({ presignedUrl: part.url, provider, method: "PUT", ttlSeconds, maxBytes: upload.partSizeBytes }),
    })),
  };
}

/** `NextResponse.redirect` cần URL tuyệt đối — URL gateway tương đối resolve theo APP_URL; URL tuyệt đối giữ nguyên. */
export function toAbsoluteRedirectUrl(url: string): string | URL {
  return url.startsWith("/") && !url.startsWith("//") ? new URL(url, getEnv().APP_URL) : url;
}
