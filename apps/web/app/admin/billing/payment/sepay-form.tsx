"use client";

import { useActionState } from "react";
import { saveSepayAction, type PlatformPaymentActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { IconBolt } from "../../_ui/icons";

const initialState: PlatformPaymentActionState = {};

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

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

  return (
    <form action={formAction}>
      <ConfigCard
        icon={<IconBolt className="h-5 w-5" />}
        title="SePay"
        badges={<Badge tone={initial.isEnabled ? "success" : "neutral"}>{initial.isEnabled ? "Đang bật" : "Đang tắt"}</Badge>}
        description="Xác nhận real-time qua webhook — không cần admin thao tác thủ công cho từng hoá đơn."
        toggle={<Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật" />}
        footer={
          <p className="text-xs" style={{ color: "#B45309" }}>
            Đổi số tài khoản hoặc secret sẽ tự tắt phương thức này — lưu lại lần nữa (đã tích &quot;Bật&quot;) để xác nhận.
          </p>
        }
      >
        <div className="rounded-lg border bg-gray-50 px-3.5 py-2.5 text-xs" style={{ borderColor: "#E5E7EB" }}>
          <span className="font-medium">Webhook URL</span> — dán vào trang quản trị SePay:
          <div className="mt-1 font-mono break-all text-[#0F3B82]">{webhookUrl}</div>
        </div>
        <SelectField id="sepay-bankBin" label="Ngân hàng" name="bankBin" defaultValue={initial.bankBin} required>
          <option value="">Chọn ngân hàng</option>
          {banks.map((bank) => (
            <option key={bank.bin} value={bank.bin}>
              {bank.shortName} — {bank.name}
            </option>
          ))}
        </SelectField>
        <TextField id="sepay-accountNo" label="Số tài khoản" name="accountNo" defaultValue={initial.accountNo} required />
        <TextField id="sepay-accountName" label="Tên chủ tài khoản" name="accountName" defaultValue={initial.accountName} required />
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
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : undefined}
        />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
