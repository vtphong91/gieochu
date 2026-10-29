"use client";

import { useEffect } from "react";
import { LIBRARY_HIGHLIGHT_ID } from "./highlight";

/**
 * ADR-062 Q7 — khi Thư viện mở với `?tai-lieu={productId}`: cuộn tới thẻ tài liệu vừa mua và đưa focus vào thẻ (trình đọc
 * màn hình bắt đầu đọc từ đó). Cuộn mượt chỉ khi người dùng không bật giảm chuyển động. Chạy một lần khi vào trang.
 */
export function LibraryHighlightFocus() {
  useEffect(() => {
    const el = document.getElementById(LIBRARY_HIGHLIGHT_ID);
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
    el.focus({ preventScroll: true });
  }, []);
  return null;
}
