"use client";

import { useActionState } from "react";
import { selectProviderAction, type CheckoutActionState } from "./actions";

const initialState: CheckoutActionState = {};

const PROVIDER_LABEL: Record<string, string> = {
  MANUAL_QR: "QR chuyển khoản thủ công",
  SEPAY: "SePay (tự động)",
  MOMO: "MoMo",
};

export function ProviderPanel({ tenantSlug, orderCode, enabledProviders }: { tenantSlug: string; orderCode: string; enabledProviders: string[] }) {
  const action = selectProviderAction.bind(null, tenantSlug, orderCode);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (enabledProviders.length === 0) {
    return <p className="text-sm text-gray-500">Trang chưa bật phương thức thanh toán nào — vui lòng liên hệ người bán.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <select name="provider" className="w-full rounded border px-3 py-2 text-sm">
        {enabledProviders.map((provider) => (
          <option key={provider} value={provider}>
            {PROVIDER_LABEL[provider] ?? provider}
          </option>
        ))}
      </select>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="w-full rounded bg-[var(--color-primary)] px-4 py-2 font-medium text-white disabled:opacity-50"
      >
        {isPending ? "Đang tạo..." : "Tiếp tục thanh toán"}
      </button>
    </form>
  );
}
