"use client";

import { useId, useRef, useState } from "react";
import { cloudinaryDeliveryUrl } from "@gieochu/core/cloudinary-url";
import { getCloudinaryUploadSignatureAction, type CloudinarySignatureResult } from "../../_ui/cloudinary-actions";

/** Ô upload ảnh kéo-thả dùng chung mọi nơi trong admin — ký chữ ký phía server (không lộ API secret), upload thẳng lên Cloudinary từ trình duyệt. */
export function ImageUploadField({
  label,
  hint,
  value,
  onChange,
  previewClassName,
  getSignature = getCloudinaryUploadSignatureAction,
  maxBytes,
  accept = "image/png,image/jpeg,image/webp,image/svg+xml",
  removeLabel = "Xoá ảnh",
  register,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (url: string) => void;
  previewClassName?: string;
  /** Mặc định: chữ ký hệ thống (admin). Studio truyền action ký riêng theo tenant (folder + định dạng giới hạn). */
  getSignature?: () => Promise<CloudinarySignatureResult>;
  /** Giới hạn dung lượng kiểm tra ở trình duyệt trước khi upload (byte). */
  maxBytes?: number;
  accept?: string;
  /** Nhãn nút gỡ ảnh (mặc định "Xoá ảnh"). */
  removeLabel?: string;
  /**
   * ADR-028 — ảnh tenant: gọi ngay sau khi upload thành công với `public_id` Cloudinary trả về (server đọc dung
   * lượng thật, tính hạn mức). Giá trị đưa vào `onChange` là `url` server trả về. Admin không truyền.
   */
  register?: (publicId: string) => Promise<{ ok: true; url: string } | { ok: false; error: string }>;
}) {
  const [isUploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseId = useId();
  const labelId = `${baseId}-label`;
  const hintId = `${baseId}-hint`;
  const actionId = `${baseId}-action`;
  const errorId = `${baseId}-error`;

  async function uploadFile(file: File) {
    setError(null);
    if (maxBytes && file.size > maxBytes) {
      setError(`Ảnh tối đa ${Math.round(maxBytes / 1024 / 1024)}MB.`);
      return;
    }
    setUploading(true);
    try {
      let sig: CloudinarySignatureResult;
      try {
        sig = await getSignature();
      } catch {
        // Action ký ném lỗi không hiển thị được (thường do mất quyền / phiên đăng nhập hết hạn) — không phải lỗi mạng.
        setError("Không lấy được quyền tải ảnh lên. Phiên đăng nhập có thể đã hết hạn hoặc tài khoản không có quyền — tải lại trang rồi thử lại.");
        return;
      }
      if (!sig.ok) {
        setError(sig.error ?? "Chưa cấu hình Cloudinary.");
        return;
      }
      const formData = new FormData();
      formData.append("file", file);
      formData.append("api_key", sig.apiKey);
      formData.append("timestamp", String(sig.timestamp));
      formData.append("signature", sig.signature);
      // Gửi nguyên vẹn bộ tham số đã ký (folder | public_id, allowed_formats, transformation...) — ADR-028.
      for (const [key, paramValue] of Object.entries(sig.uploadParams)) {
        if (key !== "timestamp") formData.append(key, paramValue);
      }

      const response = await fetch(`https://api.cloudinary.com/v1_1/${sig.cloudName}/image/upload`, {
        method: "POST",
        body: formData,
      });
      const result = await response.json();
      if (!response.ok) {
        setError(result?.error?.message ?? "Upload thất bại.");
        return;
      }
      if (register) {
        const registered = await register(result.public_id as string);
        if (!registered.ok) {
          setError(registered.error);
          return;
        }
        onChange(registered.url);
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
      {/* Nhãn gắn với nút chọn ảnh qua aria-labelledby (ô file thật bị ẩn — không dùng <label htmlFor>). */}
      <p id={labelId} className="block text-sm font-medium" style={{ color: "#12213A" }}>
        {label}
      </p>
      {hint ? (
        <p className="mt-0.5 text-xs text-gray-500" id={hintId}>
          {hint}
        </p>
      ) : null}
      <div className="mt-1.5 flex flex-wrap items-start gap-3">
        {/* Vùng kéo-thả là <button> để chọn được bằng bàn phím (Enter/Space) — kéo-thả chỉ là cách bổ sung. */}
        <button
          type="button"
          disabled={isUploading}
          aria-labelledby={`${labelId} ${actionId}`}
          aria-describedby={[hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") || undefined}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            const file = e.dataTransfer.files?.[0];
            if (file) void uploadFile(file);
          }}
          onClick={() => inputRef.current?.click()}
          className={`flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition hover:bg-gray-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0F3B82] disabled:cursor-wait ${previewClassName ?? "w-full"}`}
          style={{ borderColor: "#D1D5DB" }}
        >
          {value ? (
            // eslint-disable-next-line @next/next/no-img-element -- ảnh ngoài (Cloudinary), không qua next/image optimize
            <img src={cloudinaryDeliveryUrl(value, { width: 600 })} alt="" className="max-h-24 max-w-full rounded-md object-contain" />
          ) : null}
          <span id={actionId} className="text-xs text-gray-600" aria-live="polite">
            {isUploading ? "Đang tải ảnh lên..." : value ? "Nhấn hoặc kéo ảnh khác vào để thay" : "Kéo ảnh vào đây hoặc nhấn để chọn"}
          </span>
        </button>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadFile(file);
          }}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            disabled={isUploading}
            className="inline-flex min-h-11 items-center rounded-md px-2 text-xs font-semibold hover:bg-red-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#DC2626] sm:min-h-8"
            style={{ color: "#DC2626" }}
          >
            {removeLabel}
          </button>
        ) : null}
      </div>
      {error ? (
        <p id={errorId} role="alert" className="mt-1.5 text-xs" style={{ color: "#DC2626" }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
