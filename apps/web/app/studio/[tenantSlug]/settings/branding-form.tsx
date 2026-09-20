"use client";

import { useActionState } from "react";
import { updateBrandingAction, type SettingsActionState } from "./actions";
import { ConfigCard, FormBanner, PrimaryButton, TextField } from "../../../admin/_ui/kit";
import { IconStore } from "../../../admin/_ui/icons";

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

const SOCIAL_LABEL: Record<string, string> = {
  facebook: "Facebook",
  youtube: "YouTube",
  tiktok: "TikTok",
  zalo: "Zalo",
  website: "Website",
};

export function BrandingForm({ tenantSlug, initial }: { tenantSlug: string; initial: BrandingValues }) {
  const action = updateBrandingAction.bind(null, tenantSlug);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <form action={formAction}>
      <ConfigCard icon={<IconStore className="h-5 w-5" />} title="Thông tin trang" description="Hiển thị trên trang cửa hàng công khai của bạn.">
        <TextField id="name" label="Tên trang" name="name" defaultValue={initial.name} required />
        <div>
          <label className="mb-1.5 block text-sm font-medium" htmlFor="bio" style={{ color: "#12213A" }}>
            Giới thiệu
          </label>
          <textarea
            id="bio"
            name="bio"
            defaultValue={initial.bio}
            rows={3}
            className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none"
            style={{ borderColor: "#E5E7EB" }}
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <TextField id="primaryColor" label="Màu chủ đạo" name="primaryColor" defaultValue={initial.primaryColor} placeholder="#2563eb" />
          <TextField id="accentColor" label="Màu nhấn" name="accentColor" defaultValue={initial.accentColor} placeholder="#16a34a" />
        </div>
        <fieldset className="rounded-lg border p-3.5" style={{ borderColor: "#E5E7EB" }}>
          <legend className="px-1 text-xs font-medium text-gray-500">Mạng xã hội</legend>
          <div className="space-y-2.5">
            {(["facebook", "youtube", "tiktok", "zalo", "website"] as const).map((key) => (
              <input
                key={key}
                name={key}
                defaultValue={initial[key]}
                placeholder={`Liên kết ${SOCIAL_LABEL[key]}`}
                className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none"
                style={{ borderColor: "#E5E7EB" }}
              />
            ))}
          </div>
        </fieldset>
        <FormBanner ok={Boolean(state.success)} message={state.error ?? (state.success ? "Đã lưu thay đổi." : undefined)} />
        <PrimaryButton loading={isPending}>{isPending ? "Đang lưu..." : "Lưu thay đổi"}</PrimaryButton>
      </ConfigCard>
    </form>
  );
}
