"use client";

import { useActionState } from "react";
import { createPlanAction, type PlanActionState } from "./actions";

const initialState: PlanActionState = {};

export function CreatePlanForm() {
  const [state, formAction, isPending] = useActionState(createPlanAction, initialState);

  return (
    <form action={formAction} className="mt-6 grid grid-cols-2 gap-3 rounded border p-4 sm:grid-cols-4">
      <input name="code" placeholder="Mã gói (VD: PRO_MONTHLY)" required className="rounded border px-3 py-2" />
      <input name="name" placeholder="Tên gói" required className="rounded border px-3 py-2" />
      <input name="priceVnd" type="number" placeholder="Giá (VNĐ)" required className="rounded border px-3 py-2" />
      <select name="interval" className="rounded border px-3 py-2">
        <option value="MONTH">Tháng</option>
        <option value="YEAR">Năm</option>
      </select>
      <input
        name="intervalCount"
        type="number"
        defaultValue={1}
        placeholder="Số chu kỳ"
        required
        className="rounded border px-3 py-2"
      />
      <input
        name="maxProducts"
        type="number"
        placeholder="Giới hạn sản phẩm"
        required
        className="rounded border px-3 py-2"
      />
      <input name="storageMb" type="number" placeholder="Dung lượng (MB)" required className="rounded border px-3 py-2" />
      <input
        name="maxFileMb"
        type="number"
        placeholder="Kích thước file tối đa (MB)"
        required
        className="rounded border px-3 py-2"
      />
      <button
        type="submit"
        disabled={isPending}
        className="col-span-2 rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50 sm:col-span-4"
      >
        {isPending ? "Đang tạo..." : "Tạo gói mới"}
      </button>
      {state.error ? <p className="col-span-2 text-sm text-red-600 sm:col-span-4">{state.error}</p> : null}
    </form>
  );
}
