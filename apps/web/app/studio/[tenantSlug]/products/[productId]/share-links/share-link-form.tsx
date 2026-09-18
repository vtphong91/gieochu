"use client";

import { useActionState } from "react";
import { createShareLinkAction, type ShareLinkActionState } from "./actions";

const initialState: ShareLinkActionState = {};

export interface FileOption {
  id: string;
  fileName: string;
}

export function ShareLinkForm({ tenantSlug, productId, files, appUrl }: { tenantSlug: string; productId: string; files: FileOption[]; appUrl: string }) {
  const action = createShareLinkAction.bind(null, tenantSlug, productId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (state.createdToken) {
    const url = `${appUrl}/s/${state.createdToken}`;
    return (
      <div className="rounded border border-green-200 bg-green-50 p-4 text-sm">
        <p className="font-medium text-green-800">Đã tạo link — chỉ hiển thị một lần, hãy sao chép ngay:</p>
        <code className="mt-2 block break-all rounded bg-white p-2 text-xs">{url}</code>
      </div>
    );
  }

  return (
    <form action={formAction} className="space-y-3 rounded border p-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="label">
          Nhãn
        </label>
        <input id="label" name="label" required className="mt-1 w-full rounded border px-3 py-2 text-sm" placeholder="Gửi cho anh Nam" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium" htmlFor="expiresAt">
            Hết hạn (tuỳ chọn)
          </label>
          <input id="expiresAt" name="expiresAt" type="datetime-local" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="maxUses">
            Số lượt tối đa (tuỳ chọn)
          </label>
          <input id="maxUses" name="maxUses" type="number" min={1} className="mt-1 w-full rounded border px-3 py-2 text-sm" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="password">
          Mật khẩu (tuỳ chọn)
        </label>
        <input id="password" name="password" type="text" className="mt-1 w-full rounded border px-3 py-2 text-sm" />
      </div>
      <div>
        <p className="text-sm font-medium">File (bỏ trống = tất cả file bán)</p>
        <div className="mt-1 space-y-1">
          {files.map((file) => (
            <label key={file.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" name="fileIds" value={file.id} />
              {file.fileName}
            </label>
          ))}
        </div>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-[var(--color-primary)] px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {isPending ? "Đang tạo..." : "Tạo link"}
      </button>
    </form>
  );
}
