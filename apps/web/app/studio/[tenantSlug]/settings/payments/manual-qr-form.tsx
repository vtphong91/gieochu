"use client";

import { useActionState } from "react";
import { saveManualQrAction, type PaymentActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../../../../admin/_ui/kit";
import { IconBank } from "../../../../admin/_ui/icons";

const initialState: PaymentActionState = {};

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

export function ManualQrForm({
  tenantSlug,
  banks,
  initial,
}: {
  tenantSlug: string;
  banks: BankOption[];
  initial: { bankBin: string; accountNo: string; accountName: string; isEnabled: boolean };
}) {
  const action = saveManualQrAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <ConfigCard
        icon={<IconBank className="h-5 w-5" />}
        title="QR chuyển khoản thủ công"
        badges={<Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>}
        description="Không có webhook — bạn tự xác nhận đơn đã thanh toán."
        toggle={<Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật" />}
      >
        <SelectField id="manual-bankBin" label="Ngân hàng" name="bankBin" defaultValue={initial.bankBin} required>
          <option value="">Chọn ngân hàng</option>
          {banks.map((bank) => (
            <option key={bank.bin} value={bank.bin}>
              {bank.shortName} — {bank.name}
            </option>
          ))}
        </SelectField>
        <TextField id="manual-accountNo" label="Số tài khoản" name="accountNo" defaultValue={initial.accountNo} required />
        <TextField id="manual-accountName" label="Tên chủ tài khoản" name="accountName" defaultValue={initial.accountName} required />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
