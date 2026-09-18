"use client";

import { useActionState } from "react";
import { updateSystemSettingsAction, type SettingsActionState } from "./actions";

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
    <form action={formAction} className="mt-6 space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="platformName">
          Tên nền tảng
        </label>
        <input
          id="platformName"
          name="platformName"
          defaultValue={initial.platformName}
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="supportEmail">
          Email hỗ trợ
        </label>
        <input
          id="supportEmail"
          name="supportEmail"
          type="email"
          defaultValue={initial.supportEmail}
          required
          className="mt-1 w-full rounded border px-3 py-2"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="trialDays">
            Số ngày dùng thử
          </label>
          <input
            id="trialDays"
            name="trialDays"
            type="number"
            defaultValue={initial.trialDays}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="graceDays">
            Số ngày gia hạn (grace)
          </label>
          <input
            id="graceDays"
            name="graceDays"
            type="number"
            defaultValue={initial.graceDays}
            required
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Đã lưu.</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "Đang lưu..." : "Lưu cấu hình"}
      </button>
    </form>
  );
}
