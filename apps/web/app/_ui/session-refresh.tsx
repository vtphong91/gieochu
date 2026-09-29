"use client";

import { useEffect } from "react";

/**
 * Access token sống `accessTokenTtlSeconds` (System Center, ADR-032: 5–60 phút,
 * mặc định 15) — trước đây KHÔNG có gì tự làm mới phiên trong trình duyệt, nên sau 15
 * phút hoạt động, lần điều hướng kế tiếp bị bounce về /login dù refresh
 * token (sống nhiều ngày) vẫn còn hợp lệ. Mount 1 lần ở root layout, gọi
 * `/api/auth/refresh` định kỳ (xem refreshIntervalMs — còn dư nửa TTL trước khi access token thật
 * sự hết hạn) — không cần biết trước có đăng nhập hay không: nếu chưa đăng
 * nhập, request đầu tiên trả 401 và tự dừng hẳn (interval chỉ chạy sau khi
 * đợi hết chu kỳ đầu nên khách vãng lai chưa đăng nhập không bị gọi thừa API).
 */
const MAX_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;

/** Làm mới ở nửa vòng đời token (TTL 5 phút → 2,5 phút), trần 10 phút như trước, sàn 1 phút. */
function refreshIntervalMs(accessTokenTtlSeconds: number): number {
  return Math.min(MAX_REFRESH_INTERVAL_MS, Math.max(MIN_REFRESH_INTERVAL_MS, (accessTokenTtlSeconds * 1000) / 2));
}

export function SessionRefresh({ accessTokenTtlSeconds }: { accessTokenTtlSeconds: number }) {
  const intervalMs = refreshIntervalMs(accessTokenTtlSeconds);
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
    }, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);

  return null;
}
