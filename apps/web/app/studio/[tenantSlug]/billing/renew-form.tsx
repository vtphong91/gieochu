"use client";

import { useActionState } from "react";
import { renewSubscriptionAction, type BillingActionState } from "./actions";
import { FormBanner, PrimaryButton, SelectField } from "../../../admin/_ui/kit";

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
    <form action={formAction} className="space-y-4">
      <SelectField id="planId" label="Gói dịch vụ" name="planId" defaultValue={currentPlanId}>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name} — {plan.priceVnd.toLocaleString("vi-VN")}đ
          </option>
        ))}
      </SelectField>
      <SelectField id="provider" label="Phương thức thanh toán" name="provider">
        {enabledProviders.map((provider) => (
          <option key={provider} value={provider}>
            {PROVIDER_LABEL[provider] ?? provider}
          </option>
        ))}
      </SelectField>
      <FormBanner ok={false} message={state.error} />
      <PrimaryButton loading={isPending}>{isPending ? "Đang tạo hoá đơn..." : "Gia hạn / Nâng cấp"}</PrimaryButton>
    </form>
  );
}
