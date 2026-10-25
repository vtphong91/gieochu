"use client";

import { useActionState } from "react";
import { saveManualQrAction, type PlatformPaymentActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { IconBank } from "../../_ui/icons";

const initialState: PlatformPaymentActionState = {};

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

export function ManualQrForm({
  banks,
  initial,
}: {
  banks: BankOption[];
  initial: { bankBin: string; accountNo: string; accountName: string; isEnabled: boolean };
}) {
  const [state, formAction, isPending] = useActionState(saveManualQrAction, initialState);

  return (
    // React 19 tự reset form sau action, nhưng <select defaultValue> và trạng thái hiển thị của Toggle không theo
    // giá trị mới từ server → key theo dữ liệu đã lưu để dựng lại form, khớp đúng DB sau mỗi lần lưu.
    <form key={JSON.stringify(initial)} action={formAction}>
      <ConfigCard
        icon={<IconBank className="h-5 w-5" />}
        title="Chuyển khoản thủ công"
        badges={<Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>}
        description="Không có webhook — admin tự xác nhận hoá đơn đã thanh toán sau khi nhận được tiền."
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
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? (state.message ?? "Đã lưu.") : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
