"use client";

import { useActionState, useState, useTransition } from "react";
import { saveMomoAction, testMomoConnectionAction, type PlatformPaymentActionState } from "./actions";
import { FormBanner, GhostButton, PrimaryButton, SelectField, TextField, Toggle } from "../../_ui/kit";
import { IconWallet } from "../../_ui/icons";
import { CollapsibleSection, sectionStatus } from "../../_ui/collapsible-section";
import { useFormDraft } from "../../_ui/use-form-draft";
import { useUnsavedChanges } from "../../_ui/unsaved-changes";

const initialState: PlatformPaymentActionState = {};
const FIELDS = ["isEnabled", "partnerCode", "accessKey", "environment"] as const;
/** Không bao giờ ghi lại sau khi lưu lỗi — để trống = giữ secret key đã lưu. */
const SECRET_FIELDS = ["secretKey"] as const;

/**
 * ADR-058 (task 1.11): khối thu gọn — cổng đang bật thì mở sẵn. Khối nằm NGOÀI `<form key>` để trạng thái mở và thông báo
 * (kể cả thông báo tự tắt ADR-013) không mất khi form dựng lại sau lần lưu. Lưu lỗi giữ giá trị đã nhập trừ secret key.
 */
export function MomoForm({
  initial,
}: {
  initial: { partnerCode: string; accessKey: string; environment: string; isEnabled: boolean; maskedSecret?: string; lastVerifiedAt: string | null };
}) {
  const [state, formAction, isPending] = useActionState(saveMomoAction, initialState);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string } | null>(null);
  const [isTesting, startTest] = useTransition();
  // `lastVerifiedAt` đổi khi bấm "Kiểm tra kết nối" — không đưa vào key để không xoá dữ liệu admin đang gõ dở.
  const formKey = JSON.stringify({ ...initial, lastVerifiedAt: null });
  const { dirty, formProps } = useFormDraft({
    names: FIELDS,
    secretNames: SECRET_FIELDS,
    initial: {
      isEnabled: initial.isEnabled,
      partnerCode: initial.partnerCode,
      accessKey: initial.accessKey,
      environment: initial.environment || "sandbox",
    },
    resetKey: formKey,
    failed: Boolean(state.error),
  });
  useUnsavedChanges(dirty, "Cấu hình MoMo có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");
  const configured = initial.partnerCode.trim() !== "" || Boolean(initial.maskedSecret);
  const errorCount = state.error ? 1 : 0;

  return (
    <CollapsibleSection
      id="cong-momo"
      defaultOpen={initial.isEnabled}
      icon={<IconWallet className="h-5 w-5" />}
      title="MoMo"
      description={initial.lastVerifiedAt ? `Đã xác minh — kiểm tra kết nối thành công lúc ${initial.lastVerifiedAt}.` : "Ví điện tử MoMo — xác nhận tự động qua API chính thức."}
      status={sectionStatus({ errorCount, dirty, empty: !initial.isEnabled, emptyLabel: configured ? "Đang tắt" : "Chưa cấu hình", okLabel: "Đang bật" })}
      errorCount={errorCount}
    >
      {/* React 19 tự reset form sau action, nhưng <select defaultValue> và trạng thái hiển thị của Toggle không theo
          giá trị mới từ server → key theo dữ liệu đã lưu để dựng lại form, khớp đúng DB sau mỗi lần lưu. */}
      <form key={formKey} action={formAction} className="space-y-4" {...formProps}>
        <Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật phương thức này" />
        <TextField id="momo-partnerCode" label="Partner Code" name="partnerCode" defaultValue={initial.partnerCode} required autoComplete="off" />
        <TextField id="momo-accessKey" label="Access Key" name="accessKey" defaultValue={initial.accessKey} required autoComplete="off" />
        <SelectField id="momo-environment" label="Môi trường" name="environment" defaultValue={initial.environment || "sandbox"}>
          <option value="sandbox">Sandbox (thử nghiệm)</option>
          <option value="production">Production</option>
        </SelectField>
        <TextField
          id="momo-secretKey"
          label="Secret Key"
          name="secretKey"
          type="password"
          autoComplete="new-password"
          placeholder={initial.maskedSecret ? `Secret hiện tại: ${initial.maskedSecret} — để trống nếu giữ nguyên` : undefined}
        />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? (state.message ?? "Đã lưu.") : undefined)} />
        <div className="flex flex-wrap gap-3">
          <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
          <GhostButton
            disabled={isTesting}
            onClick={() =>
              startTest(async () => {
                const result = await testMomoConnectionAction();
                setTestResult(result.testResult ?? null);
              })
            }
          >
            {isTesting ? "Đang kiểm tra..." : "Kiểm tra kết nối"}
          </GhostButton>
        </div>
        {testResult ? <FormBanner ok={testResult.ok} message={testResult.ok ? "Kết nối thành công." : (testResult.message ?? "Kết nối thất bại.")} /> : null}
        <p className="border-t pt-4 text-xs" style={{ color: "#B45309", borderColor: "#E5E7EB" }}>
          Đổi partner code hoặc secret key sẽ tự tắt phương thức này — lưu lại lần nữa (đã tích &quot;Bật&quot;) để xác nhận.
        </p>
      </form>
    </CollapsibleSection>
  );
}
