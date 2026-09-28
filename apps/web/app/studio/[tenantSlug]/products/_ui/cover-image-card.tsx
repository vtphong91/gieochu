"use client";

import { brandColors } from "@gieochu/config/theme";
import { Badge, ConfigCard } from "../../../../admin/_ui/kit";
import { ImageUploadField } from "../../../../admin/_ui/image-upload-field";
import { IconImagePic } from "../../../../_ui/editor/toolbar-icons";
import { getProductCoverUploadSignatureAction } from "../actions";
import { registerTenantImageAction } from "../../media-actions";
import { WarningNote } from "./editor-bits";

/** Giới hạn kiểm ở trình duyệt trước khi upload (Cloudinary không nhận file quá lớn ở gói miễn phí). */
const MAX_COVER_BYTES = 5 * 1024 * 1024;

/**
 * Card "Ảnh đại diện" (ADR-027 §3): upload thẳng lên Cloudinary bằng chữ ký của tenant — dùng được ngay ở
 * trang Tạo (không cần `productId`). Giá trị `secure_url` đi theo form ở field ẩn `coverImageUrl`; chuỗi rỗng
 * = gỡ ảnh Cloudinary (khi đó ảnh R2 cũ, nếu có, hiện lại). `legacyUrl` = ảnh R2 cũ đang hiển thị (chỉ khi
 * chưa có ảnh Cloudinary) — báo người dùng tải ảnh mới để thay.
 */
export function CoverImageCard({
  tenantSlug,
  value,
  onChange,
  legacyUrl,
  error,
}: {
  tenantSlug: string;
  value: string;
  onChange: (url: string) => void;
  legacyUrl: string | null;
  error?: string;
}) {
  const showLegacy = !value && Boolean(legacyUrl);
  const hasCover = Boolean(value) || showLegacy;

  return (
    <div id="coverImageUrl" tabIndex={-1} className="rounded-2xl outline-none">
      <ConfigCard
        icon={<IconImagePic className="h-5 w-5" />}
        title="Ảnh đại diện"
        description="Hiện trên thẻ tài liệu và đầu trang chi tiết. Cần có trước khi Công khai."
        badges={hasCover ? <Badge tone="success">Đã có</Badge> : <Badge tone="warning">Chưa có</Badge>}
      >
        <input type="hidden" name="coverImageUrl" value={value} />

        {showLegacy ? (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <div
              className="aspect-[16/10] w-full shrink-0 overflow-hidden rounded-xl border sm:w-48"
              style={{ borderColor: brandColors.line, background: brandColors.surface }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- ảnh bucket public R2 cũ, host do admin cấu hình */}
              <img src={legacyUrl!} alt="Ảnh đại diện hiện tại (ảnh cũ)" className="h-full w-full object-cover" />
            </div>
            <div className="min-w-0 flex-1">
              <WarningNote title="Đang dùng ảnh cũ">Tải ảnh mới bên dưới để thay — ảnh cũ vẫn hiển thị cho tới khi bạn lưu ảnh mới.</WarningNote>
            </div>
          </div>
        ) : null}

        <ImageUploadField
          label={showLegacy ? "Tải ảnh mới" : "Ảnh đại diện"}
          hint="PNG, JPG hoặc WebP, tối đa 5MB. Nên dùng ảnh ngang tỉ lệ 16:10 (ví dụ 1600×1000px)."
          value={value}
          onChange={onChange}
          getSignature={() => getProductCoverUploadSignatureAction(tenantSlug)}
          register={(publicId) => registerTenantImageAction(tenantSlug, publicId, "PRODUCT_COVER")}
          maxBytes={MAX_COVER_BYTES}
          accept="image/png,image/jpeg,image/webp"
          removeLabel="Gỡ ảnh"
          // Cột chính rộng (~1000px): chặn vùng kéo-thả ở 448px để khung không loãng, nút "Gỡ ảnh" nằm cạnh.
          previewClassName="w-full md:max-w-md"
        />

        {error ? (
          <p role="alert" className="text-sm" style={{ color: "#DC2626" }}>
            {error}
          </p>
        ) : null}
      </ConfigCard>
    </div>
  );
}
