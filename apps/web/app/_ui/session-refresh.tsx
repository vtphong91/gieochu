"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { SessionExpiryDialog } from "./session-expiry-dialog";

/**
 * Làm mới phiên đăng nhập trong trình duyệt (mount 1 lần ở root layout) — ADR-036/ADR-053.
 *
 *  - **Chỉ làm mới khi có thao tác thật** (bấm, gõ phím, cuộn, chạm, quay lại tab) kể từ lần làm mới trước, và đã quá
 *    chu kỳ (`min(TTL access/2, idle/3)`, trong khoảng 1–10 phút). Server đo idle bằng thời điểm phát token hiện tại, nên
 *    tab để yên không tự kéo dài phiên.
 *  - **Khoá giữa các tab** (Web Locks; thiếu thì dựa BroadcastChannel + ân hạn 30 giây ở server); tab làm mới xong báo
 *    các tab khác (`refreshed`) để chúng dời mốc idle theo.
 *  - **Cảnh báo idle** (phiên có idle: không "Ghi nhớ", SYSTEM_ADMIN): còn `warningSeconds` trước khi hết → hộp thoại
 *    "Tiếp tục phiên" / "Đăng xuất". Thao tác bất kỳ = tiếp tục. Hết hạn → đăng xuất và chuyển `/login?het-phien=1`.
 *  - **401** (trừ `AUTH_REFRESH_SUPERSEDED` = tab khác vừa làm mới) → phiên đã hết: dừng, báo các tab, `router.refresh()`
 *    nếu UI đang hiện đã đăng nhập; refresh thành công khi UI đang hiện "khách" (access cookie đã hết hạn) → `router.refresh()`.
 *  - Khách chưa đăng nhập: thử một lần ở thao tác đầu tiên (khôi phục phiên "Ghi nhớ"), 401 thì dừng hẳn.
 */
const MAX_REFRESH_INTERVAL_MS = 10 * 60 * 1000;
const MIN_REFRESH_INTERVAL_MS = 60 * 1000;
/** Nhịp kiểm tra mốc cảnh báo/hết phiên và bắt kịp sau khi máy ngủ dậy — không gọi mạng nếu chưa cần. */
const CHECK_INTERVAL_MS = 15 * 1000;
/** Gom sự kiện thao tác dồn dập (cuộn, gõ phím) — chỉ cần biết "có thao tác". */
const ACTIVITY_THROTTLE_MS = 5 * 1000;
const LOCK_NAME = "gieochu-session-refresh";
const CHANNEL_NAME = "gieochu-session";
const SUPERSEDED_CODE = "AUTH_REFRESH_SUPERSEDED";
const ACTIVITY_EVENTS = ["pointerdown", "keydown", "wheel", "touchstart", "scroll"] as const;

type SessionMessage = { type: "refreshed"; at: number } | { type: "ended" };

export function refreshIntervalMs(accessTokenTtlSeconds: number, idleSeconds: number | null): number {
  const byAccess = (accessTokenTtlSeconds * 1000) / 2;
  const byIdle = idleSeconds === null ? Number.POSITIVE_INFINITY : (idleSeconds * 1000) / 3;
  return Math.min(MAX_REFRESH_INTERVAL_MS, Math.max(MIN_REFRESH_INTERVAL_MS, Math.min(byAccess, byIdle)));
}

async function readErrorCode(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();
    const code = (body as { error?: { code?: unknown } } | null)?.error?.code;
    return typeof code === "string" ? code : null;
  } catch {
    return null;
  }
}

function loginUrlAfterTimeout(): string {
  const next = `${window.location.pathname}${window.location.search}`;
  return `/login?het-phien=1&next=${encodeURIComponent(next)}`;
}

