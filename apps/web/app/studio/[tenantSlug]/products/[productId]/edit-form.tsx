"use client";

import { useActionState, useState } from "react";
import { TiptapEditor } from "../../../../_ui/editor/tiptap-editor";
import { updateProductAction, type ProductActionState } from "../actions";
import { ConfigCard, FormBanner, PrimaryButton, SelectField, TextField } from "../../../../admin/_ui/kit";
import { IconCard, IconPackage } from "../../../../admin/_ui/icons";

const initialState: ProductActionState = {};

const TYPE_LABEL: Record<string, string> = {
  TEMPLATE: "Mẫu / Template",
  SLIDE: "Slide bài giảng",
  EBOOK: "Ebook",
  EXAM: "Đề thi / Đề kiểm tra",
  OTHER: "Khác",
};

export interface EditProductValues {
  title: string;
  description: string;
  type: string;
  tags: string;
  priceVnd: number;
  /** empty string = no sale price set */
  salePriceVnd: string;
  /** "YYYY-MM-DDTHH:mm" (datetime-local format) or empty string */
  saleStartsAt: string;
  saleEndsAt: string;
  downloadLimit: number;
}

export function EditProductForm({
  tenantSlug,
  productId,
  initial,
}: {
  tenantSlug: string;
  productId: string;
  initial: EditProductValues;
}) {
  const action = updateProductAction.bind(null, tenantSlug, productId);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [description, setDescription] = useState(initial.description);

  return (
    <form action={formAction} className="space-y-6">
      <ConfigCard icon={<IconPackage className="h-5 w-5" />} title="Thông tin sản phẩm">
        <TextField id="title" label="Tiêu đề" name="title" defaultValue={initial.title} required />

        <div>
          <span className="block text-sm font-medium" style={{ color: "#12213A" }}>
            Mô tả
          </span>
          <input type="hidden" name="description" value={description} />
          <div className="mt-1.5">
            <TiptapEditor content={description} onChange={setDescription} placeholder="Mô tả chi tiết sản phẩm..." />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="type" label="Loại" name="type" defaultValue={initial.type}>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <TextField id="tags" label="Cấp học / môn học" name="tags" defaultValue={initial.tags} hint="Cách nhau bởi dấu phẩy." />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="priceVnd" label="Giá (VND)" name="priceVnd" type="number" min={0} defaultValue={initial.priceVnd} required />
          <TextField
            id="downloadLimit"
            label="Giới hạn lượt tải"
            name="downloadLimit"
            type="number"
            min={0}
            defaultValue={initial.downloadLimit}
            hint="0 = không giới hạn."
            required
          />
        </div>
      </ConfigCard>

      <ConfigCard icon={<IconCard className="h-5 w-5" />} title="Giá ưu đãi" description="Tuỳ chọn — để trống nếu không áp dụng.">
        <TextField
          id="salePriceVnd"
          label="Giá ưu đãi (VND)"
          name="salePriceVnd"
          type="number"
          min={0}
          defaultValue={initial.salePriceVnd}
          hint="Phải nhỏ hơn giá gốc."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="saleStartsAt" label="Bắt đầu" name="saleStartsAt" type="datetime-local" defaultValue={initial.saleStartsAt} />
          <TextField id="saleEndsAt" label="Kết thúc" name="saleEndsAt" type="datetime-local" defaultValue={initial.saleEndsAt} />
        </div>
      </ConfigCard>

      <FormBanner ok={false} message={state.error} />
      <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
    </form>
  );
}
