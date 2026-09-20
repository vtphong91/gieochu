"use client";

import { useActionState } from "react";
import type { CouponActionState } from "./actions";
import { ConfigCard, FormBanner, PrimaryButton, SelectField, TextField, Toggle } from "../../../admin/_ui/kit";
import { IconTag } from "../../../admin/_ui/icons";

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

  return (
    <form action={formAction}>
      <ConfigCard
        icon={<IconTag className="h-5 w-5" />}
        title="Thông tin mã giảm giá"
        toggle={<Toggle name="isEnabled" defaultChecked={initial.isEnabled} label="Bật" />}
      >
        <TextField id="code" label="Mã giảm giá" name="code" defaultValue={initial.code} required hint="Không phân biệt hoa thường khi khách nhập." />

        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField id="type" label="Loại" name="type" defaultValue={initial.type}>
            <option value="PERCENT">Phần trăm (%)</option>
            <option value="FIXED">Số tiền cố định (VND)</option>
          </SelectField>
          <TextField id="value" label="Giá trị" name="value" type="number" min={0} defaultValue={initial.value} required />
        </div>

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
          <TextField
            id="minOrderVnd"
            label="Đơn tối thiểu (VND)"
            name="minOrderVnd"
            type="number"
            min={0}
            defaultValue={initial.minOrderVnd}
            hint="Để trống nếu không giới hạn."
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="usageLimit"
            label="Tổng lượt dùng"
            name="usageLimit"
            type="number"
            min={0}
            defaultValue={initial.usageLimit}
            hint="Để trống nếu không giới hạn."
          />
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

        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            id="startsAt"
            label="Bắt đầu"
            name="startsAt"
            type="datetime-local"
            defaultValue={initial.startsAt}
            hint="Để trống nếu áp dụng ngay."
          />
          <TextField
            id="endsAt"
            label="Kết thúc"
            name="endsAt"
            type="datetime-local"
            defaultValue={initial.endsAt}
            hint="Để trống nếu không hết hạn."
          />
        </div>

        {products.length > 0 ? (
          <fieldset className="rounded-lg border p-3.5" style={{ borderColor: "#E5E7EB" }}>
            <legend className="px-1 text-xs font-medium text-gray-500">Áp dụng cho sản phẩm (bỏ trống = áp dụng tất cả)</legend>
            <div className="max-h-40 space-y-1.5 overflow-y-auto text-sm">
              {products.map((product) => (
                <label key={product.id} className="flex items-center gap-2" style={{ color: "#12213A" }}>
                  <input type="checkbox" name="productIds" value={product.id} defaultChecked={initial.productIds.includes(product.id)} className="h-4 w-4" />
                  {product.title}
                </label>
              ))}
            </div>
          </fieldset>
        ) : null}

        <FormBanner ok={false} message={state.error} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : submitLabel}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
