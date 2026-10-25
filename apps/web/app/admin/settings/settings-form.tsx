"use client";

import { useActionState } from "react";
import { updateSupportEmailAction, type SettingsActionState } from "./actions";
import { Badge, ConfigCard, FormBanner, PrimaryButton, TextField } from "../_ui/kit";
import { useFormDraft } from "../_ui/use-form-draft";
import { useUnsavedChanges } from "../_ui/unsaved-changes";
import { IconMail } from "../_ui/icons";

const initialState: SettingsActionState = {};

export interface SystemSettingsValues {
  supportEmail: string;
}

const FIELDS = ["supportEmail"] as const;

/** Task 1.13: lưu lỗi giữ địa chỉ đã nhập (`useFormDraft`) + badge và cảnh báo rời trang khi chưa lưu (ADR-058 mục 5). */
export function SettingsForm({ initial }: { initial: SystemSettingsValues }) {
  const [state, formAction, isPending] = useActionState(updateSupportEmailAction, initialState);
  const { dirty, formProps } = useFormDraft({ names: FIELDS, initial: { ...initial }, resetKey: initial.supportEmail, failed: Boolean(state.error) });
  useUnsavedChanges(dirty, "Email hỗ trợ có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");

  return (
    <form action={formAction} {...formProps}>
      <ConfigCard
        icon={<IconMail className="h-5 w-5" />}
        title="Email hỗ trợ"
        badges={dirty ? <Badge tone="warning">Có thay đổi chưa lưu</Badge> : undefined}
        description="Địa chỉ người dùng và người bán liên hệ khi cần hỗ trợ — áp dụng cho toàn hệ thống.">
        <TextField id="supportEmail" label="Email hỗ trợ" name="supportEmail" type="email" defaultValue={initial.supportEmail} required />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu email hỗ trợ"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
