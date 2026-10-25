"use client";

import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, type ComponentProps, type ReactNode } from "react";
import Link from "next/link";

/**
 * ADR-058 mục 5 — cảnh báo rời trang khi còn thay đổi chưa lưu, dùng chung cho System Center và Studio.
 *
 * - `UnsavedChangesProvider` (đặt ở layout `/admin`, `/studio/{slug}`) giữ danh sách nguồn đang "dirty" trong ref
 *   (không gây render lại) và gắn MỘT listener `beforeunload` (tải lại, đóng tab, gõ URL, link ngoài).
 * - Editor gọi `useUnsavedChanges(dirty, message?)` — thay cho `useEffect` + `beforeunload` tự gắn ở từng editor.
 *   Một trang có nhiều nguồn được (vd nội dung + khối SEO lưu riêng); hết dirty hoặc unmount thì tự gỡ.
 * - Điều hướng phía client (`next/link`) không kích hoạt `beforeunload` → link cần chặn gắn `onNavigate={useLeaveGuard()}`
 *   (`SidebarNav`, `ModuleTabs`, `GuardedLink`). `onNavigate` chỉ chạy với điều hướng SPA (Ctrl/Cmd+click mở tab mới
 *   không bị hỏi — đúng, vì trang hiện tại không mất gì).
 * - Giới hạn: nút Back/Forward của trình duyệt (popstate) — App Router không có API chặn chính thức.
 * - Ngoài provider (vd trang công khai): hook không làm gì, guard luôn cho đi.
 */

const DEFAULT_MESSAGE = "Trang đang có thay đổi chưa lưu. Rời trang và bỏ các thay đổi này?";

type NavigateEvent = { preventDefault: () => void };

type UnsavedChangesApi = {
  set: (key: string, message: string | null) => void;
  /** `true` = được đi tiếp (không dirty, hoặc người dùng đồng ý bỏ thay đổi). */
  confirmLeave: () => boolean;
};

const UnsavedChangesContext = createContext<UnsavedChangesApi | null>(null);

export function UnsavedChangesProvider({ children }: { children: ReactNode }) {
  const sources = useRef(new Map<string, string>());

  const api = useMemo<UnsavedChangesApi>(
    () => ({
      set(key, message) {
        if (message === null) sources.current.delete(key);
        else sources.current.set(key, message);
      },
      confirmLeave() {
        const dirty = sources.current;
        if (dirty.size === 0) return true;
        const message = dirty.size === 1 ? (dirty.values().next().value ?? DEFAULT_MESSAGE) : DEFAULT_MESSAGE;
        // Không xoá cờ khi đồng ý: điều hướng SPA làm editor unmount → hook tự gỡ; nếu đích vẫn là trang này
        // (link tới chính nó) thì editor còn dirty và vẫn phải được `beforeunload` bảo vệ.
        return window.confirm(message);
      },
    }),
    [],
  );

  useEffect(() => {
    const map = sources.current;
    function onBeforeUnload(event: BeforeUnloadEvent) {
      if (map.size > 0) event.preventDefault();
    }
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  return <UnsavedChangesContext.Provider value={api}>{children}</UnsavedChangesContext.Provider>;
}

/** Đăng ký trạng thái "có thay đổi chưa lưu" của một editor/form. `message` là câu hỏi hiện khi người dùng định rời trang. */
export function useUnsavedChanges(dirty: boolean, message: string = DEFAULT_MESSAGE) {
  const api = useContext(UnsavedChangesContext);
  const key = useId();
  useEffect(() => {
    if (!api || !dirty) return;
    api.set(key, message);
    return () => api.set(key, null);
  }, [api, key, dirty, message]);
}

/** Handler cho `onNavigate` của `next/link`: còn thay đổi chưa lưu → hỏi lại, người dùng huỷ thì chặn điều hướng. */
export function useLeaveGuard(): (event: NavigateEvent) => void {
  const api = useContext(UnsavedChangesContext);
  return useCallback(
    (event: NavigateEvent) => {
      if (api && !api.confirmLeave()) event.preventDefault();
    },
    [api],
  );
}

/** `next/link` có sẵn guard — dùng được từ Server Component (layout) vì không nhận prop hàm. */
export function GuardedLink(props: Omit<ComponentProps<typeof Link>, "onNavigate">) {
  const guard = useLeaveGuard();
  return <Link {...props} onNavigate={guard} />;
}
