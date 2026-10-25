"use client";

import { useActionState } from "react";
import Link from "next/link";
import { createTenantAction, type CreateTenantActionState } from "./actions";
import { AuthCard } from "../(auth)/_ui/auth-card";
import { ErrorBanner, SubmitButton, TextField } from "../(auth)/_ui/fields";
import { BLUE, INK_SOFT, LINE } from "../(auth)/_ui/colors";
import { IconExternalLink } from "../admin/_ui/icons";

/** ADR-054 mục 5 — bản Chính sách người bán đang hiệu lực; `null` = chưa có (không hiện ô đồng ý). */
export interface SellerPolicyInfo {
  versionId: string;
  href: string;
  title: string;
}

const initialState: CreateTenantActionState = {};

export function StudioOnboardingForm({ brandName, siteHost, sellerPolicy }: { brandName: string; siteHost: string; sellerPolicy: SellerPolicyInfo | null }) {
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
        {sellerPolicy ? (
          <div>
            <input type="hidden" name="sellerPolicyVersionId" value={sellerPolicy.versionId} />
            <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-xl border px-3.5 py-3 text-sm leading-relaxed" style={{ borderColor: LINE, color: INK_SOFT }}>
              <input
                type="checkbox"
                name="sellerPolicyAccepted"
                required
                className="mt-0.5 h-[18px] w-[18px] shrink-0 cursor-pointer rounded accent-[color:var(--brand-primary,#0F3B82)]"
              />
              <span>
                Tôi đồng ý với{" "}
                <Link
                  href={sellerPolicy.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-sm font-semibold underline underline-offset-2 outline-offset-2 focus-visible:outline-2"
                  style={{ color: BLUE, outlineColor: BLUE }}
                >
                  {sellerPolicy.title}
                  <IconExternalLink className="ml-1 inline h-3.5 w-3.5 align-[-2px]" />
                  <span className="sr-only"> (mở trong tab mới)</span>
                </Link>
                .
              </span>
            </label>
          </div>
        ) : null}
        <ErrorBanner message={state.error} />
        <SubmitButton loading={isPending}>{isPending ? "Đang tạo..." : "Mở trang của tôi"}</SubmitButton>
      </form>
    </AuthCard>
  );
}
