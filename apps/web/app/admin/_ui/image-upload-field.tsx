"use client";

import { useRef, useState } from "react";
import { getCloudinaryUploadSignatureAction } from "../../_ui/cloudinary-actions";

/** Ô upload ảnh kéo-thả dùng chung mọi nơi trong admin — ký chữ ký phía server (không lộ API secret), upload thẳng lên Cloudinary từ trình duyệt. */
export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  previewClassName,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  previewClassName?: string;
}) {
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function uploadFile(file: File) {
    setError(null);
    setUploading(true);
    try {
      const sig = await getCloudinaryUploadSignatureAction();
      if (!sig.ok) {
        setError(sig.error ?? "Chưa cấu hình Cloudinary.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sig.apiKey);
      formData.append("timestamp", String(sig.timestamp));
      formData.append("signature", sig.signature);
      formData.append("folder", sig.folder);

      const response = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result?.error?.message ?? "Upload thất bại.");
        return;
      }
      onChange(result.secure_url as string);
    } catch {
      setError("Upload thất bại — kiểm tra kết nối mạng.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <label className="block text-sm font-medium" style={{ color: "#12213A" }}>
        {label}
      </label>
      {hint ? (
        <p className="mt-0.5 text-xs text-gray-500" id={`${label}-hint`}>
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-start gap-3">
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void uploadFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition hover:bg-gray-50 ${previewClassName ?? "w-full"}`}
          style={{ borderColor: "#E5E7EB" }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh ngoài (Cloudinary), không qua next/image optimize
            <img src={value} alt="" className="max-h-24 max-w-full rounded-md object-contain" />
          ) : (
            <p className="text-xs text-gray-400">{isUploading ? "Đang upload..." : "Kéo ảnh vào đây hoặc nhấn để chọn"}</p>
          )}
          <input
            ref={inputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadFile(file);
            }}
          />
        </div>
        {value ? (
          <button type="button" onClick={() => onChange("")} className="text-xs font-semibold" style={{ color: "#DC2626" }}>
            Xoá ảnh
          </button>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="mt-1.5 text-xs" style={{ color: "#DC2626" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
