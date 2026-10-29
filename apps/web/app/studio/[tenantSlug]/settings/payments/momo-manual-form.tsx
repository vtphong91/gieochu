"use client";

import { useActionState } from "react";
import { saveMomoManualAction, type PaymentActionState } from "./actions";
import { FormBanner, MaskedTextField, PrimaryButton, TextField, Toggle } from "../../../../admin/_ui/kit";
import { IconWallet } from "../../../../admin/_ui/icons";
import { CollapsibleSection, sectionStatus } from "../../../../admin/_ui/collapsible-section";
import { useFormDraft } from "../../../../admin/_ui/use-form-draft";
import { useUnsavedChanges } from "../../../../admin/_ui/unsaved-changes";

const initialState: PaymentActionState = {};
const FIELDS = ["isEnabled", "phone", "accountName"] as const;

/**
 * ADR-059 bổ sung lần 3 — khối thu gọn "MoMo cá nhân (xác nhận tay)" của gian hàng. Cùng khung với các cổng khác (ADR-058):
 * khối nằm ngoài `<form key>`, form dựng lại theo dữ liệu đã lưu. Markup tối thiểu — Phong hoàn thiện.
 */
export function MomoManualForm({
  tenantSlug,
  initial,
}: {
  tenantSlug: string;
  initial: { phone: string; accountName: string; isEnabled: boolean };
}) {
  const action = saveMomoManualAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);
  const formKey = JSON.stringify(initial);
  const { dirty, formProps } = useFormDraft({ names: FIELDS, initial, resetKey: formKey, failed: Boolean(state.error) });
  useUnsavedChanges(dirty, "Cấu hình MoMo cá nhân có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");
  const configured = initial.phone.trim() !== "";
  const errorCount = state.error ? 1 : 0;

  return (
    <CollapsibleSection
      id="cong-momo-ca-nhan"
      defaultOpen={initial.isEnabled}
      icon={<IconWallet className="h-5 w-5" />}
      title="MoMo cá nhân (xác nhận thủ công)"
      description="Khách chuyển tiền vào ví MoMo của bạn với nội dung là mã đơn — bạn đối chiếu lịch sử ví rồi xác nhận đơn."
      status={sectionStatus({ errorCount, dirty, empty: !initial.isEnabled, emptyLabel: configured ? "Đang tắt" : "Chưa cấu hình", okLabel: "Đang bật" })}
      errorCount={errorCount}
    >
      <form key={formKey} action={formAction} className="space-y-4" {...formProps}>
        <Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật phương thức này" />
        <MaskedTextField id="momo-manual-phone" label="Số điện thoại MoMo" name="phone" defaultValue={initial.phone} required inputMode="tel" />
        <TextField
          id="momo-manual-accountName"
          label="Tên chủ ví"
          name="accountName"
          defaultValue={initial.accountName}
          hint="Viết như trên ví (hệ thống tự đổi thành chữ HOA không dấu)."
          required
        />
        <p className="text-xs text-gray-600">
          Số điện thoại và tên chủ ví sẽ hiện công khai cho khách ở trang thanh toán.
        </p>
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu"}</PrimaryButton>
      </form>
    </CollapsibleSection>
  );
}
