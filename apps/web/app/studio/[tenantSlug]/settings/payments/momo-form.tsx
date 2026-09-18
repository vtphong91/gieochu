"use client";

import { useActionState } from "react";
import { saveMomoAction, type PaymentActionState } from "./actions";

const initialState: PaymentActionState = {};

export function MomoForm({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial: { partnerCode: string; accessKey: string; environment: string; isEnabled: boolean; maskedSecret?: string };
}) {
  const action = saveMomoAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <section className="rounded border p-4">
      <h2 className="text-lg font-semibold">MoMo</h2>
      <form action={formAction} className="mt-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="isEnabled" defaultChecked={initial.isEnabled} />
          Bật phương thức này
        </label>
        <input
          name="partnerCode"
          defaultValue={initial.partnerCode}
          placeholder="Partner Code"
          required
          className="w-full rounded border px-3 py-2"
        />
        <input
          name="accessKey"
          defaultValue={initial.accessKey}
          placeholder="Access Key"
          required
          className="w-full rounded border px-3 py-2"
        />
        <select name="environment" defaultValue={initial.environment || "sandbox"} className="w-full rounded border px-3 py-2">
          <option value="sandbox">Sandbox (thử nghiệm)</option>
          <option value="production">Production</option>
        </select>
        <input
          name="secretKey"
          type="password"
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : "Secret Key"}
          className="w-full rounded border px-3 py-2"
        />
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        {state.success ? <p className="text-sm text-green-700">Đã lưu.</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "Đang lưu..." : "Lưu"}
        </button>
      </form>
    </section>
  );
}
