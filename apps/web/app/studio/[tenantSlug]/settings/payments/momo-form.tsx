"use client";

import { useActionState } from "react";
import { saveMomoAction, type PaymentActionState } from "./actions";
import { FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../../../../admin/_ui/kit";
import { IconWallet } from "../../../../admin/_ui/icons";
import { CollapsibleSection, sectionStatus } from "../../../../admin/_ui/collapsible-section";
import { useFormDraft } from "../../../../admin/_ui/use-form-draft";
import { useUnsavedChanges } from "../../../../admin/_ui/unsaved-changes";

const initialState: PaymentActionState = {};
const FIELDS = ["isEnabled", "partnerCode", "accessKey", "environment"] as const;
/** Không bao giờ ghi lại sau khi lưu lỗi — để trống = giữ secret key đã lưu. */
const SECRET_FIELDS = ["secretKey"] as const;

/**
 * ADR-058 (task 2.2): khối thu gọn — cổng đang bật thì mở sẵn. Khối nằm NGOÀI `<form key>` để trạng thái mở và thông báo
 * không mất khi form dựng lại sau lần lưu (kể cả khi tự tắt do đổi partner code/secret). Lưu lỗi giữ giá trị trừ secret.
 */
export function MomoForm({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial: { partnerCode: string; accessKey: string; environment: string; isEnabled: boolean; maskedSecret?: string };
}) {
  const action = saveMomoAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formKey = JSON.stringify(initial);
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
      description="Ví điện tử MoMo — xác nhận tự động qua API chính thức."
      status={sectionStatus({ errorCount, dirty, empty: !initial.isEnabled, emptyLabel: configured ? "Đang tắt" : "Chưa cấu hình", okLabel: "Đang bật" })}
      errorCount={errorCount}
    >
      {/* React 19 tự reset form sau action, nhưng <select defaultValue> và trạng thái hiển thị của Toggle không theo giá
          trị mới từ server → key theo dữ liệu đã lưu để dựng lại form, khớp đúng DB sau mỗi lần lưu. */}
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
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
        <p className="border-t pt-4 text-xs" style={{ color: "#B45309", borderColor: "#E5E7EB" }}>
          Đổi partner code hoặc secret key sẽ tự tắt phương thức này — lưu lại lần nữa (đã tích &quot;Bật&quot;) để xác nhận.
        </p>
      </form>
    </CollapsibleSection>
  );
}
