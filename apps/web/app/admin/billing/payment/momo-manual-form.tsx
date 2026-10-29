"use client";

import { useActionState } from "react";
import { saveMomoManualAction, type PlatformPaymentActionState } from "./actions";
import { FormBanner, MaskedTextField, PrimaryButton, TextField, Toggle } from "../../_ui/kit";
import { IconWallet } from "../../_ui/icons";
import { CollapsibleSection, sectionStatus } from "../../_ui/collapsible-section";
import { useFormDraft } from "../../_ui/use-form-draft";
import { useUnsavedChanges } from "../../_ui/unsaved-changes";

const initialState: PlatformPaymentActionState = {};
const FIELDS = ["isEnabled", "phone", "accountName"] as const;

/**
 * ADR-059 bổ sung lần 3 — "MoMo cá nhân (xác nhận tay)" của nền tảng (thu phí gói). Lần lưu đầu / đổi số điện thoại → tự tắt, lưu lại lần nữa để bật (ADR-013). Markup tối thiểu — Phong hoàn thiện.
 */
export function MomoManualForm({ initial }: { initial: { phone: string; accountName: string; isEnabled: boolean } }) {
  const [state, formAction, isPending] = useActionState(saveMomoManualAction, initialState);
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
      description="Gian hàng chuyển tiền vào ví MoMo với nội dung là mã hoá đơn — admin đối chiếu lịch sử ví rồi xác nhận hoá đơn."
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
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? (state.message ?? "Đã lưu.") : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
      </form>
    </CollapsibleSection>
  );
}
