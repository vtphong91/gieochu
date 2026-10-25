"use client";

import { useActionState } from "react";
import { saveCmsPageAction, type CmsActionState } from "./actions";
import { FormBanner, PrimaryButton, SelectField, TextField } from "../_ui/kit";
import { IconDoc, IconGlobe } from "../_ui/icons";
import { CollapsibleSection, sectionStatus } from "../_ui/collapsible-section";
import { useFormDraft } from "../_ui/use-form-draft";
import { useUnsavedChanges } from "../_ui/unsaved-changes";

const initialState: CmsActionState = {};

export interface CmsPageFormValues {
  slug: string;
  title: string;
  blocksJson: string;
  seoTitle: string;
  seoDescription: string;
  status: "DRAFT" | "PUBLISHED";
}

const CONTENT_FIELDS = ["slug", "title", "blocksJson", "status"] as const;
const SEO_FIELDS = ["seoTitle", "seoDescription"] as const;

/**
 * Form trang tuỳ chỉnh (`/p/[slug]`). ADR-058 (task 1.12a): khối Nội dung trang mở, khối SEO luôn thu gọn (kiểu Rank Math).
 * Lưu lỗi giữ giá trị đã nhập (`useFormDraft`), cảnh báo rời trang khi chưa lưu. Không đổi action.
 */
export function CmsPageForm({ initial, slugEditable }: { initial: CmsPageFormValues; slugEditable: boolean }) {
  const [state, formAction, isPending] = useActionState(saveCmsPageAction, initialState);
  const { dirty, dirtyOf, formProps } = useFormDraft({
    names: [...CONTENT_FIELDS, ...SEO_FIELDS],
    initial: { ...initial },
    resetKey: JSON.stringify(initial),
    failed: Boolean(state.error),
  });
  useUnsavedChanges(dirty, "Trang tuỳ chỉnh có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");
  const seoDirty = dirtyOf(SEO_FIELDS);

  return (
    <form action={formAction} className="space-y-4" {...formProps}>
      <CollapsibleSection
        id="trang-noi-dung"
        defaultOpen
        icon={<IconDoc className="h-5 w-5" />}
        title="Nội dung trang"
        description={'Chỉ hiển thị công khai khi trạng thái là "Xuất bản".'}
        status={sectionStatus({ dirty: dirtyOf(CONTENT_FIELDS) })}
      >

        <TextField
          id="cms-slug"
          label="Slug (đường dẫn)"
          name="slug"
          defaultValue={initial.slug}
          readOnly={!slugEditable}
          required
          hint={slugEditable ? `Trang sẽ hiện ở /p/${initial.slug || "<slug>"}` : undefined}
        />
        <TextField id="cms-title" label="Tiêu đề" name="title" defaultValue={initial.title} required />
        <div>
          <label htmlFor="cms-blocksJson" className="block text-sm font-medium" style={{ color: "#12213A" }}>
            Nội dung block (JSON)
          </label>
          <textarea
            id="cms-blocksJson"
            name="blocksJson"
            defaultValue={initial.blocksJson}
            rows={12}
            required
            className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 font-mono text-xs outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
            style={{ borderColor: "#E5E7EB" }}
          />
          <p className="mt-1.5 text-xs text-gray-500">hero / features / stats / testimonials / pricingTable / faq / richText / cta</p>
        </div>
        <SelectField id="cms-status" label="Trạng thái" name="status" defaultValue={initial.status}>
          <option value="DRAFT">Nháp</option>
          <option value="PUBLISHED">Xuất bản</option>
        </SelectField>
      </CollapsibleSection>

      {/* SEO luôn thu gọn, kiểu section Rank Math. */}
      <CollapsibleSection
        id="seo"
        icon={<IconGlobe className="h-5 w-5" />}
        title="SEO"
        description="Không bắt buộc — để trống dùng tiêu đề trang."
        status={sectionStatus({ dirty: seoDirty, empty: initial.seoTitle === "" && initial.seoDescription === "" && !seoDirty, emptyLabel: "Dùng mặc định" })}
      >
        <TextField id="cms-seoTitle" label="SEO title" name="seoTitle" defaultValue={initial.seoTitle} />
        <div>
          <label htmlFor="cms-seoDescription" className="block text-sm font-medium" style={{ color: "#12213A" }}>
            SEO description
          </label>
          <textarea
            id="cms-seoDescription"
            name="seoDescription"
            defaultValue={initial.seoDescription}
            rows={2}
            className="mt-1.5 w-full rounded-lg border bg-white px-3.5 py-2.5 text-[15px] outline-none focus:border-[#0F3B82] focus:ring-2 focus:ring-[#0F3B82]/15"
            style={{ borderColor: "#E5E7EB" }}
          />
        </div>
      </CollapsibleSection>

      <div className="space-y-3">
        <FormBanner ok={false} message={state.error} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
      </div>
    </form>
  );
}
