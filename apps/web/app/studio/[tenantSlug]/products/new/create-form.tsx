"use client";

import { useActionState, useState } from "react";
import { TiptapEditor } from "../../../../_ui/editor/tiptap-editor";
import { createProductAction, type ProductActionState } from "../actions";
import { ConfigCard, FormBanner, PrimaryButton, SelectField, TextField } from "../../../../admin/_ui/kit";
import { IconPackage } from "../../../../admin/_ui/icons";

const initialState: ProductActionState = {};

const TYPE_LABEL: Record<string, string> = {
  TEMPLATE: "Mẫu / Template",
  SLIDE: "Slide bài giảng",
  EBOOK: "Ebook",
  EXAM: "Đề thi / Đề kiểm tra",
  OTHER: "Khác",
};

export function CreateProductForm({ tenantSlug }: { tenantSlug: string }) {
  const action = createProductAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [description, setDescription] = useState("");

  return (
    <form action={formAction}>
      <ConfigCard icon={<IconPackage className="h-5 w-5" />} title="Thông tin sản phẩm" description="Có thể sửa lại mọi thứ sau khi tạo.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="title" label="Tiêu đề" name="title" required />
          <TextField id="slug" label="Đường dẫn" name="slug" placeholder="để trống sẽ tự sinh từ tiêu đề" />
        </div>
        <SelectField id="type" label="Loại" name="type" defaultValue="OTHER">
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </SelectField>
        <div>
          <span className="block text-sm font-medium" style={{ color: "#12213A" }}>
            Mô tả (tuỳ chọn — có thể bổ sung sau)
          </span>
          <input type="hidden" name="description" value={description} />
          <div className="mt-1.5">
            <TiptapEditor content={description} onChange={setDescription} placeholder="Mô tả chi tiết sản phẩm..." />
          </div>
        </div>

        <FormBanner ok={false} message={state.error} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang tạo..." : "Tạo sản phẩm (nháp)"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
