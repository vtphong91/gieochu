"use client";

import { useActionState } from "react";
import { saveCmsPageAction, type CmsActionState } from "./actions";

const initialState: CmsActionState = {};

export interface CmsPageFormValues {
  slug: string;
  title: string;
  blocksJson: string;
  seoTitle: string;
  seoDescription: string;
  status: "DRAFT" | "PUBLISHED";
}

export function CmsPageForm({ initial, slugEditable }: { initial: CmsPageFormValues; slugEditable: boolean }) {
  const [state, formAction, isPending] = useActionState(saveCmsPageAction, initialState);

  return (
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="slug">
          Slug (đường dẫn, ví dụ &quot;pricing&quot; cho /p/pricing)
        </label>
        <input
          id="slug"
          name="slug"
          defaultValue={initial.slug}
          readOnly={!slugEditable}
          required
          className="mt-1 w-full rounded border px-3 py-2 disabled:bg-gray-100"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="title">
          Tiêu đề
        </label>
        <input id="title" name="title" defaultValue={initial.title} required className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="blocksJson">
          Nội dung block (JSON — hero/features/pricingTable/faq/richText/cta)
        </label>
        <textarea
          id="blocksJson"
          name="blocksJson"
          defaultValue={initial.blocksJson}
          rows={10}
          required
          className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="seoTitle">
          SEO title
        </label>
        <input id="seoTitle" name="seoTitle" defaultValue={initial.seoTitle} className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="seoDescription">
          SEO description
        </label>
        <textarea
          id="seoDescription"
          name="seoDescription"
          defaultValue={initial.seoDescription}
          rows={2}
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="status">
          Trạng thái
        </label>
        <select id="status" name="status" defaultValue={initial.status} className="mt-1 w-full rounded border px-3 py-2">
          <option value="DRAFT">Nháp</option>
          <option value="PUBLISHED">Xuất bản</option>
        </select>
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
