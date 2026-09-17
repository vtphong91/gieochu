"use client";

import { useActionState } from "react";
import { createTenantAction, type CreateTenantActionState } from "./actions";

const initialState: CreateTenantActionState = {};

export function StudioOnboardingForm() {
  const [state, formAction, isPending] = useActionState(createTenantAction, initialState);

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-2xl font-bold">Mở trang của bạn</h1>
      <p className="mt-2 text-sm text-gray-600">Tạo trang bán tài liệu riêng của bạn trên Gieo Chữ.</p>
      <form action={formAction} className="mt-6 space-y-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="name">
            Tên trang
          </label>
          <input id="name" name="name" required className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="slug">
            Đường dẫn (tuỳ chọn — tự tạo từ tên nếu bỏ trống)
          </label>
          <div className="mt-1 flex items-center rounded border px-3 py-2 text-gray-500">
            <span>gieochu.net/</span>
            <input id="slug" name="slug" placeholder="ten-trang-cua-ban" className="w-full text-gray-900 outline-none" />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="bio">
            Giới thiệu ngắn
          </label>
          <textarea id="bio" name="bio" rows={3} className="mt-1 w-full rounded border px-3 py-2" />
        </div>
        {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
        >
          {isPending ? "Đang tạo..." : "Mở trang của tôi"}
        </button>
      </form>
    </main>
  );
}
