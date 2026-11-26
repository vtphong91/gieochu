"use client";

import { useId, useState, useTransition } from "react";
import { IconEye, IconEyeOff } from "../../_ui/icons";
import { revealUserPhoneAction } from "../actions";

/**
 * ADR-073 mục 2 — ô "Số điện thoại" của trang chi tiết người dùng: mặc định chỉ hiện bản đã che (`phoneMasked`, server che sẵn — số đầy
 * đủ KHÔNG có trong HTML ban đầu). "Hiện đầy đủ" gọi `revealUserPhoneAction` (server ghi nhật ký `USER_PHONE_VIEWED` mỗi lần, có giới
 * hạn tần suất) rồi giữ số trong state của component; "Ẩn số" xoá khỏi state (không gọi lại server). Lỗi (giới hạn tần suất, không có số,
 * không ghi được nhật ký…) hiện ngay dưới ô bằng `role="alert"`; kết quả báo cho trình đọc màn hình qua vùng `role="status"` (không đọc số).
 */

const BUTTON =
  "inline-flex min-h-11 cursor-pointer items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-[color:var(--color-primary)] underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)] disabled:cursor-not-allowed disabled:opacity-60 motion-reduce:transition-none lg:min-h-9";

export function PhoneField({ userId, masked }: { userId: string; masked: string | null }) {
  const [phone, setPhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [pending, startTransition] = useTransition();
  const hintId = useId();

  if (!masked) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="sr-only">Chưa có số điện thoại</span>
      </>
    );
  }

  function reveal() {
    setError(null);
    setStatus("");
    startTransition(async () => {
      try {
        const result = await revealUserPhoneAction(userId);
        if (result.phone) {
          setPhone(result.phone);
          setStatus("Đã hiện số điện thoại đầy đủ.");
        } else {
          setError(result.error ?? "Không xem được số điện thoại, vui lòng thử lại.");
        }
      } catch {
        setError("Không xem được số điện thoại, vui lòng thử lại.");
      }
    });
  }

  function hide() {
    setPhone(null);
    setStatus("Đã ẩn số điện thoại.");
  }

  return (
    <div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        {phone ? (
          <span className="font-mono tabular-nums select-all">{phone}</span>
        ) : (
          <>
            {/* Dấu "•" không đọc được nghĩa → ẩn khỏi trình đọc màn hình, thay bằng câu mô tả. */}
            <span aria-hidden="true" className="font-mono tabular-nums">
              {masked}
            </span>
            <span className="sr-only">Số điện thoại đã được che một phần</span>
          </>
        )}
        {phone ? (
          <button type="button" onClick={hide} className={BUTTON}>
            <IconEyeOff className="h-4 w-4" />
            Ẩn số<span className="sr-only"> điện thoại</span>
          </button>
        ) : (
          <button type="button" onClick={reveal} disabled={pending} aria-describedby={hintId} className={BUTTON}>
            <IconEye className="h-4 w-4" />
            {pending ? "Đang tải..." : "Hiện đầy đủ"}
            <span className="sr-only"> số điện thoại</span>
          </button>
        )}
      </div>
      <p id={hintId} className="text-xs text-gray-600">
        Mỗi lần xem số đầy đủ đều được ghi vào nhật ký quản trị.
      </p>
      <p role="alert" className="mt-1 text-sm text-red-700 empty:hidden">
        {error ?? ""}
      </p>
      <span role="status" className="sr-only">
        {status}
      </span>
    </div>
  );
}
