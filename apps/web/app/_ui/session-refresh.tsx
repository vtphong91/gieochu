"use client";

import { useEffect } from "react";

/**
 * Access token sống 15 phút (ACCESS_TOKEN_TTL, packages/config/src/env.ts)
 * — trước đây KHÔNG có gì tự làm mới phiên trong trình duyệt, nên sau 15
 * phút hoạt động, lần điều hướng kế tiếp bị bounce về /login dù refresh
 * token (sống nhiều ngày) vẫn còn hợp lệ. Mount 1 lần ở root layout, gọi
 * `/api/auth/refresh` mỗi 10 phút (còn dư 5 phút trước khi access token thật
 * sự hết hạn) — không cần biết trước có đăng nhập hay không: nếu chưa đăng
 * nhập, request đầu tiên trả 401 và tự dừng hẳn (interval chỉ chạy sau khi
 * đợi đủ 10 phút nên khách vãng lai chưa đăng nhập không bị gọi thừa API).
 */
const REFRESH_INTERVAL_MS = 10 * 60 * 1000;

export function SessionRefresh() {
  useEffect(() => {
    let stopped = false;
    const id = setInterval(async () => {
      if (stopped) return;
      try {
        const response = await fetch("/api/auth/refresh", { method: "POST" });
        if (!response.ok) {
          stopped = true;
          clearInterval(id);
        }
      } catch {
        // Mất mạng tạm thời — thử lại ở chu kỳ kế tiếp, không dừng hẳn.
      }
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return null;
}
