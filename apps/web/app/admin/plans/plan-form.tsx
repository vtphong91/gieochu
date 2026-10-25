"use client";

import { useActionState } from "react";
import type { PlanActionState } from "./actions";
import { FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../_ui/kit";
import { IconDatabase, IconPackage, IconTag } from "../_ui/icons";
import { CollapsibleSection, sectionStatus } from "../_ui/collapsible-section";
import { useFormDraft, type FormDraftValues } from "../_ui/use-form-draft";
import { useUnsavedChanges } from "../_ui/unsaved-changes";

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

const INFO_FIELDS = ["code", "name", "priceVnd", "interval", "intervalCount"] as const;
const LIMIT_FIELDS = ["maxProducts", "storageMb", "maxFileMb", "imageStorageMb"] as const;
const FEATURE_FIELDS = ["isFree", ...Object.keys(FEATURE_LABELS).map((key) => `feature_${key}`)];
const ALL_FIELDS = [...INFO_FIELDS, ...LIMIT_FIELDS, ...FEATURE_FIELDS];

/** Giá trị đã lưu theo đúng dạng ô form đọc ra (số → chuỗi, checkbox → boolean) để so "có thay đổi". */
function toDraft(initial: PlanFormValues): FormDraftValues {
  const draft: FormDraftValues = {
    code: initial.code,
    name: initial.name,
    priceVnd: String(initial.priceVnd),
    interval: initial.interval,
    intervalCount: String(initial.intervalCount),
    maxProducts: String(initial.maxProducts),
    storageMb: String(initial.storageMb),
    maxFileMb: String(initial.maxFileMb),
    imageStorageMb: String(initial.imageStorageMb),
    isFree: initial.isFree,
  };
  for (const key of Object.keys(FEATURE_LABELS)) draft[`feature_${key}`] = initial.features[key] === true;
  return draft;
}

/**
 * ADR-058 (task 1.12a): 3 khối thu gọn — Thông tin gói mở; Giới hạn sử dụng + Gói Free & tính năng thu gọn khi SỬA.
 * Khi TẠO gói mới (`expandAll`) mở cả 3: giới hạn mặc định 0 = "không được phép", ẩn đi dễ tạo nhầm gói không dùng được.
 * Lưu lỗi giữ giá trị đã nhập (`useFormDraft`), cảnh báo rời trang khi chưa lưu. Không đổi action.
 */
export function PlanForm({
  action,
  initial,
  submitLabel,
  expandAll = false,
}: {
  action: (state: PlanActionState, formData: FormData) => Promise<PlanActionState>;
  initial: PlanFormValues;
  submitLabel: string;
  /** Mở sẵn mọi khối (trang tạo gói mới). */
  expandAll?: boolean;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { dirty, dirtyOf, formProps } = useFormDraft({
    names: ALL_FIELDS,
    initial: toDraft(initial),
    resetKey: JSON.stringify(initial),
    failed: Boolean(state.error),
  });
  useUnsavedChanges(dirty, "Gói dịch vụ có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");

  return (
    <form action={formAction} className="space-y-4" {...formProps}>
      <CollapsibleSection
        id="goi-thong-tin"
        defaultOpen
        icon={<IconPackage className="h-5 w-5" />}
        title="Thông tin gói"
        description="Mã, tên, giá và chu kỳ thanh toán."
        status={sectionStatus({ dirty: dirtyOf(INFO_FIELDS) })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="plan-code" label="Mã gói" name="code" defaultValue={initial.code} placeholder="VD: PRO" required />
          <TextField id="plan-name" label="Tên gói" name="name" defaultValue={initial.name} required />
          <TextField id="plan-priceVnd" label="Giá (VNĐ)" name="priceVnd" type="number" defaultValue={initial.priceVnd} required />
          <SelectField id="plan-interval" label="Chu kỳ" name="interval" defaultValue={initial.interval}>
            <option value="MONTH">Tháng</option>
            <option value="YEAR">Năm</option>
          </SelectField>
          <TextField id="plan-intervalCount" label="Số chu kỳ" name="intervalCount" type="number" defaultValue={initial.intervalCount} required />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="goi-gioi-han"
        defaultOpen={expandAll}
        icon={<IconDatabase className="h-5 w-5" />}
        title="Giới hạn sử dụng"
        description="Số liệu ở đây điều khiển giới hạn thật của tenant dùng gói này."
        status={sectionStatus({ dirty: dirtyOf(LIMIT_FIELDS) })}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="plan-maxProducts" label="Giới hạn sản phẩm" name="maxProducts" type="number" min={-1} step={1} hint="0 = không được phép · -1 = không giới hạn" defaultValue={initial.maxProducts} required />
          <TextField id="plan-storageMb" label="Dung lượng (MB)" name="storageMb" type="number" min={-1} step={1} hint="0 = không được phép · -1 = không giới hạn" defaultValue={initial.storageMb} required />
          <TextField id="plan-maxFileMb" label="Kích thước file tối đa (MB)" name="maxFileMb" type="number" min={-1} step={1} hint="0 = không được phép · -1 = không giới hạn" defaultValue={initial.maxFileMb} required />
          <TextField id="plan-imageStorageMb" label="Dung lượng ảnh (MB)" name="imageStorageMb" type="number" min={-1} step={1} hint="0 = không được phép · -1 = không giới hạn" defaultValue={initial.imageStorageMb} required />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="goi-tinh-nang"
        defaultOpen={expandAll}
        icon={<IconTag className="h-5 w-5" />}
        title="Gói Free & tính năng"
        description="Gán tự động cho tenant mới và các tính năng mở khoá theo gói."
        status={sectionStatus({ dirty: dirtyOf(FEATURE_FIELDS) })}
      >

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
      </CollapsibleSection>

      <div className="space-y-3">
        <FormBanner ok={false} message={state.error} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : submitLabel}</PrimaryButton>
      </div>
    </form>
  );
}
