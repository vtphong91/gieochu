"use client";

import { useRef, useState, useTransition } from "react";
import { brandColors } from "@gieochu/config/theme";
import { AccountAvatar } from "../../_ui/account-avatar";
import { ImageUploadField } from "../../admin/_ui/image-upload-field";
import { ResultBanner, type AccountFormState } from "../_ui/form-feedback";
import { getAvatarUploadSignatureAction, removeAvatarAction, saveAvatarAction } from "./actions";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;

/**
 * ADR-041 C.3/C6 — ảnh đại diện. Upload ngay khi chọn ảnh (không đợi nút Lưu của form hồ sơ): `ImageUploadField` lấy
 * chữ ký `getAvatarUploadSignatureAction` → upload thẳng Cloudinary → `saveAvatarAction(publicId)` kiểm định dạng/dung
 * lượng và lưu. "Gỡ ảnh" gọi `removeAvatarAction`. Ảnh chỉ hiện ở chỗ riêng tư (header, khu vực tài khoản).
 * `uploadEnabled=false` (Cloudinary hệ thống chưa cấu hình/đang tắt): ẩn ô tải, hiện ghi chú; vẫn gỡ được ảnh đang có.
 */
export function AvatarCard({
  initialUrl,
  displayName,
  maxBytes,
  uploadEnabled,
}: {
  initialUrl: string | null;
  displayName: string;
  maxBytes: number;
  uploadEnabled: boolean;
}) {
  const [url, setUrl] = useState(initialUrl ?? "");
  const [result, setResult] = useState<AccountFormState>(null);
  const [removing, startRemoving] = useTransition();
  const bannerRef = useRef<HTMLDivElement>(null);

  function announce(state: AccountFormState) {
    setResult(state);
    // Banner render ở lần commit sau — focus ở frame kế tiếp.
    requestAnimationFrame(() => bannerRef.current?.focus());
  }

  function handleChange(next: string) {
    if (next) {
      setUrl(next);
      announce({ ok: true, message: "Đã cập nhật ảnh đại diện." });
      return;
    }
    // Gỡ ảnh: đổi giao diện ngay, lỗi thì trả lại ảnh cũ.
    const previous = url;
    setUrl("");
    startRemoving(async () => {
      const state = await removeAvatarAction();
      if (!state?.ok) setUrl(previous);
      announce(state ?? { ok: false, code: "UNKNOWN", formError: "Không gỡ được ảnh, vui lòng thử lại." });
    });
  }

  return (
    <section aria-labelledby="avatar-title" className="min-w-0 rounded-2xl border bg-white p-5 sm:p-6" style={{ borderColor: "#E5E7EB" }}>
      <div className="flex items-center gap-4">
        <AccountAvatar url={url || null} name={displayName} size={64} />
        <div className="min-w-0">
          <h2 id="avatar-title" className="font-[family-name:var(--font-heading)] font-semibold" style={{ color: INK }}>
            Ảnh đại diện
          </h2>
          <p className="mt-0.5 text-sm" style={{ color: INK_SOFT }}>
            Hiện ở menu tài khoản và khu vực quản lý của bạn — không hiện công khai.
          </p>
        </div>
      </div>
      <div className="mt-5 space-y-3" aria-busy={removing || undefined}>
        {uploadEnabled ? (
          <ImageUploadField
            label={url ? "Đổi ảnh đại diện" : "Tải ảnh đại diện"}
            hint="PNG, JPEG hoặc WebP, tối đa 2 MB. Ảnh được cắt vuông theo khuôn mặt."
            value={url}
            onChange={handleChange}
            getSignature={getAvatarUploadSignatureAction}
            register={async (publicId) => {
              const state = await saveAvatarAction(publicId);
              if (state?.ok) return { ok: true, url: state.avatarUrl ?? "" };
              return { ok: false, error: state?.formError ?? "Không lưu được ảnh, vui lòng thử lại." };
            }}
            accept="image/png,image/jpeg,image/webp"
            maxBytes={maxBytes}
            removeLabel={removing ? "Đang gỡ…" : "Gỡ ảnh"}
            previewClassName="w-full sm:w-80"
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm" style={{ color: INK_SOFT }}>
              Tính năng tải ảnh đại diện tạm chưa dùng được.
            </p>
            {url ? (
              <button
                type="button"
                onClick={() => handleChange("")}
                disabled={removing}
                className="min-h-11 rounded-lg border px-4 py-2 text-sm font-medium disabled:opacity-60"
                style={{ borderColor: "#E5E7EB", color: INK }}
              >
                {removing ? "Đang gỡ…" : "Gỡ ảnh"}
              </button>
            ) : null}
          </div>
        )}
        <ResultBanner state={result} bannerRef={bannerRef} />
      </div>
    </section>
  );
}
