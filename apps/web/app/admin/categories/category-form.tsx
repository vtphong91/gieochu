"use client";

import { useActionState, useState } from "react";
import type { CategoryActionState } from "./actions";
import { FormBanner, PrimaryButton, TextField } from "../_ui/kit";
import { ImageUploadField } from "../_ui/image-upload-field";
import { IconDoc, IconGlobe, IconLayers, IconTag } from "../_ui/icons";
import { CollapsibleSection, sectionStatus } from "../_ui/collapsible-section";
import { useFormDraft } from "../_ui/use-form-draft";
import { useUnsavedChanges } from "../_ui/unsaved-changes";
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

/** Ô không kiểm soát (React reset sau action) — mô tả chi tiết và 2 ảnh là state riêng, không bị reset. */
const INFO_FIELDS = ["name", "slug", "shortDescription"] as const;
const SEO_FIELDS = ["seoTitle", "seoDescription"] as const;

/**
 * ADR-058 (task 1.12a): 4 khối — Thông tin danh mục mở; Mô tả chi tiết, Hình ảnh thu gọn; SEO luôn thu gọn (kiểu Rank
 * Math). Lưu lỗi giữ giá trị đã nhập (`useFormDraft`), cảnh báo rời trang khi chưa lưu. Không đổi action.
 */
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
  const { dirtyOf, formProps } = useFormDraft({
    names: [...INFO_FIELDS, ...SEO_FIELDS],
    initial: {
      name: initial.name,
      slug: initial.slug,
      shortDescription: initial.shortDescription,
      seoTitle: initial.seoTitle,
      seoDescription: initial.seoDescription,
    },
    resetKey: JSON.stringify(initial),
    failed: Boolean(state.error),
  });
  const descriptionDirty = description !== initial.description;
  const imagesDirty = imageUrl !== initial.imageUrl || ogImageUrl !== initial.ogImageUrl;
  const infoDirty = dirtyOf(INFO_FIELDS);
  const seoDirty = dirtyOf(SEO_FIELDS);
  useUnsavedChanges(infoDirty || seoDirty || descriptionDirty || imagesDirty, "Danh mục có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");

  return (
    <form action={formAction} className="space-y-4" {...formProps}>
      <CollapsibleSection
        id="danh-muc-thong-tin"
        defaultOpen
        icon={<IconTag className="h-5 w-5" />}
        title="Thông tin danh mục"
        description="Tên và mô tả ngắn hiển thị trong danh sách/thẻ danh mục."
        status={sectionStatus({ dirty: infoDirty })}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        id="danh-muc-mo-ta"
        icon={<IconDoc className="h-5 w-5" />}
        title="Mô tả chi tiết"
        description="Hiển thị trên trang danh mục — hỗ trợ định dạng đầy đủ."
        status={sectionStatus({ dirty: descriptionDirty, empty: description.replace(/<[^>]*>/g, "").trim() === "", emptyLabel: "Chưa có" })}
      >
        <input type="hidden" name="description" value={description} />
        <TiptapEditor content={description} onChange={setDescription} placeholder="Giới thiệu chi tiết về danh mục tài liệu này..." imageUpload={DESCRIPTION_IMAGE_UPLOAD} />
      </CollapsibleSection>

      <CollapsibleSection
        id="danh-muc-hinh-anh"
        icon={<IconLayers className="h-5 w-5" />}
        title="Hình ảnh"
        description="Ảnh đại diện danh mục và ảnh chia sẻ mạng xã hội."
        status={sectionStatus({ dirty: imagesDirty, empty: imageUrl === "" && ogImageUrl === "", emptyLabel: "Chưa có ảnh" })}
      >
        <input type="hidden" name="imageUrl" value={imageUrl} />
        <ImageUploadField label="Ảnh đại diện" hint="Hiển thị trong danh sách/thẻ danh mục." value={imageUrl} onChange={setImageUrl} />

        <input type="hidden" name="ogImageUrl" value={ogImageUrl} />
        <ImageUploadField
          label="Ảnh chia sẻ mạng xã hội (OG Image)"
          hint="Khuyến nghị 1200×630px — hiển thị khi chia sẻ link danh mục lên Facebook, Zalo..."
          value={ogImageUrl}
          onChange={setOgImageUrl}
        />
      </CollapsibleSection>

      {/* SEO luôn thu gọn, kiểu section Rank Math. */}
      <CollapsibleSection
        id="seo"
        icon={<IconGlobe className="h-5 w-5" />}
        title="SEO"
        description="Không bắt buộc — để trống dùng tên và mô tả ngắn của danh mục."
        status={sectionStatus({ dirty: seoDirty, empty: initial.seoTitle === "" && initial.seoDescription === "" && !seoDirty, emptyLabel: "Dùng mặc định" })}
      >
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
      </CollapsibleSection>

      <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
      <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : submitLabel}</PrimaryButton>
    </form>
  );
}
