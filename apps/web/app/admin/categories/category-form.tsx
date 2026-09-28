"use client";

import { useActionState, useState } from "react";
import type { CategoryActionState } from "./actions";
import { ConfigCard, FormBanner, PrimaryButton, TextField } from "../_ui/kit";
import { ImageUploadField } from "../_ui/image-upload-field";
import { IconDoc, IconLayers, IconTag } from "../_ui/icons";
import { TiptapEditor, type TiptapImageUpload } from "../../_ui/editor/tiptap-editor";
import { getCloudinaryUploadSignatureAction } from "../../_ui/cloudinary-actions";

const initialState: CategoryActionState = {};

/** ADR-028: ảnh trong mô tả danh mục dùng chữ ký System Center (không đăng ký hạn mức — không thuộc tenant). */
const DESCRIPTION_IMAGE_UPLOAD: TiptapImageUpload = { getSignature: getCloudinaryUploadSignatureAction };

export interface CategoryFormValues {
  name: string;
  slug: string;
  shortDescription: string;
  description: string;
  imageUrl: string;
  seoTitle: string;
  seoDescription: string;
  ogImageUrl: string;
}

export function CategoryForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: CategoryActionState, formData: FormData) => Promise<CategoryActionState>;
  initial: CategoryFormValues;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [description, setDescription] = useState(initial.description);
  const [imageUrl, setImageUrl] = useState(initial.imageUrl);
  const [ogImageUrl, setOgImageUrl] = useState(initial.ogImageUrl);

  return (
    <form action={formAction} className="space-y-6">
      <ConfigCard icon={<IconTag className="h-5 w-5" />} title="Thông tin danh mục" description="Tên và mô tả ngắn hiển thị trong danh sách/thẻ danh mục.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="category-name" label="Tên danh mục" name="name" defaultValue={initial.name} required />
          <TextField
            id="category-slug"
            label="Đường dẫn"
            name="slug"
            defaultValue={initial.slug}
            placeholder="để trống sẽ tự sinh từ tên"
            hint="Chỉ chữ thường, số và dấu gạch ngang."
          />
        </div>
        <TextField
          id="category-shortDescription"
          label="Mô tả ngắn"
          name="shortDescription"
          defaultValue={initial.shortDescription}
          hint="Hiển thị trong danh sách/thẻ danh mục — tối đa 300 ký tự."
          maxLength={300}
        />
      </ConfigCard>

      <ConfigCard icon={<IconDoc className="h-5 w-5" />} title="Mô tả chi tiết" description="Hiển thị trên trang danh mục — hỗ trợ định dạng đầy đủ.">
        <input type="hidden" name="description" value={description} />
        <TiptapEditor content={description} onChange={setDescription} placeholder="Giới thiệu chi tiết về danh mục tài liệu này..." imageUpload={DESCRIPTION_IMAGE_UPLOAD} />
      </ConfigCard>

      <ConfigCard icon={<IconLayers className="h-5 w-5" />} title="Hình ảnh" description="Ảnh đại diện danh mục và ảnh chia sẻ mạng xã hội.">
        <input type="hidden" name="imageUrl" value={imageUrl} />
        <ImageUploadField label="Ảnh đại diện" hint="Hiển thị trong danh sách/thẻ danh mục." value={imageUrl} onChange={setImageUrl} />

        <input type="hidden" name="ogImageUrl" value={ogImageUrl} />
        <ImageUploadField
          label="Ảnh chia sẻ mạng xã hội (OG Image)"
          hint="Khuyến nghị 1200×630px — hiển thị khi chia sẻ link danh mục lên Facebook, Zalo..."
          value={ogImageUrl}
          onChange={setOgImageUrl}
        />
      </ConfigCard>

      <ConfigCard icon={<IconDoc className="h-5 w-5" />} title="SEO" description="Tối ưu hiển thị trên tab trình duyệt và kết quả tìm kiếm.">
        <TextField
          id="category-seoTitle"
          label="SEO Title"
          name="seoTitle"
          defaultValue={initial.seoTitle}
          placeholder={initial.name}
          hint="Tối đa 70 ký tự — để trống sẽ dùng Tên danh mục."
          maxLength={70}
        />
        <TextField
          id="category-seoDescription"
          label="Meta Description"
          name="seoDescription"
          defaultValue={initial.seoDescription}
          placeholder={initial.shortDescription}
          hint="Tối đa 160 ký tự — để trống sẽ dùng Mô tả ngắn."
          maxLength={160}
        />
      </ConfigCard>

      <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
      <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : submitLabel}</PrimaryButton>
    </form>
  );
}
