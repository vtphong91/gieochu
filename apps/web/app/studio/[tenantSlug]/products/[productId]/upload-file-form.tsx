"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PresignResponse {
  objectKey: string;
  upload:
    | { mode: "single"; url: string }
    | { mode: "multipart"; uploadId: string; partSizeBytes: number; parts: { partNumber: number; url: string }[] };
}

async function putSingle(url: string, file: File, mimeType: string): Promise<void> {
  const response = await fetch(url, { method: "PUT", body: file, headers: { "Content-Type": mimeType } });
  if (!response.ok) throw new Error("Tải file lên storage thất bại.");
}

async function putMultipart(
  upload: Extract<PresignResponse["upload"], { mode: "multipart" }>,
  file: File,
): Promise<{ partNumber: number; eTag: string }[]> {
  const results: { partNumber: number; eTag: string }[] = [];
  for (const part of upload.parts) {
    const start = (part.partNumber - 1) * upload.partSizeBytes;
    const chunk = file.slice(start, start + upload.partSizeBytes);
    const response = await fetch(part.url, { method: "PUT", body: chunk });
    if (!response.ok) throw new Error(`Tải phần ${part.partNumber} thất bại.`);
    const eTag = response.headers.get("ETag");
    if (!eTag) throw new Error(`Thiếu ETag cho phần ${part.partNumber}.`);
    results.push({ partNumber: part.partNumber, eTag });
  }
  return results;
}

export function UploadFileForm({ tenantSlug, productId }: { tenantSlug: string; productId: string }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(false);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const presignRes = await fetch(`/api/studio/${tenantSlug}/uploads/presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, fileName: file.name, sizeBytes: file.size, mimeType: file.type || "application/octet-stream", isPreview }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json();
        throw new Error(body.error?.message ?? "Không tạo được URL tải lên.");
      }
      const { objectKey, upload }: PresignResponse = await presignRes.json();

      let uploadId: string | undefined;
      let parts: { partNumber: number; eTag: string }[] | undefined;
      if (upload.mode === "single") {
        await putSingle(upload.url, file, file.type || "application/octet-stream");
      } else {
        uploadId = upload.uploadId;
        parts = await putMultipart(upload, file);
      }

      const completeRes = await fetch(`/api/studio/${tenantSlug}/uploads/complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productId,
          objectKey,
          fileName: file.name,
          mimeType: file.type || "application/octet-stream",
          sizeBytes: file.size,
          isPreview,
          uploadId,
          parts,
        }),
      });
      if (!completeRes.ok) {
        const body = await completeRes.json();
        throw new Error(body.error?.message ?? "Không xác nhận được file đã tải lên.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải file lên thất bại.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-lg border border-dashed p-4" style={{ borderColor: "#E5E7EB" }}>
      <label className="flex items-center gap-2 text-sm" style={{ color: "#12213A" }}>
        <input type="checkbox" checked={isPreview} onChange={(e) => setIsPreview(e.target.checked)} disabled={isUploading} className="h-4 w-4" />
        File xem trước (công khai, không cần mua)
      </label>
      <input type="file" onChange={handleFileChange} disabled={isUploading} className="mt-2 text-sm" />
      {isUploading ? <p className="mt-2 text-sm text-gray-500">Đang tải lên...</p> : null}
      {error ? (
        <p className="mt-2 text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
