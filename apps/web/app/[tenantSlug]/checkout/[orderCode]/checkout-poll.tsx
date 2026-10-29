"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/*
 * §"M8": poll trạng thái mỗi 3 giây khi đơn còn chờ (cùng pattern BillingPoll — M3) + ADR-062 §4.8: MỘT vùng `role="status"`
 * đọc câu trạng thái đầy đủ khi trạng thái đổi (do poll hoặc do khách bấm) — không đọc lúc tải trang, không đọc lặp mỗi lần
 * refresh, không dời focus vì poll.
 *
 * Focus: khi khách bấm một hành động làm đổi trạng thái, nút vừa bấm thường biến mất (component unmount) → focus rơi về
 * `<body>`. Hành động gọi `requestFocusAfterUpdate(id)` lúc gửi; khi khoá trạng thái đổi, component này (luôn tồn tại) đưa
 * focus tới tiêu đề tương ứng. Ý định hết hạn sau 15 giây để poll về sau không tự dời focus.
 */

let focusIntent: { id: string; at: number } | null = null;
const INTENT_TTL_MS = 15_000;

/** Gọi khi khách gửi một hành động làm đổi trạng thái đơn — tiêu đề `id` nhận focus sau khi trang render lại. */
export function requestFocusAfterUpdate(id: string) {
  focusIntent = { id, at: Date.now() };
}

/** Huỷ ý định focus (hành động trả lỗi — trạng thái không đổi). */
export function clearFocusIntent() {
  focusIntent = null;
}

export function CheckoutPoll({ active, statusKey, message }: { active: boolean; statusKey: string; message: string }) {
  const router = useRouter();
  // Khoá trạng thái đổi → cập nhật câu thông báo ngay trong render (mẫu "lưu giá trị trước" của React, không setState trong effect).
  const [seenKey, setSeenKey] = useState(statusKey);
  const [announcement, setAnnouncement] = useState("");
  if (seenKey !== statusKey) {
    setSeenKey(statusKey);
    setAnnouncement(message);
  }

  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => router.refresh(), 3000);
    return () => clearInterval(id);
  }, [active, router]);

  const focusedKey = useRef(statusKey);
  useEffect(() => {
    if (focusedKey.current === statusKey) return;
    focusedKey.current = statusKey;
    const intent = focusIntent;
    focusIntent = null;
    if (intent && Date.now() - intent.at < INTENT_TTL_MS) {
      requestAnimationFrame(() => document.getElementById(intent.id)?.focus());
    }
  }, [statusKey]);

  return (
    <p role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      {announcement}
    </p>
  );
}
