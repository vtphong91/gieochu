"use client";

import { useActionState } from "react";
import type { CouponActionState } from "./actions";

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
    <form action={formAction} className="space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="code">
          Mã giảm giá
        </label>
        <input id="code" name="code" defaultValue={initial.code} required className="mt-1 w-full rounded border px-3 py-2 uppercase" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="type">
            Loại
          </label>
          <select id="type" name="type" defaultValue={initial.type} className="mt-1 w-full rounded border px-3 py-2">
            <option value="PERCENT">Phần trăm (%)</option>
            <option value="FIXED">Số tiền cố định (VND)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="value">
            Giá trị
          </label>
          <input id="value" name="value" type="number" min={0} defaultValue={initial.value} required className="mt-1 w-full rounded border px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="maxDiscountVnd">
            Giảm tối đa (VND, chỉ áp dụng % — để trống nếu không giới hạn)
          </label>
          <input id="maxDiscountVnd" name="maxDiscountVnd" type="number" min={0} defaultValue={initial.maxDiscountVnd} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="minOrderVnd">
            Đơn tối thiểu (VND, để trống nếu không giới hạn)
          </label>
          <input id="minOrderVnd" name="minOrderVnd" type="number" min={0} defaultValue={initial.minOrderVnd} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="usageLimit">
            Tổng lượt dùng (để trống nếu không giới hạn)
          </label>
          <input id="usageLimit" name="usageLimit" type="number" min={0} defaultValue={initial.usageLimit} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="perCustomerLimit">
            Lượt/khách (để trống nếu không giới hạn)
          </label>
          <input id="perCustomerLimit" name="perCustomerLimit" type="number" min={0} defaultValue={initial.perCustomerLimit} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="startsAt">
            Bắt đầu (để trống nếu áp dụng ngay)
          </label>
          <input id="startsAt" name="startsAt" type="datetime-local" defaultValue={initial.startsAt} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="endsAt">
            Kết thúc (để trống nếu không hết hạn)
          </label>
          <input id="endsAt" name="endsAt" type="datetime-local" defaultValue={initial.endsAt} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
      </div>
      {products.length > 0 ? (
        <fieldset className="rounded border p-3">
          <legend className="px-1 text-sm font-medium">Áp dụng cho sản phẩm (bỏ trống = áp dụng tất cả)</legend>
          <div className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {products.map((product) => (
              <label key={product.id} className="flex items-center gap-2">
                <input type="checkbox" name="productIds" value={product.id} defaultChecked={initial.productIds.includes(product.id)} />
                {product.title}
              </label>
            ))}
          </div>
        </fieldset>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="isEnabled" defaultChecked={initial.isEnabled} />
        Bật mã này
      </label>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      <button type="submit" disabled={isPending} className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50">
        {isPending ? "Đang lưu..." : submitLabel}
      </button>
    </form>
  );
}
