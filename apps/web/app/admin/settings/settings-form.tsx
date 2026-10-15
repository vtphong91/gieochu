"use client";

import { useActionState } from "react";
import { updateSupportEmailAction, type SettingsActionState } from "./actions";
import { ConfigCard, FormBanner, PrimaryButton, TextField } from "../_ui/kit";
import { IconMail } from "../_ui/icons";

const initialState: SettingsActionState = {};

export interface SystemSettingsValues {
  supportEmail: string;
}

export function SettingsForm({ initial }: { initial: SystemSettingsValues }) {
  const [state, formAction, isPending] = useActionState(updateSupportEmailAction, initialState);

  return (
    <form action={formAction}>
      <ConfigCard icon={<IconMail className="h-5 w-5" />} title="Email hỗ trợ" description="Địa chỉ người dùng và người bán liên hệ khi cần hỗ trợ — áp dụng cho toàn hệ thống.">
        <TextField id="supportEmail" label="Email hỗ trợ" name="supportEmail" type="email" defaultValue={initial.supportEmail} required />
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu email hỗ trợ"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
