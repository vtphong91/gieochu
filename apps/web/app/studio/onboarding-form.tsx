"use client";

import { useActionState } from "react";
import { createTenantAction, type CreateTenantActionState } from "./actions";
import { AuthCard } from "../(auth)/_ui/auth-card";
import { ErrorBanner, SubmitButton, TextField } from "../(auth)/_ui/fields";
import { INK_SOFT, LINE } from "../(auth)/_ui/colors";

const initialState: CreateTenantActionState = {};

export function StudioOnboardingForm({ brandName, siteHost }: { brandName: string; siteHost: string }) {
  const [state, formAction, isPending] = useActionState(createTenantAction, initialState);

  return (
    <AuthCard title="Mở trang của bạn" subtitle={`Tạo trang bán tài liệu riêng của bạn trên ${brandName}.`}>
      <form action={formAction} className="space-y-4">
        <TextField id="name" label="Tên trang" name="name" required />
        <div>
          <label className="block text-sm font-medium" htmlFor="slug" style={{ color: "#12213A" }}>
            Đường dẫn (tuỳ chọn — tự tạo từ tên nếu bỏ trống)
          </label>
          <div className="mt-1.5 flex items-center rounded-lg border px-3.5 py-2.5 text-[15px]" style={{ borderColor: LINE, color: INK_SOFT }}>
            <span>{siteHost}/</span>
            <input id="slug" name="slug" placeholder="ten-trang-cua-ban" className="w-full outline-none" style={{ color: "#12213A" }} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium" htmlFor="bio" style={{ color: "#12213A" }}>
            Giới thiệu ngắn
          </label>
          <textarea
            id="bio"
            name="bio"
            rows={3}
            className="mt-1.5 w-full rounded-lg border px-3.5 py-2.5 text-[15px] outline-none"
            style={{ borderColor: LINE }}
          />
        </div>
        <ErrorBanner message={state.error} />
        <SubmitButton loading={isPending}>{isPending ? "Đang tạo..." : "Mở trang của tôi"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
