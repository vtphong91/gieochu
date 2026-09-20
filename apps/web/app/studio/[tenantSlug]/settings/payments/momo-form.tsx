"use client";

import { useActionState } from "react";
import { saveMomoAction, type PaymentActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../../../../admin/_ui/kit";
import { IconWallet } from "../../../../admin/_ui/icons";

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
    <form action={formAction}>
      <ConfigCard
        icon={<IconWallet className="h-5 w-5" />}
        title="MoMo"
        badges={<Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>}
        description="Ví điện tử MoMo — xác nhận tự động qua API chính thức."
        toggle={<Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật" />}
        footer={
          <p className="text-xs" style={{ color: "#B45309" }}>
            Đổi partner code hoặc secret key sẽ tự tắt phương thức này — lưu lại lần nữa (đã tích &quot;Bật&quot;) để xác nhận.
          </p>
        }
      >
        <TextField id="momo-partnerCode" label="Partner Code" name="partnerCode" defaultValue={initial.partnerCode} required />
        <TextField id="momo-accessKey" label="Access Key" name="accessKey" defaultValue={initial.accessKey} required />
        <SelectField id="momo-environment" label="Môi trường" name="environment" defaultValue={initial.environment || "sandbox"}>
          <option value="sandbox">Sandbox (thử nghiệm)</option>
          <option value="production">Production</option>
        </SelectField>
        <TextField
          id="momo-secretKey"
          label="Secret Key"
          name="secretKey"
          type="password"
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : undefined}
        />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
