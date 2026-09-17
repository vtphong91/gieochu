"use client";

import { useActionState } from "react";
import { updateBrandingAction, type SettingsActionState } from "./actions";

interface BrandingValues {
  name: string;
  bio: string;
  primaryColor: string;
  accentColor: string;
  facebook: string;
  youtube: string;
  tiktok: string;
  zalo: string;
  website: string;
}

const initialState: SettingsActionState = {};

export function BrandingForm({ tenantSlug, initial }: { tenantSlug: string; initial: BrandingValues }) {
  const action = updateBrandingAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction} className="mt-3 space-y-4">
      <div>
        <label className="block text-sm font-medium" htmlFor="name">
          Tên trang
        </label>
        <input id="name" name="name" defaultValue={initial.name} required className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div>
        <label className="block text-sm font-medium" htmlFor="bio">
          Giới thiệu
        </label>
        <textarea id="bio" name="bio" defaultValue={initial.bio} rows={3} className="mt-1 w-full rounded border px-3 py-2" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium" htmlFor="primaryColor">
            Màu chủ đạo
          </label>
          <input
            id="primaryColor"
            name="primaryColor"
            defaultValue={initial.primaryColor}
            placeholder="#2563eb"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="accentColor">
            Màu nhấn
          </label>
          <input
            id="accentColor"
            name="accentColor"
            defaultValue={initial.accentColor}
            placeholder="#16a34a"
            className="mt-1 w-full rounded border px-3 py-2"
          />
        </div>
      </div>
      <fieldset className="space-y-3">
        <legend className="text-sm font-medium">Mạng xã hội</legend>
        {(["facebook", "youtube", "tiktok", "zalo", "website"] as const).map((key) => (
          <input
            key={key}
            name={key}
            defaultValue={initial[key]}
            placeholder={`Liên kết ${key}`}
            className="w-full rounded border px-3 py-2"
          />
        ))}
      </fieldset>
      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.success ? <p className="text-sm text-green-700">Đã lưu thay đổi.</p> : null}
      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-[var(--color-primary)] px-4 py-2 text-white disabled:opacity-50"
      >
        {isPending ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}
