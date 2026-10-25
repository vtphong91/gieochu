"use client";

import { useActionState } from "react";
import { saveManualQrAction, type PlatformPaymentActionState } from "./actions";
import { FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { IconBank } from "../../_ui/icons";
import { CollapsibleSection, sectionStatus } from "../../_ui/collapsible-section";
import { useFormDraft } from "../../_ui/use-form-draft";
import { useUnsavedChanges } from "../../_ui/unsaved-changes";

const initialState: PlatformPaymentActionState = {};
const FIELDS = ["isEnabled", "bankBin", "accountNo", "accountName"] as const;

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

/**
 * ADR-058 (task 1.11): khối thu gọn — cổng đang bật thì mở sẵn. Khối nằm NGOÀI `<form key>` để trạng thái mở và thông báo
 * không mất khi form dựng lại sau lần lưu. Lưu lỗi giữ giá trị đã nhập (`useFormDraft`), cảnh báo rời trang khi chưa lưu.
 */
export function ManualQrForm({
  banks,
  initial,
}: {
  banks: BankOption[];
  initial: { bankBin: string; accountNo: string; accountName: string; isEnabled: boolean };
}) {
  const [state, formAction, isPending] = useActionState(saveManualQrAction, initialState);
  const formKey = JSON.stringify(initial);
  const { dirty, formProps } = useFormDraft({ names: FIELDS, initial, resetKey: formKey, failed: Boolean(state.error) });
  useUnsavedChanges(dirty, "Cấu hình Chuyển khoản thủ công có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");
  const configured = initial.accountNo.trim() !== "";
  const errorCount = state.error ? 1 : 0;

  return (
    <CollapsibleSection
      id="cong-chuyen-khoan"
      defaultOpen={initial.isEnabled}
      icon={<IconBank className="h-5 w-5" />}
      title="Chuyển khoản thủ công"
      description="Không có webhook — admin tự xác nhận hoá đơn đã thanh toán sau khi nhận được tiền."
      status={sectionStatus({ errorCount, dirty, empty: !initial.isEnabled, emptyLabel: configured ? "Đang tắt" : "Chưa cấu hình", okLabel: "Đang bật" })}
      errorCount={errorCount}
    >
      {/* React 19 tự reset form sau action, nhưng <select defaultValue> và trạng thái hiển thị của Toggle không theo
          giá trị mới từ server → key theo dữ liệu đã lưu để dựng lại form, khớp đúng DB sau mỗi lần lưu. */}
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
        <TextField id="manual-accountNo" label="Số tài khoản" name="accountNo" defaultValue={initial.accountNo} required />
        <TextField id="manual-accountName" label="Tên chủ tài khoản" name="accountName" defaultValue={initial.accountName} required />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? (state.message ?? "Đã lưu.") : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
      </form>
    </CollapsibleSection>
  );
}
