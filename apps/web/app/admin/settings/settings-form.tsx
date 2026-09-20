"use client";

import { useActionState } from "react";
import { updateSystemSettingsAction, type SettingsActionState } from "./actions";
import { ConfigCard, FormBanner, PrimaryButton, TextField } from "../_ui/kit";
import { IconGear } from "../_ui/icons";

const initialState: SettingsActionState = {};

export interface SystemSettingsValues {
  platformName: string;
  supportEmail: string;
  trialDays: number;
  graceDays: number;
}

export function SettingsForm({ initial }: { initial: SystemSettingsValues }) {
  const [state, formAction, isPending] = useActionState(updateSystemSettingsAction, initialState);

  return (
    <form action={formAction}>
      <ConfigCard icon={<IconGear className="h-5 w-5" />} title="Thông tin nền tảng & thời hạn" description="Áp dụng cho toàn bộ tenant trên hệ thống.">
        <TextField id="platformName" label="Tên nền tảng" name="platformName" defaultValue={initial.platformName} required />
        <TextField id="supportEmail" label="Email hỗ trợ" name="supportEmail" type="email" defaultValue={initial.supportEmail} required />
        <div className="grid grid-cols-2 gap-4">
          <TextField id="trialDays" label="Số ngày dùng thử" name="trialDays" type="number" defaultValue={initial.trialDays} required />
          <TextField id="graceDays" label="Số ngày gia hạn (grace)" name="graceDays" type="number" defaultValue={initial.graceDays} required />
        </div>
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu cấu hình"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
