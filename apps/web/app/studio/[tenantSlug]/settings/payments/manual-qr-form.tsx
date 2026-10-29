"use client";

import { useActionState } from "react";
import { saveManualQrAction, type PaymentActionState } from "./actions";
import { FormBanner, MaskedTextField, PrimaryButton, SelectField, TextField, Toggle } from "../../../../admin/_ui/kit";
import { IconBank } from "../../../../admin/_ui/icons";
import { CollapsibleSection, sectionStatus } from "../../../../admin/_ui/collapsible-section";
import { useFormDraft } from "../../../../admin/_ui/use-form-draft";
import { useUnsavedChanges } from "../../../../admin/_ui/unsaved-changes";

const initialState: PaymentActionState = {};
const FIELDS = ["isEnabled", "bankBin", "accountNo", "accountName"] as const;

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

/**
 * ADR-058 (task 2.2): khối thu gọn — cổng đang bật thì mở sẵn. Khối nằm NGOÀI `<form key>`: form dựng lại theo dữ liệu
 * server sau mỗi lần lưu (Toggle khớp trạng thái thật), trạng thái mở + thông báo không mất. Lưu lỗi giữ giá trị đã nhập.
 */
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
  const formKey = JSON.stringify(initial);
  const { dirty, formProps } = useFormDraft({ names: FIELDS, initial, resetKey: formKey, failed: Boolean(state.error) });
  useUnsavedChanges(dirty, "Cấu hình QR chuyển khoản có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");
  const configured = initial.accountNo.trim() !== "";
  const errorCount = state.error ? 1 : 0;

  return (
    <CollapsibleSection
      id="cong-chuyen-khoan"
      defaultOpen={initial.isEnabled}
      icon={<IconBank className="h-5 w-5" />}
      title="QR chuyển khoản thủ công"
      description="Không có webhook — bạn tự xác nhận đơn đã thanh toán."
      status={sectionStatus({ errorCount, dirty, empty: !initial.isEnabled, emptyLabel: configured ? "Đang tắt" : "Chưa cấu hình", okLabel: "Đang bật" })}
      errorCount={errorCount}
    >
      {/* React 19 tự reset form sau action, nhưng <select defaultValue> và trạng thái hiển thị của Toggle không theo giá
          trị mới từ server → key theo dữ liệu đã lưu để dựng lại form, khớp đúng DB sau mỗi lần lưu. */}
      <form key={formKey} action={formAction} className="space-y-4" {...formProps}>
        <Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật phương thức này" />
        <SelectField id="manual-bankBin" label="Ngân hàng" name="bankBin" defaultValue={initial.bankBin} required>
          <option value="">Chọn ngân hàng</option>
          {banks.map((bank) => (
            <option key={bank.bin} value={bank.bin}>
              {bank.shortName} — {bank.name}
            </option>
          ))}
        </SelectField>
        <MaskedTextField id="manual-accountNo" label="Số tài khoản" name="accountNo" defaultValue={initial.accountNo} required />
        <TextField id="manual-accountName" label="Tên chủ tài khoản" name="accountName" defaultValue={initial.accountName} required />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
      </form>
    </CollapsibleSection>
  );
}
