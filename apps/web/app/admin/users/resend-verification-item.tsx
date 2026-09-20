"use client";

import { useActionState } from "react";
import { resendVerificationAdminAction, type ResendVerificationActionState } from "./actions";
import { MenuItemButton } from "../_ui/row-menu";
import { IconMail } from "../_ui/icons";

const initialState: ResendVerificationActionState = {};

/**
 * Gửi email SMTP đồng bộ giờ mất 1-2 giây thật (không còn hàng đợi im lặng),
 * nên mục menu này cần tự báo kết quả — không dựa vào `RowMenu` tự đóng khi
 * bấm (đóng ngay thì người dùng không kịp thấy "Đã gửi"/lỗi gì). Chặn
 * `stopPropagation` để giữ menu mở cho tới khi người dùng tự bấm ra ngoài.
 */
export function ResendVerificationMenuItem({ userId }: { userId: string }) {
  const action = resendVerificationAdminAction.bind(null, userId);
  const [state, formAction, isPending] = useActionState(action, initialState);

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <form action={formAction}>
        <MenuItemButton icon={<IconMail />} disabled={isPending}>
          {isPending ? "Đang gửi..." : "Gửi lại email kích hoạt"}
        </MenuItemButton>
      </form>
      {state.error ? <p className="px-3.5 pb-2 text-xs text-red-600">{state.error}</p> : null}
      {state.success ? (
        <p className="px-3.5 pb-2 text-xs" style={{ color: "#16A34A" }}>
          Đã gửi email kích hoạt.
        </p>
      ) : null}
    </div>
  );
}
