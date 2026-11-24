"use client";

import { useActionState, useState, useTransition } from "react";
import { saveSepayAction, testSepayConnectionAction, type PaymentActionState } from "./actions";
import { FormBanner, GhostButton, MaskedTextField, PasswordField, PrimaryButton, SelectField, TextField, Toggle } from "../../../../admin/_ui/kit";
import { IconBolt } from "../../../../admin/_ui/icons";
import { CopyValue } from "../../../../admin/_ui/copy-value";
import { SecretKeyField, sepaySecretHint, SEPAY_API_TOKEN_HINT } from "../../../../admin/_ui/secret-key-field";
import { CollapsibleSection, sectionStatus } from "../../../../admin/_ui/collapsible-section";
import { useFormDraft } from "../../../../admin/_ui/use-form-draft";
import { useUnsavedChanges } from "../../../../admin/_ui/unsaved-changes";

const initialState: PaymentActionState = {};
const FIELDS = ["isEnabled", "bankBin", "accountNo", "accountName", "paymentPrefix", "authType"] as const;
/** Không bao giờ ghi lại sau khi lưu lỗi — để trống = giữ secret/token đã lưu. */
const SECRET_FIELDS = ["secret", "apiToken"] as const;

interface BankOption {
  bin: string;
  shortName: string;
  name: string;
}

/**
 * ADR-058 (task 2.2): khối thu gọn — cổng đang bật thì mở sẵn. Khối nằm NGOÀI `<form key>` để trạng thái mở và thông báo
 * không mất khi form dựng lại sau lần lưu (kể cả khi tự tắt do đổi tài khoản/secret). Lưu lỗi giữ giá trị trừ secret.
 * "Kiểm tra kết nối" chạy trên cấu hình ĐÃ LƯU (User API SePay + API Token) — thành công tự bật cổng.
 */
export function SepayForm({
  tenantSlug,
  banks,
  webhookUrl,
  initial,
}: {
  tenantSlug: string;
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
    maskedApiToken?: string;
    lastVerifiedAt: string | null;
  };
}) {
  const action = saveSepayAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isTesting, startTest] = useTransition();
  // `lastVerifiedAt` đổi khi bấm "Kiểm tra kết nối" — không đưa vào key để không dựng lại form vì lý do đó.
  const formKey = JSON.stringify({ ...initial, lastVerifiedAt: null });
  const { dirty, values, formProps } = useFormDraft({
    names: FIELDS,
    secretNames: SECRET_FIELDS,
    // Khớp `defaultValue` từng ô (authType có giá trị mặc định khi chưa cấu hình).
    initial: {
      isEnabled: initial.isEnabled,
      bankBin: initial.bankBin,
      accountNo: initial.accountNo,
      accountName: initial.accountName,
      paymentPrefix: initial.paymentPrefix,
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
      description={
        initial.lastVerifiedAt
          ? `Đã xác minh — kiểm tra kết nối thành công lúc ${initial.lastVerifiedAt}.`
          : "Xác nhận real-time qua webhook — không cần bạn thao tác thủ công cho từng đơn."
      }
      status={sectionStatus({ errorCount, dirty, empty: !initial.isEnabled, emptyLabel: configured ? "Đang tắt" : "Chưa cấu hình", okLabel: "Đang bật" })}
      errorCount={errorCount}
    >
      {/* React 19 tự reset form sau action, nhưng <select defaultValue> và trạng thái hiển thị của Toggle không theo giá
          trị mới từ server → key theo dữ liệu đã lưu để dựng lại form, khớp đúng DB sau mỗi lần lưu. */}
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
          label="Tiền tố mã thanh toán"
          name="paymentPrefix"
          defaultValue={initial.paymentPrefix}
          placeholder="VD: HAN"
          required
          maxLength={4}
        />
        <SelectField id="sepay-authType" label="Kiểu xác thực" name="authType" defaultValue={initial.authType || "HMAC_SHA256"}>
          <option value="HMAC_SHA256">HMAC-SHA256 (khuyến nghị)</option>
          <option value="API_KEY">API Key</option>
        </SelectField>
        <SecretKeyField
          id="sepay-secret"
          label="Secret / API key"
          name="secret"
          hint={sepaySecretHint(String(values.authType ?? "HMAC_SHA256"))}
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : "Nhập hoặc bấm “Tạo key ngẫu nhiên”"}
        />
        <PasswordField
          id="sepay-apiToken"
          label="API Token (để kiểm tra kết nối)"
          name="apiToken"
          hint={SEPAY_API_TOKEN_HINT}
          placeholder={initial.maskedApiToken ? `Token hiện tại: ${initial.maskedApiToken} — để trống nếu giữ nguyên` : "Không bắt buộc"}
        />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        {state.warning ? (
          <p role="alert" className="rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-2.5 text-xs text-amber-900">
            {state.warning}
          </p>
        ) : null}
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
          <GhostButton
            disabled={isTesting || dirty || !configured}
            aria-describedby={dirty ? "sepay-test-note" : undefined}
            onClick={() =>
              startTest(async () => {
                const result = await testSepayConnectionAction(tenantSlug);
                setTestResult(result.testResult ?? null);
              })
            }
          >
            {isTesting ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
          </GhostButton>
          {dirty ? (
            <span id="sepay-test-note" className="text-xs text-gray-500">
              Lưu cấu hình trước khi kiểm tra kết nối.
            </span>
          ) : null}
        </div>
        {testResult ? <FormBanner ok={testResult.ok} message={testResult.message ?? (testResult.ok ? "Kết nối thành công." : "Kết nối thất bại.")} /> : null}
        <p className="border-t pt-4 text-xs" style={{ color: "#B45309", borderColor: "#E5E7EB" }}>
          Kiểm tra kết nối thành công sẽ tự bật phương thức này.
        </p>
      </form>
    </CollapsibleSection>
  );
}
