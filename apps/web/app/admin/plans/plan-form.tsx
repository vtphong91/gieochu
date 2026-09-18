"use client";

import { useActionState } from "react";
import type { PlanActionState } from "./actions";

const initialState: PlanActionState = {};

const FEATURE_LABELS: Record<string, string> = {
  coupons: "Mã giảm giá",
  advancedAnalytics: "Thống kê nâng cao",
  advancedBranding: "Thương hiệu nâng cao",
  seoTools: "Công cụ SEO",
  automation: "Tự động hoá",
  customDomain: "Tên miền riêng",
};

export interface PlanFormValues {
  code: string;
  name: string;
  priceVnd: number;
  interval: "MONTH" | "YEAR";
  intervalCount: number;
  maxProducts: number;
  storageMb: number;
  maxFileMb: number;
  isFree: boolean;
  features: Record<string, boolean>;
}

export function PlanForm({
  action,
  initial,
  submitLabel,
}: {
  action: (state: PlanActionState, formData: FormData) => Promise<PlanActionState>;
  initial: PlanFormValues;
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-6 grid grid-cols-2 gap-3 rounded border p-4 sm:grid-cols-4">
      <input name="code" defaultValue={initial.code} placeholder="Mã gói (VD: PRO)" required className="rounded border px-3 py-2" />
      <input name="name" defaultValue={initial.name} placeholder="Tên gói" required className="rounded border px-3 py-2" />
      <input name="priceVnd" type="number" defaultValue={initial.priceVnd} placeholder="Giá (VNĐ)" required className="rounded border px-3 py-2" />
      <select name="interval" defaultValue={initial.interval} className="rounded border px-3 py-2">
        <option value="MONTH">Tháng</option>
        <option value="YEAR">Năm</option>
      </select>
      <input
        name="intervalCount"
        type="number"
        defaultValue={initial.intervalCount}
        placeholder="Số chu kỳ"
        required
        className="rounded border px-3 py-2"
      />
      <input
        name="maxProducts"
        type="number"
        defaultValue={initial.maxProducts}
        placeholder="Giới hạn sản phẩm"
        required
        className="rounded border px-3 py-2"
      />
      <input name="storageMb" type="number" defaultValue={initial.storageMb} placeholder="Dung lượng (MB)" required className="rounded border px-3 py-2" />
      <input
        name="maxFileMb"
        type="number"
        defaultValue={initial.maxFileMb}
        placeholder="Kích thước file tối đa (MB)"
        required
        className="rounded border px-3 py-2"
      />

      <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-4">
        <input type="checkbox" name="isFree" defaultChecked={initial.isFree} />
        Gói Free — gán tự động cho tenant mới, không bao giờ hết hạn (chỉ được 1 gói Free đang bật)
      </label>

      <fieldset className="col-span-2 grid grid-cols-2 gap-2 rounded border p-3 text-sm sm:col-span-4 sm:grid-cols-3">
        <legend className="px-1 text-xs text-gray-500">Tính năng</legend>
        {Object.entries(FEATURE_LABELS).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2">
            <input type="checkbox" name={`feature_${key}`} defaultChecked={initial.features[key] === true} />
            {label}
          </label>
        ))}
      </fieldset>

      <button
        type="submit"
        disabled={isPending}
        className="col-span-2 rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50 sm:col-span-4"
      >
        {isPending ? "Đang lưu..." : submitLabel}
      </button>
      {state.error ? <p className="col-span-2 text-sm text-red-600 sm:col-span-4">{state.error}</p> : null}
    </form>
  );
}