export function SessionRefresh({
  accessTokenTtlSeconds,
  idleSeconds,
  warningSeconds,
  sessionIssuedAtMs,
  signedIn,
}: {
  accessTokenTtlSeconds: number;
  /** `null` = phiên không có idle ("Ghi nhớ") hoặc khách. */
  idleSeconds: number | null;
  warningSeconds: number | null;
  /** Lúc access token hiện tại được phát (≈ lúc refresh token hiện tại được tạo) — mốc đếm idle. */
  sessionIssuedAtMs: number | null;
  signedIn: boolean;
}) {
  const router = useRouter();
  const intervalMs = refreshIntervalMs(accessTokenTtlSeconds, idleSeconds);
  const idleMs = idleSeconds === null ? null : idleSeconds * 1000;
  const warningMs = warningSeconds === null ? null : warningSeconds * 1000;
  const signedInRef = useRef(signedIn);
  const continueRef = useRef<(() => void) | null>(null);
  const logoutRef = useRef<(() => void) | null>(null);
  const [warning, setWarning] = useState<{ deadline: number } | null>(null);

  useEffect(() => {
    signedInRef.current = signedIn;
  }, [signedIn]);

  useEffect(() => {
    let stopped = false;
    let inFlight = false;
    let expiring = false;
    let warningOpen = false;
    const mountedAt = Date.now();
    // Khách: mốc 0 → thao tác đầu tiên thử khôi phục phiên ngay. Đã đăng nhập: mốc = lúc phát token hiện tại.
    let lastRefreshAt = signedInRef.current ? (sessionIssuedAtMs ?? mountedAt) : 0;
    // Tải/điều hướng trang là một thao tác.
    let lastActivityAt = mountedAt;
    let lastActivityHandledAt = 0;
    const channel = typeof BroadcastChannel === "undefined" ? null : new BroadcastChannel(CHANNEL_NAME);

    function closeWarning() {
      if (!warningOpen) return;
      warningOpen = false;
      setWarning(null);
    }

    function syncUi(nowSignedIn: boolean) {
      if (signedInRef.current === nowSignedIn) return;
      signedInRef.current = nowSignedIn;
      router.refresh();
    }

    function post(message: SessionMessage) {
      channel?.postMessage(message);
    }

    async function expire() {
      if (expiring) return;
      expiring = true;
      stopped = true;
      closeWarning();
      post({ type: "ended" });
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } finally {
        window.location.assign(loginUrlAfterTimeout());
      }
    }

    async function doRefresh(force: boolean) {
      // Re-check bên trong khoá: tab khác có thể vừa làm mới (tin `refreshed` tới ngay trước/sau khi nhận khoá).
      await new Promise((resolve) => setTimeout(resolve, 50));
      if (stopped || (!force && Date.now() - lastRefreshAt < intervalMs)) return;
      let response: Response;
      try {
        response = await fetch("/api/auth/refresh", { method: "POST" });
      } catch {
        return; // Mất mạng tạm thời — thử lại ở lần kiểm tra kế tiếp.
      }
      if (response.ok) {
        lastRefreshAt = Date.now();
        post({ type: "refreshed", at: lastRefreshAt });
        closeWarning();
        syncUi(true);
        return;
      }
      if (response.status === 401) {
        const code = await readErrorCode(response);
        if (code === SUPERSEDED_CODE) {
          // Tab/request khác vừa làm mới — cookie mới đã về trình duyệt, phiên vẫn còn.
          lastRefreshAt = Date.now();
          closeWarning();
          return;
        }
        stopped = true;
        closeWarning();
        post({ type: "ended" });
        if ((code === "SESSION_IDLE_TIMEOUT" || code === "SESSION_EXPIRED") && signedInRef.current) {
          window.location.assign(loginUrlAfterTimeout());
          return;
        }
        syncUi(false);
      }
      // 5xx/khác: giữ nguyên, thử lại ở lần kiểm tra kế tiếp.
    }

    async function maybeRefresh(force = false) {
      if (stopped || inFlight) return;
      if (!force) {
        if (lastActivityAt <= lastRefreshAt) return; // Không có thao tác mới → không kéo dài phiên.
        if (Date.now() - lastRefreshAt < intervalMs) return;
      }
      inFlight = true;
      try {
        const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
        if (locks) await locks.request(LOCK_NAME, () => doRefresh(force));
        else await doRefresh(force);
      } finally {
        inFlight = false;
      }
    }

    function checkIdle() {
      if (stopped || idleMs === null || warningMs === null || !signedInRef.current) return;
      const now = Date.now();
      const deadline = lastRefreshAt + idleMs;
      if (now >= deadline) {
        void expire();
        return;
      }
      if (now >= deadline - warningMs) {
        if (lastActivityAt > lastRefreshAt) {
          // Có thao tác chưa kịp làm mới → làm mới ngay thay vì cảnh báo.
          void maybeRefresh(true);
        } else if (!warningOpen) {
          warningOpen = true;
          setWarning({ deadline });
          // Kế hoạch tự lưu nháp (ADR-053 lần 3): báo editor đang mở flush nháp trước khi phiên hết.
          window.dispatchEvent(new CustomEvent("gieochu:session-expiring"));
        }
      }
    }

    function onActivity(event?: Event) {
      // Thao tác trong hộp thoại cảnh báo do chính nút của nó xử lý (tránh "Đăng xuất" vô tình kích hoạt làm mới).
      if (event?.target instanceof Element && event.target.closest("[data-idle-warning]")) return;
      const now = Date.now();
      lastActivityAt = now;
      if (warningOpen) {
        void maybeRefresh(true);
        return;
      }
      if (now - lastActivityHandledAt < ACTIVITY_THROTTLE_MS) return;
      lastActivityHandledAt = now;
      void maybeRefresh();
    }

    function onMessage(event: MessageEvent<SessionMessage>) {
      const message = event.data;
      if (message?.type === "refreshed") {
        lastRefreshAt = Math.max(lastRefreshAt, message.at);
        stopped = false; // Tab khác đã đăng nhập lại / làm mới được → tab này tiếp tục theo dõi.
        closeWarning();
        syncUi(true);
      } else if (message?.type === "ended") {
        stopped = true;
        closeWarning();
        syncUi(false);
      }
    }

    function onVisibilityChange() {
      if (document.visibilityState !== "visible") return;
      checkIdle();
      onActivity();
    }

    continueRef.current = () => {
      lastActivityAt = Date.now();
      void maybeRefresh(true);
    };
    logoutRef.current = () => {
      stopped = true;
      closeWarning();
      post({ type: "ended" });
      // ADR-053: điều hướng cứng có chủ đích — xoá toàn bộ client cache sau khi phiên kết thúc (router.push không xoá).
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      void fetch("/api/auth/logout", { method: "POST" }).finally(() => window.location.assign("/login"));
    };

    channel?.addEventListener("message", onMessage);
    document.addEventListener("visibilitychange", onVisibilityChange);
    for (const name of ACTIVITY_EVENTS) window.addEventListener(name, onActivity, { passive: true, capture: true });
    const id = setInterval(() => {
      checkIdle();
      void maybeRefresh();
    }, CHECK_INTERVAL_MS);
    return () => {
      clearInterval(id);
      for (const name of ACTIVITY_EVENTS) window.removeEventListener(name, onActivity, { capture: true });
      document.removeEventListener("visibilitychange", onVisibilityChange);
      channel?.removeEventListener("message", onMessage);
      channel?.close();
      continueRef.current = null;
      logoutRef.current = null;
    };
  }, [intervalMs, idleMs, warningMs, sessionIssuedAtMs, router]);

  return warning ? (
    <SessionExpiryDialog
      deadline={warning.deadline}
      onContinue={() => continueRef.current?.()}
      onLogout={() => logoutRef.current?.()}
    />
  ) : null;
}
