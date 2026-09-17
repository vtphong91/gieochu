"use client";

import { useActionState } from "react";
import { changeSlugAction, type SettingsActionState } from "./actions";

const initialState: SettingsActionState = {};

export function SlugForm({ tenantSlug }: { tenantSlug: string }) {
  const action = changeSlugAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div className="mt-10 border-t pt-6">
      <h2 className="text-lg font-semibold">Đổi đường dẫn</h2>
      <p className="mt-1 text-sm text-gray-600">
        Đường dẫn hiện tại: <span className="font-mono">/{tenantSlug}</span>. Chỉ đổi được tối đa 1 lần / 30
        ngày; đường dẫn cũ sẽ tự chuyển hướng sang đường dẫn mới.
      </p>
      <form action={formAction} className="mt-3 flex gap-2">
        <input name="newSlug" placeholder="duong-dan-moi" className="w-full rounded border px-3 py-2" />
        <button
          type="submit"
          disabled={isPending}
          className="whitespace-nowrap rounded border border-[var(--color-primary)] px-4 py-2 text-[var(--color-primary)] disabled:opacity-50"
        >
          {isPending ? "Đang đổi..." : "Đổi đường dẫn"}
        </button>
      </form>
      {state.error ? <p className="mt-2 text-sm text-red-600">{state.error}</p> : null}
    </div>
  );
}
