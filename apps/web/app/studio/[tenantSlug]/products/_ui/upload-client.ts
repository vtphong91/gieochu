/**
 * Helper upload phía trình duyệt cho editor sản phẩm (ADR-026). Giữ NGUYÊN request/response của API sẵn có:
 * `POST /api/studio/[tenantSlug]/uploads/presign` → PUT (đơn hoặc multipart) → `.../uploads/complete`.
 * Ảnh bìa đã chuyển sang Cloudinary (ADR-027 §3, `cover-image-card.tsx`). Chỉ đổi `fetch` PUT sang XHR để có tiến độ (fetch không
 * báo tiến độ upload) — header/body PUT giữ như cũ.
 */

export interface FilePresignResponse {
  objectKey: string;
  upload:
    | { mode: "single"; url: string }
    | { mode: "multipart"; uploadId: string; partSizeBytes: number; parts: { partNumber: number; url: string }[] };
}

/** POST JSON tới API Studio; lỗi → ném Error với message server trả (`{ error: { message } }`). */
export async function postStudioJson<T>(url: string, body: unknown, fallbackError: string): Promise<T> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) {
    let message = fallbackError;
    try {
      const data = (await response.json()) as { error?: { message?: string } };
      if (data.error?.message) message = data.error.message;
    } catch {
      // body không phải JSON — dùng thông báo mặc định
    }
    throw new Error(message);
  }
  return (await response.json()) as T;
}

/** PUT bằng XHR để báo tiến độ (byte đã gửi). Trả ETag nếu storage trả về (multipart cần). */
export function xhrPut(
  url: string,
  body: Blob,
  headers: Record<string, string>,
  onProgress: (loadedBytes: number) => void,
  failMessage: string,
): Promise<{ eTag: string | null }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    for (const [key, value] of Object.entries(headers)) xhr.setRequestHeader(key, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve({ eTag: xhr.getResponseHeader("ETag") });
      else reject(new Error(failMessage));
    };
    xhr.onerror = () => reject(new Error(`${failMessage} Kiểm tra kết nối mạng rồi thử lại.`));
    xhr.onabort = () => reject(new Error("Đã huỷ tải lên."));
    xhr.send(body);
  });
}

/**
 * Bản ghi file mà `.../uploads/complete` trả về (JSON của `ProductFile`). Chỉ đọc các trường editor cần để hiện
 * file vừa tải trong card khi chưa có dữ liệu loader (trang Tạo — sửa đổi ADR-027 §4).
 */
export interface UploadedProductFile {
  id: string;
  fileName: string;
  sizeBytes: number;
  scanStatus: "PENDING" | "CLEAN" | "REJECTED" | null;
  isPreview: boolean;
  createdAt: string | null;
}

function toUploadedFile(raw: unknown, file: File, isPreview: boolean): UploadedProductFile | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== "string") return null;
  const scan = r.scanStatus;
  return {
    id: r.id,
    fileName: typeof r.fileName === "string" ? r.fileName : file.name,
    sizeBytes: typeof r.sizeBytes === "number" ? r.sizeBytes : Number(r.sizeBytes ?? file.size) || file.size,
    scanStatus: scan === "PENDING" || scan === "CLEAN" || scan === "REJECTED" ? scan : "PENDING",
    isPreview: typeof r.isPreview === "boolean" ? r.isPreview : isPreview,
    createdAt: typeof r.createdAt === "string" ? r.createdAt : null,
  };
}

/**
 * Upload 1 file tài liệu: presign → PUT (đơn/multipart) → complete. `onProgress` nhận tỉ lệ 0..1.
 * Body gửi tới presign/complete giống hệt component cũ `upload-file-form.tsx`. Trả bản ghi file server xác nhận
 * (null nếu response không đúng dạng mong đợi — upload vẫn đã thành công).
 */
export async function uploadProductFile(
  tenantSlug: string,
  productId: string,
  file: File,
  isPreview: boolean,
  onProgress: (ratio: number) => void,
): Promise<UploadedProductFile | null> {
  const mimeType = file.type || "application/octet-stream";
  const { objectKey, upload } = await postStudioJson<FilePresignResponse>(
    `/api/studio/${tenantSlug}/uploads/presign`,
    { productId, fileName: file.name, sizeBytes: file.size, mimeType, isPreview },
    "Không tạo được URL tải lên.",
  );

  const total = Math.max(file.size, 1);
  let uploadId: string | undefined;
  let parts: { partNumber: number; eTag: string }[] | undefined;

  if (upload.mode === "single") {
    await xhrPut(upload.url, file, { "Content-Type": mimeType }, (loaded) => onProgress(loaded / total), "Tải file lên storage thất bại.");
  } else {
    uploadId = upload.uploadId;
    parts = [];
    let doneBytes = 0;
    for (const part of upload.parts) {
      const start = (part.partNumber - 1) * upload.partSizeBytes;
      const chunk = file.slice(start, start + upload.partSizeBytes);
      const { eTag } = await xhrPut(
        part.url,
        chunk,
        {},
        (loaded) => onProgress((doneBytes + loaded) / total),
        `Tải phần ${part.partNumber} thất bại.`,
      );
      if (!eTag) throw new Error(`Thiếu ETag cho phần ${part.partNumber}.`);
      parts.push({ partNumber: part.partNumber, eTag });
      doneBytes += chunk.size;
    }
  }

  onProgress(1);
  const completed = await postStudioJson<unknown>(
    `/api/studio/${tenantSlug}/uploads/complete`,
    { productId, objectKey, fileName: file.name, mimeType, sizeBytes: file.size, isPreview, uploadId, parts },
    "Không xác nhận được file đã tải lên.",
  );
  return toUploadedFile(completed, file, isPreview);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ["KB", "MB", "GB"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toLocaleString("vi-VN", { maximumFractionDigits: 1 })} ${units[unit]}`;
}
