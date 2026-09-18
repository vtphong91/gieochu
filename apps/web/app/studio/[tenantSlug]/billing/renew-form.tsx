"use client";

import { useActionState } from "react";
import { renewSubscriptionAction, type BillingActionState } from "./actions";

const initialState: BillingActionState = {};

const PROVIDER_LABEL: Record<string, string> = {
  MANUAL_QR: "QR chuyển khoản thủ công",
  SEPAY: "SePay (tự động)",
  MOMO: "MoMo",
};

export interface PlanOption {
  id: string;
  name: string;
  priceVnd: number;
}

export function RenewForm({
  tenantSlug,
  plans,
  currentPlanId,
  enabledProviders,
}: {
  tenantSlug: string;
  plans: PlanOption[];
  currentPlanId: string;
  enabledProviders: string[];
}) {
  const action = renewSubscriptionAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  if (enabledProviders.length === 0) {
    return <p className="text-sm text-gray-500">Nền tảng chưa bật phương thức thanh toán nào — vui lòng liên hệ hỗ trợ.</p>;
  }

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <label className="block text-sm font-medium" htmlFor="planId">
          Gói dịch vụ
        </label>
        <select id="planId" name="planId" defaultValue={currentPlanId} className="mt-1 w-full rounded border px-3 py-2">
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name} — {plan.priceVnd.toLocaleString("vi-VN")}đ
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="provider">
          Phương thức thanh toán
        </label>
        <select id="provider" name="provider" className="mt-1 w-full rounded border px-3 py-2">
          {enabledProviders.map((provider) => (
            <option key={provider} value={provider}>
              {PROVIDER_LABEL[provider] ?? provider}
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
        {isPending ? "Đang tạo hoá đơn..." : "Gia hạn / Nâng cấp"}
      </button>
    </form>
  );
}
