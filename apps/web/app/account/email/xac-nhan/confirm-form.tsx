"use client";

import { useActionState, useEffect, useRef } from "react";
import Link from "next/link";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle, IconCheckCircle } from "../../../admin/_ui/icons";
import { confirmEmailChangeAction } from "./actions";

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const BLUE = brandColors.primary;
const RED = "#B91C1C";
const BTN = "inline-flex min-h-11 w-full cursor-pointer items-center justify-center rounded-lg px-4 text-sm font-semibold outline-offset-2 transition focus-visible:outline-2 disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none";

/**
 * ADR-041 C5 — nút "Xác nhận đổi email" (POST qua Server Action; GET trang không đổi gì để trình quét link trong hộp
 * thư không tự kích hoạt). Thành công → thông báo + "Đăng nhập" (mọi phiên đã bị thu hồi). Lỗi → banner + lối thoát.
 */
export function ConfirmEmailChangeForm({ token, newEmail }: { token: string; newEmail: string }) {
  const [state, formAction, pending] = useActionState(confirmEmailChangeAction, null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (state) resultRef.current?.focus();
  }, [state]);

  if (state?.ok) {
    return (
      <div ref={resultRef} tabIndex={-1} role="status" className="space-y-4 outline-none">
        <p className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm" style={{ background: "#F0FDF4", borderColor: "#BBF7D0", color: "#15803D" }}>
          <IconCheckCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="[overflow-wrap:anywhere]">{state.message}</span>
        </p>
        <Link href="/login" className={`${BTN} text-white hover:brightness-110`} style={{ background: BLUE, outlineColor: BLUE }}>
          Đăng nhập
        </Link>
      </div>
    );
  }

  const failed = state && !state.ok ? state : null;
  return (
    <form action={formAction} className="space-y-4">
      <input type="hidden" name="token" value={token} />
      <div className="rounded-xl px-4 py-3" style={{ background: brandColors.surface }}>
        <p className="text-sm" style={{ color: INK_SOFT }}>
          Email đăng nhập mới
        </p>
        <p className="mt-0.5 text-[15px] font-semibold [overflow-wrap:anywhere]" style={{ color: INK }}>
          {newEmail}
        </p>
      </div>
      <p className="text-sm leading-relaxed" style={{ color: INK_SOFT }}>
        Sau khi xác nhận, bạn đăng nhập bằng email này. Mọi thiết bị đang đăng nhập sẽ bị đăng xuất và email cũ sẽ nhận
        thông báo.
      </p>
      {failed ? (
        <div ref={resultRef} tabIndex={-1} role="alert" className="flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm outline-none" style={{ background: "#FEF2F2", borderColor: "#FCA5A5", color: RED }}>
          <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>
            {failed.formError ?? "Không xác nhận được, vui lòng thử lại."}{" "}
            <Link href="/account/security#email" className="font-semibold underline">
              Về trang Bảo mật
            </Link>
          </span>
        </div>
      ) : null}
      <button type="submit" disabled={pending} className={`${BTN} text-white hover:brightness-110`} style={{ background: BLUE, outlineColor: BLUE }}>
        {pending ? "Đang xác nhận…" : "Xác nhận đổi email"}
      </button>
    </form>
  );
}
