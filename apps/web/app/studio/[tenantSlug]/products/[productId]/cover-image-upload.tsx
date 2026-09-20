"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface PresignResponse {
  objectKey: string;
  upload: { mode: "single"; url: string } | { mode: "multipart" };
}

export function CoverImageUpload({ tenantSlug, productId, currentUrl }: { tenantSlug: string; productId: string; currentUrl: string | null }) {
  const router = useRouter();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setError(null);
    try {
      const presignRes = await fetch(`/api/studio/${tenantSlug}/uploads/cover-presign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, fileName: file.name, sizeBytes: file.size, mimeType: file.type || "image/png" }),
      });
      if (!presignRes.ok) {
        const body = await presignRes.json();
        throw new Error(body.error?.message ?? "Không tạo được URL tải lên.");
      }
      const { objectKey, upload }: PresignResponse = await presignRes.json();
      if (upload.mode !== "single") {
        throw new Error("Ảnh bìa quá lớn cho tải trực tiếp.");
      }

      const putRes = await fetch(upload.url, { method: "PUT", body: file, headers: { "Content-Type": file.type || "image/png" } });
      if (!putRes.ok) throw new Error("Tải ảnh lên storage thất bại.");

      const completeRes = await fetch(`/api/studio/${tenantSlug}/uploads/cover-complete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, objectKey }),
      });
      if (!completeRes.ok) {
        const body = await completeRes.json();
        throw new Error(body.error?.message ?? "Không xác nhận được ảnh vừa tải lên.");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Tải ảnh lên thất bại.");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <div className="rounded-lg border p-3" style={{ borderColor: "#E5E7EB" }}>
      {currentUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={currentUrl} alt="Ảnh bìa" className="h-32 w-full rounded-lg object-cover" />
      ) : (
        <p className="text-sm text-gray-500">Chưa có ảnh bìa.</p>
      )}
      <input type="file" accept="image/png,image/jpeg" onChange={handleFileChange} disabled={isUploading} className="mt-2 text-sm" />
      {isUploading ? <p className="mt-1 text-sm text-gray-500">Đang tải lên...</p> : null}
      {error ? (
        <p className="mt-1 text-sm" style={{ color: "#DC2626" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
