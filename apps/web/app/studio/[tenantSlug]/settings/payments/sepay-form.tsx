"use client";

import { useActionState, useState, useTransition } from "react";
import { saveSepayAction, testSepayConnectionAction, type PaymentActionState } from "./actions";
import { brandColors } from "@gieochu/config/theme";
import { FormBanner, GhostButton, MaskedTextField, Notice, PasswordField, PrimaryButton, SelectField, TextField, Toggle } from "../../../../admin/_ui/kit";
import { IconBolt } from "../../../../admin/_ui/icons";
import { CopyValue } from "../../../../admin/_ui/copy-value";
import { SecretKeyField } from "../../../../admin/_ui/secret-key-field";
import { SEPAY_API_TOKEN_HINT, sepayPrefixHint, sepaySecretHint, sepaySetupSteps } from "../../../../../lib/sepay-setup";
import { CollapsibleSection, sectionStatus } from "../../../../admin/_ui/collapsible-section";
import { useFormDraft } from "../../../../admin/_ui/use-form-draft";
import { useUnsavedChanges } from "../../../../admin/_ui/unsaved-changes";

const initialState: PaymentActionState = {};
const FIELDS = ["isEnabled", "bankBin", "accountNo", "accountName", "paymentPrefix", "authType"] as const;
/** Không bao giờ ghi lại sau khi lưu lỗi — để trống = giữ secret/token đã lưu. */
const SECRET_FIELDS = ["secret", "apiToken"] as const;
const TEST_NOTE_ID = "sepay-test-note";

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
  // Gợi ý khi ô tiền tố trống/không hợp lệ: tiền tố đã lưu — page đã mặc định nó về tiền tố mã đơn của gian hàng.
  const fallbackPrefix = initial.paymentPrefix;
  const prefixValue = String(values.paymentPrefix ?? "");
  // Kết quả kiểm tra cũ không còn đúng khi form có thay đổi chưa lưu → xoá (điều chỉnh state trong render, không dùng effect).
  const [prevDirty, setPrevDirty] = useState(dirty);
  if (dirty !== prevDirty) {
    setPrevDirty(dirty);
    if (dirty) setTestResult(null);
  }
  // Server kiểm tra bằng User API (bắt buộc API Token đã lưu) trên cấu hình ĐÃ LƯU.
  const testBlockedReason = !initial.maskedApiToken
    ? "Nhập và lưu API Token để kiểm tra kết nối."
    : dirty || !configured
      ? "Lưu cấu hình trước khi kiểm tra kết nối."
      : null;

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
        <Notice tone="info">
          <p className="font-semibold">Cấu hình bên SePay (Công ty → Cấu hình chung)</p>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5">
            {sepaySetupSteps(prefixValue, fallbackPrefix).map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </Notice>
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
          hint={sepayPrefixHint(prefixValue, fallbackPrefix)}
          required
          minLength={2}
          maxLength={5}
          pattern="[A-Za-z]{2,5}"
          title="2–5 chữ cái không dấu (A–Z)"
          autoCapitalize="characters"
          spellCheck={false}
          autoComplete="off"
        />
        <SelectField id="sepay-authType" label="Kiểu xác thực" name="authType" defaultValue={initial.authType || "HMAC_SHA256"}>
          <option value="HMAC_SHA256">HMAC-SHA256 (khuyến nghị)</option>
          <option value="API_KEY">API Key</option>
        </SelectField>
        <SecretKeyField
          id="sepay-secret"
          label="Secret / API key"
          name="secret"
          hasSaved={Boolean(initial.maskedSecret)}
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
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? (state.message ?? "Đã lưu.") : undefined)} />
        <div className="flex flex-wrap items-center gap-3">
          <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
          <GhostButton
            loading={isTesting}
            disabled={testBlockedReason !== null}
            aria-describedby={testBlockedReason ? TEST_NOTE_ID : undefined}
            onClick={() => {
              setTestResult(null);
              startTest(async () => {
                const result = await testSepayConnectionAction(tenantSlug);
                setTestResult(result.testResult ?? null);
              });
            }}
          >
            {isTesting ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
          </GhostButton>
          {testBlockedReason ? (
            <span id={TEST_NOTE_ID} className="text-xs text-gray-600">
              {testBlockedReason}
            </span>
          ) : null}
        </div>
        {testResult ? <FormBanner ok={testResult.ok} message={testResult.message ?? (testResult.ok ? "Kết nối thành công." : "Kết nối thất bại.")} /> : null}
        <p className="border-t pt-4 text-xs" style={{ color: brandColors.inkSoft, borderColor: "#E5E7EB" }}>
          Kiểm tra kết nối thành công sẽ tự bật phương thức này.
        </p>
      </form>
    </CollapsibleSection>
  );
}
