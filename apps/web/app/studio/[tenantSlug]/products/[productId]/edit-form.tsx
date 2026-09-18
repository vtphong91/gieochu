"use client";

import { useActionState } from "react";
import { updateProductAction, type ProductActionState } from "../actions";

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

  return (
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="title">
          Tiêu đề
        </label>
        <input id="title" name="title" defaultValue={initial.title} required className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="description">
          Mô tả
        </label>
        <textarea
          id="description"
          name="description"
          defaultValue={initial.description}
          rows={6}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="type">
          Loại
        </label>
        <select id="type" name="type" defaultValue={initial.type} className="mt-1 w-full rounded border px-3 py-2">
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="tags">
          Cấp học / môn học (cách nhau bởi dấu phẩy)
        </label>
        <input id="tags" name="tags" defaultValue={initial.tags} className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="priceVnd">
            Giá (VND)
          </label>
          <input
            id="priceVnd"
            name="priceVnd"
            type="number"
            min={0}
            defaultValue={initial.priceVnd}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="downloadLimit">
            Giới hạn lượt tải (0 = không giới hạn)
          </label>
          <input
            id="downloadLimit"
            name="downloadLimit"
            type="number"
            min={0}
            defaultValue={initial.downloadLimit}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "Đang lưu..." : "Lưu"}
      </button>
    </form>
  );
}
