"use client";

import { useActionState } from "react";
import { brandColors } from "@gieochu/config/theme";
import type { CouponActionState } from "./actions";
import { FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../../../admin/_ui/kit";
import { IconCard, IconPackage, IconTag } from "../../../admin/_ui/icons";
import { CollapsibleSection, sectionStatus, type SectionStatus } from "../../../admin/_ui/collapsible-section";
import { useFormDraft, type FormDraftValues } from "../../../admin/_ui/use-form-draft";
import { useUnsavedChanges } from "../../../admin/_ui/unsaved-changes";

const initialState: CouponActionState = {};

export interface CouponFormValues {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  maxDiscountVnd: string;
  minOrderVnd: string;
  usageLimit: string;
  perCustomerLimit: string;
  startsAt: string;
  endsAt: string;
  productIds: string[];
  isEnabled: boolean;
}

export interface ProductOption {
  id: string;
  title: string;
}

const INFO_FIELDS = ["isEnabled", "code", "type", "value"] as const;
const LIMIT_FIELDS = ["maxDiscountVnd", "minOrderVnd", "usageLimit", "perCustomerLimit"] as const;
const TIME_FIELDS = ["startsAt", "endsAt"] as const;
const PRODUCT_FIELDS = ["productIds"] as const;
const ALL_FIELDS = [...INFO_FIELDS, ...LIMIT_FIELDS, ...TIME_FIELDS, ...PRODUCT_FIELDS];

/** Giá trị đã lưu theo đúng dạng ô form đọc ra (số → chuỗi; nhóm checkbox → id đang tích theo thứ tự DOM). */
function toDraft(initial: CouponFormValues, products: ProductOption[]): FormDraftValues {
  const checked = products.filter((p) => initial.productIds.includes(p.id)).map((p) => p.id);
  return {
    isEnabled: initial.isEnabled,
    code: initial.code,
    type: initial.type,
    value: String(initial.value),
    maxDiscountVnd: initial.maxDiscountVnd,
    minOrderVnd: initial.minOrderVnd,
    usageLimit: initial.usageLimit,
    perCustomerLimit: initial.perCustomerLimit,
    startsAt: initial.startsAt,
    endsAt: initial.endsAt,
    // 1 sản phẩm → ô checkbox đơn (boolean); ≥ 2 → nhóm cùng tên (chuỗi id nối dấu phẩy).
    productIds: products.length === 1 ? checked.length === 1 : checked.join(","),
  };
}

const text = (value: string | boolean | undefined) => (typeof value === "string" ? value.trim() : "");

/**
 * ADR-058 (task 2.6): 4 khối — Thông tin mã (mở); Điều kiện & giới hạn, Thời gian áp dụng, Áp dụng cho sản phẩm (thu gọn,
 * badge tóm tắt). Mọi ô thu gọn đều tuỳ chọn với giá trị trống = không giới hạn, nên thu gọn cả ở trang Tạo không rủi ro.
 * Lưu lỗi giữ giá trị đã nhập (`useFormDraft`), cảnh báo rời trang khi chưa lưu. Không đổi action.
 */
export function CouponForm({
  action,
  initial,
  products,
  submitLabel,
}: {
  action: (state: CouponActionState, formData: FormData) => Promise<CouponActionState>;
  initial: CouponFormValues;
  products: ProductOption[];
  submitLabel: string;
}) {
  const [state, formAction, isPending] = useActionState(action, initialState);
  const { dirty, dirtyOf, values, formProps } = useFormDraft({
    names: ALL_FIELDS,
    initial: toDraft(initial, products),
    resetKey: JSON.stringify(initial),
    failed: Boolean(state.error),
  });
  useUnsavedChanges(dirty, "Mã giảm giá có thay đổi chưa lưu. Rời trang và bỏ thay đổi?");

  // Badge tóm tắt khi thu gọn ("Có thay đổi" ưu tiên hơn).
  const summary = (fields: readonly string[], label: string): SectionStatus =>
    dirtyOf(fields) ? sectionStatus({ dirty: true }) : { tone: "neutral", label };
  const hasLimit = LIMIT_FIELDS.some((field) => text(values[field]) !== "");
  const hasTime = TIME_FIELDS.some((field) => text(values[field]) !== "");
  const productCount =
    typeof values.productIds === "boolean" ? (values.productIds ? 1 : 0) : text(values.productIds) === "" ? 0 : text(values.productIds).split(",").length;

  return (
    <form action={formAction} className="space-y-4" {...formProps}>
      <CollapsibleSection
        id="ma-thong-tin"
        defaultOpen
        icon={<IconTag className="h-5 w-5" />}
        title="Thông tin mã giảm giá"
        status={sectionStatus({ dirty: dirtyOf(INFO_FIELDS) })}
      >
        <Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật mã này" />
        <TextField id="code" label="Mã giảm giá" name="code" defaultValue={initial.code} required hint="Không phân biệt hoa thường khi khách nhập." />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="type" label="Loại" name="type" defaultValue={initial.type}>
            <option value="PERCENT">Phần trăm (%)</option>
            <option value="FIXED">Số tiền cố định (VND)</option>
          </SelectField>
          <TextField id="value" label="Giá trị" name="value" type="number" min={0} defaultValue={initial.value} required />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="ma-dieu-kien"
        icon={<IconCard className="h-5 w-5" />}
        title="Điều kiện & giới hạn lượt dùng"
        description="Không bắt buộc — để trống là không giới hạn."
        status={summary(LIMIT_FIELDS, hasLimit ? "Có điều kiện" : "Không giới hạn")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="maxDiscountVnd"
            label="Giảm tối đa (VND)"
            name="maxDiscountVnd"
            type="number"
            min={0}
            defaultValue={initial.maxDiscountVnd}
            hint="Chỉ áp dụng %, để trống nếu không giới hạn."
          />
          <TextField id="minOrderVnd" label="Đơn tối thiểu (VND)" name="minOrderVnd" type="number" min={0} defaultValue={initial.minOrderVnd} hint="Để trống nếu không giới hạn." />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="usageLimit" label="Tổng lượt dùng" name="usageLimit" type="number" min={0} defaultValue={initial.usageLimit} hint="Để trống nếu không giới hạn." />
          <TextField
            id="perCustomerLimit"
            label="Lượt/khách"
            name="perCustomerLimit"
            type="number"
            min={0}
            defaultValue={initial.perCustomerLimit}
            hint="Để trống nếu không giới hạn."
          />
        </div>
      </CollapsibleSection>

      <CollapsibleSection
        id="ma-thoi-gian"
        icon={<IconCard className="h-5 w-5" />}
        title="Thời gian áp dụng"
        description="Không bắt buộc — để trống là áp dụng ngay và không hết hạn."
        status={summary(TIME_FIELDS, hasTime ? "Có thời hạn" : "Áp dụng ngay, không hết hạn")}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField id="startsAt" label="Bắt đầu" name="startsAt" type="datetime-local" defaultValue={initial.startsAt} hint="Để trống nếu áp dụng ngay." />
          <TextField id="endsAt" label="Kết thúc" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} hint="Để trống nếu không hết hạn." />
        </div>
      </CollapsibleSection>

      {products.length > 0 ? (
        <CollapsibleSection
          id="ma-san-pham"
          icon={<IconPackage className="h-5 w-5" />}
          title="Áp dụng cho sản phẩm"
          description="Không bắt buộc — bỏ trống là áp dụng cho tất cả."
          status={summary(PRODUCT_FIELDS, productCount === 0 ? "Tất cả sản phẩm" : `${productCount} sản phẩm`)}
        >
          <fieldset>
            <legend className="text-sm font-medium" style={{ color: brandColors.ink }}>
              Sản phẩm được giảm (bỏ trống = áp dụng tất cả)
            </legend>
            <div className="mt-1.5 max-h-64 space-y-1 overflow-y-auto text-sm">
              {products.map((product) => (
                <label key={product.id} className="flex min-h-11 cursor-pointer items-center gap-2.5 [overflow-wrap:anywhere] lg:min-h-8" style={{ color: brandColors.ink }}>
                  <input type="checkbox" name="productIds" value={product.id} defaultChecked={initial.productIds.includes(product.id)} className="h-4 w-4 shrink-0" />
                  {product.title}
                </label>
              ))}
            </div>
          </fieldset>
        </CollapsibleSection>
      ) : null}

      <div className="space-y-3">
        <FormBanner ok={false} message={state.error} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : submitLabel}</PrimaryButton>
      </div>
    </form>
  );
}
