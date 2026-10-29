"use client";

import { useActionState } from "react";
import { saveSepayAction, type PlatformPaymentActionState } from "./actions";
import { FormBanner, MaskedTextField, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { IconBolt } from "../../_ui/icons";
import { CopyValue } from "../../_ui/copy-value";
import { CollapsibleSection, sectionStatus } from "../../_ui/collapsible-section";
import { useFormDraft } from "../../_ui/use-form-draft";
import { useUnsavedChanges } from "../../_ui/unsaved-changes";

const initialState: PlatformPaymentActionState = {};
const FIELDS = ["isEnabled", "bankBin", "accountNo", "accountName", "paymentPrefix", "authType"] as const;
/** Không bao giờ ghi lại sau khi lưu lỗi — để trống = giữ secret đã lưu. */
const SECRET_FIELDS = ["secret"] as const;

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

/**
 * ADR-058 (task 1.11): khối thu gọn — cổng đang bật thì mở sẵn. Khối nằm NGOÀI `<form key>` để trạng thái mở và thông báo
 * (kể cả thông báo tự tắt ADR-013) không mất khi form dựng lại sau lần lưu. Lưu lỗi giữ giá trị đã nhập trừ secret.
 */
export function SepayForm({
  banks,
  webhookUrl,
  initial,
}: {
  banks: BankOption[];
  webhookUrl: string;
  initial: {
    bankBin: string;
    accountNo: string;
    accountName: string;
    authType: string;
    paymentPrefix: string;
    isEnabled: boolean;
    maskedSecret?: string;
  };
}) {
  const [state, formAction, isPending] = useActionState(saveSepayAction, initialState);
  const formKey = JSON.stringify(initial);
  const { dirty, formProps } = useFormDraft({
    names: FIELDS,
    secretNames: SECRET_FIELDS,
    // Khớp `defaultValue` của từng ô (prefix/authType có giá trị mặc định khi chưa cấu hình).
    initial: {
      isEnabled: initial.isEnabled,
      bankBin: initial.bankBin,
      accountNo: initial.accountNo,
      accountName: initial.accountName,
      paymentPrefix: initial.paymentPrefix || "SUB",
      authType: initial.authType || "HMAC_SHA256",
    },
    resetKey: formKey,
    failed: Boolean(state.error),
  });
  useUnsavedChanges(dirty, "Cấu hình SePay có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");
  const configured = initial.accountNo.trim() !== "" || Boolean(initial.maskedSecret);
  const errorCount = state.error ? 1 : 0;

  return (
    <CollapsibleSection
      id="cong-sepay"
      defaultOpen={initial.isEnabled}
      icon={<IconBolt className="h-5 w-5" />}
      title="SePay"
      description="Xác nhận real-time qua webhook — không cần admin thao tác thủ công cho từng hoá đơn."
      status={sectionStatus({ errorCount, dirty, empty: !initial.isEnabled, emptyLabel: configured ? "Đang tắt" : "Chưa cấu hình", okLabel: "Đang bật" })}
      errorCount={errorCount}
    >
      {/* React 19 tự reset form sau action, nhưng <select defaultValue> và trạng thái hiển thị của Toggle không theo
          giá trị mới từ server → key theo dữ liệu đã lưu để dựng lại form, khớp đúng DB sau mỗi lần lưu. */}
      <form key={formKey} action={formAction} className="space-y-4" {...formProps}>
        <Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật phương thức này" />
        <div className="rounded-lg border bg-gray-50 px-3.5 py-2.5 text-xs" style={{ borderColor: "#E5E7EB" }}>
          <span className="font-medium">Webhook URL</span> — dán vào trang quản trị SePay:
          <CopyValue value={webhookUrl} label="Webhook URL" />
        </div>
        <SelectField id="sepay-bankBin" label="Ngân hàng" name="bankBin" defaultValue={initial.bankBin} required>
          <option value="">Chọn ngân hàng</option>
          {banks.map((bank) => (
            <option key={bank.bin} value={bank.bin}>
              {bank.shortName} — {bank.name}
            </option>
          ))}
        </SelectField>
        <MaskedTextField id="sepay-accountNo" label="Số tài khoản" name="accountNo" defaultValue={initial.accountNo} required />
        <TextField id="sepay-accountName" label="Tên chủ tài khoản" name="accountName" defaultValue={initial.accountName} required autoComplete="off" />
        <TextField
          id="sepay-paymentPrefix"
          label="Tiền tố mã hoá đơn"
          name="paymentPrefix"
          defaultValue={initial.paymentPrefix || "SUB"}
          hint="Gắn vào mỗi hoá đơn (VD: SUB7F3K2M1Q) để SePay đối chiếu đúng mã."
          required
          maxLength={6}
        />
        <SelectField id="sepay-authType" label="Kiểu xác thực" name="authType" defaultValue={initial.authType || "HMAC_SHA256"}>
          <option value="HMAC_SHA256">HMAC-SHA256 (khuyến nghị)</option>
          <option value="API_KEY">API Key</option>
        </SelectField>
        <TextField
          id="sepay-secret"
          label="Secret / API key"
          name="secret"
          type="password"
          autoComplete="new-password"
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : undefined}
        />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? (state.message ?? "Đã lưu.") : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
        <p className="border-t pt-4 text-xs" style={{ color: "#B45309", borderColor: "#E5E7EB" }}>
          Đổi số tài khoản hoặc secret sẽ tự tắt phương thức này — lưu lại lần nữa (đã tích &quot;Bật&quot;) để xác nhận.
        </p>
      </form>
    </CollapsibleSection>
  );
}
