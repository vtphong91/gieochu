"use client";

import { useActionState } from "react";
import { createProductAction, type ProductActionState } from "../actions";

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

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="title">
          Tiêu đề
        </label>
        <input id="title" name="title" required className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="slug">
          Đường dẫn (để trống sẽ tự sinh từ tiêu đề)
        </label>
        <input id="slug" name="slug" className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="type">
          Loại
        </label>
        <select id="type" name="type" defaultValue="OTHER" className="mt-1 w-full rounded border px-3 py-2">
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "Đang tạo..." : "Tạo sản phẩm (nháp)"}
      </button>
    </form>
  );
}
