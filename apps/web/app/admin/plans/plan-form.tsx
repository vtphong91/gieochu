"use client";

import { useActionState } from "react";
import type { PlanActionState } from "./actions";
import { ConfigCard, FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../_ui/kit";
import { IconPackage } from "../_ui/icons";

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
  imageStorageMb: number;
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
    <form action={formAction}>
      <ConfigCard icon={<IconPackage className="h-5 w-5" />} title="Thông tin gói" description="Số liệu ở đây điều khiển giới hạn thật của tenant dùng gói này.">
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="plan-code" label="Mã gói" name="code" defaultValue={initial.code} placeholder="VD: PRO" required />
          <TextField id="plan-name" label="Tên gói" name="name" defaultValue={initial.name} required />
          <TextField id="plan-priceVnd" label="Giá (VNĐ)" name="priceVnd" type="number" defaultValue={initial.priceVnd} required />
          <SelectField id="plan-interval" label="Chu kỳ" name="interval" defaultValue={initial.interval}>
            <option value="MONTH">Tháng</option>
            <option value="YEAR">Năm</option>
          </SelectField>
          <TextField id="plan-intervalCount" label="Số chu kỳ" name="intervalCount" type="number" defaultValue={initial.intervalCount} required />
          <TextField id="plan-maxProducts" label="Giới hạn sản phẩm" name="maxProducts" type="number" defaultValue={initial.maxProducts} required />
          <TextField id="plan-storageMb" label="Dung lượng (MB)" name="storageMb" type="number" defaultValue={initial.storageMb} required />
          <TextField id="plan-maxFileMb" label="Kích thước file tối đa (MB)" name="maxFileMb" type="number" defaultValue={initial.maxFileMb} required />
          <TextField id="plan-imageStorageMb" label="Dung lượng ảnh (MB)" name="imageStorageMb" type="number" defaultValue={initial.imageStorageMb} required />
        </div>

        <div className="rounded-lg border bg-gray-50 px-3.5 py-3" style={{ borderColor: "#E5E7EB" }}>
          <Toggle name="isFree" defaultChecked={initial.isFree} label="Gói Free — gán tự động cho tenant mới, không bao giờ hết hạn" />
          <p className="mt-1 pl-[52px] text-xs text-gray-500">Chỉ được 1 gói Free đang bật tại một thời điểm.</p>
        </div>

        <fieldset className="rounded-lg border p-3.5" style={{ borderColor: "#E5E7EB" }}>
          <legend className="px-1 text-xs font-medium text-gray-500">Tính năng</legend>
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
            {Object.entries(FEATURE_LABELS).map(([key, label]) => (
              <label key={key} className="flex items-center gap-2.5 text-sm">
                <input type="checkbox" name={`feature_${key}`} defaultChecked={initial.features[key] === true} className="h-4 w-4 rounded" />
                {label}
              </label>
            ))}
          </div>
        </fieldset>

        <FormBanner ok={false} message={state.error} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : submitLabel}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
