"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { EDITOR_DRAFT_DEBOUNCE_MS, EDITOR_DRAFT_ERROR_CODES, EDITOR_DRAFT_MAX_INTERVAL_MS } from "@gieochu/core/editor-draft";

/**
 * ADR-053 bổ sung lần 3 — tự lưu nháp editor lên server (docs/ke-hoach-tu-luu-nhap-2026-10-24.md mục 3). Hook chỉ lo
 * NHỊP và TRẠNG THÁI; việc ghi do `save` (Server Action của từng editor, gọi `saveDraft` trong lib/editor-draft.ts) làm.
 *
 *  - Lưu sau 3 giây ngừng gõ; gõ liên tục thì tối đa 30 giây một lần. Chỉ khi `enabled && dirty`; payload không đổi so
 *    với lần lưu thành công trước (so hash) thì bỏ qua.
 *  - Lưu ngay khi tab bị ẩn (`visibilitychange`), khi unmount (đổi route) và khi phiên sắp hết
 *    (`gieochu:session-expiring` từ app/_ui/session-refresh.tsx). Đóng tab: KHÔNG lưu (editor giữ `beforeunload`).
 *  - Gửi `expectedRevision` + `clientId`. `DRAFT_CONFLICT` → dừng autosave, chờ `resolveConflict` (đã tải bản mới nhất)
 *    hoặc `overwrite()` (ghi đè).
 *  - `RATE_LIMITED` → lùi dần (5 giây, nhân đôi, tối đa 60 giây). `UNAUTHORIZED` → làm mới phiên 1 lần rồi gửi lại; vẫn
 *    lỗi → `unauthenticated` (nội dung vẫn nằm trong state của form, không lưu cục bộ trình duyệt).
 *  - Bấm Lưu: gọi `suspend()` trước khi gửi (huỷ debounce, bỏ kết quả autosave đang bay). Lưu xong (server đã xoá nháp)
 *    gọi `markSaved()`; Lưu lỗi gọi `resume()`.
 *
 * Log/console không bao giờ in payload.
 */

export type AutosaveSaveResult =
  | { ok: true; revision: number; updatedAt: string | Date }
  | { ok: false; code: string; message?: string };

export interface AutosaveSaveArgs<T> {
  payload: T;
  clientId: string;
  expectedRevision: number | null;
  overwrite: boolean;
}

export type AutosaveStatus =
  | "idle"
  | "saving"
  | "saved"
  | "error"
  | "conflict"
  | "too-large"
  | "rate-limited"
  | "unauthenticated"
  | "suspended";

export interface UseServerAutosaveOptions<T> {
  /** Payload hiện tại của form (đúng hình dạng zod "chế độ nháp" của loại thực thể). */
  value: T;
  /** Form có thay đổi chưa lưu. */
  dirty: boolean;
  /** false: tenant READ_ONLY/LOCKED, editor chỉ đọc, hoặc banner khôi phục chưa được chọn. */
  enabled: boolean;
  /** Revision nháp server lúc tải trang (`null` = chưa có nháp). */
  initialRevision: number | null;
  save: (args: AutosaveSaveArgs<T>) => Promise<AutosaveSaveResult>;
  /** Mặc định gọi `POST /api/auth/refresh`. */
  refreshSession?: () => Promise<boolean>;
}

export interface ServerAutosave {
  status: AutosaveStatus;
  lastSavedAt: Date | null;
  revision: number | null;
  clientId: string;
  /** Lưu ngay nếu có thay đổi (bỏ qua debounce). */
  flush: () => Promise<void>;
  /** Thử lại sau lỗi (`error` / `unauthenticated` / `too-large`); không gỡ xung đột (dùng `resolveConflict`/`overwrite`). */
  retry: () => Promise<void>;
  /** Trước khi bấm Lưu/Xuất bản. */
  suspend: () => void;
  /** Lưu thất bại — tiếp tục autosave. */
  resume: () => void;
  /** Lưu thành công — nháp server đã bị xoá; nội dung hiện tại coi là đã lưu. */
  markSaved: () => void;
  /** Sau xung đột, đã tải bản nháp mới nhất vào form (revision + payload của nó; null = nháp đã bị xoá). */
  resolveConflict: (revision: number | null, loadedPayload?: unknown) => void;
  /** Sau xung đột, ghi đè nháp server bằng nội dung tab này. */
  overwrite: () => Promise<void>;
}

const SESSION_EXPIRING_EVENT = "gieochu:session-expiring";
const BACKOFF_START_MS = 5_000;
const BACKOFF_MAX_MS = 60_000;

/** FNV-1a 32-bit — chỉ để phát hiện "payload không đổi", không dùng cho bảo mật. */
function hashText(text: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return `${text.length}:${hash.toString(36)}`;
}

function hashPayload(value: unknown): string | null {
  try {
    const text = JSON.stringify(value);
    return text === undefined ? null : hashText(text);
  } catch {
    return null;
  }
}

function newClientId(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function defaultRefreshSession(): Promise<boolean> {
  try {
    const response = await fetch("/api/auth/refresh", { method: "POST" });
    return response.ok;
  } catch {
    return false;
  }
}

export function useServerAutosave<T>(options: UseServerAutosaveOptions<T>): ServerAutosave {
  const [clientId] = useState(newClientId);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [revision, setRevision] = useState<number | null>(options.initialRevision);

  const optionsRef = useRef(options);
  const revisionRef = useRef<number | null>(options.initialRevision);
  /** Hash payload của lần lưu thành công gần nhất (hoặc của bản đã Lưu). */
  const savedHashRef = useRef<string | null>(null);
  /** Lúc có thay đổi đầu tiên chưa được lưu — mốc trần 30 giây. */
  const pendingSinceRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inFlightRef = useRef<Promise<void> | null>(null);
  /** Có thay đổi mới trong lúc đang lưu → lưu tiếp khi xong. */
  const againRef = useRef(false);
  /** Tăng khi suspend/markSaved — kết quả của lần lưu cũ bị bỏ qua. */
  const epochRef = useRef(0);
  /** Dừng hẳn tới khi người dùng xử lý (xung đột, hết phiên, Lưu). */
  const haltedRef = useRef<AutosaveStatus | null>(null);
  const backoffRef = useRef(0);
  /** `flush` mới nhất — cho timer/listener đăng ký một lần. */
  const flushRef = useRef<() => Promise<void>>(() => Promise.resolve());

  useEffect(() => {
    optionsRef.current = options;
  });

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const runSave = useCallback(
    async (overwrite: boolean): Promise<void> => {
      const current = optionsRef.current;
      if (!overwrite && (haltedRef.current !== null || !current.enabled || !current.dirty)) return;
      const payload = current.value;
      const hash = hashPayload(payload);
      if (!overwrite && hash !== null && hash === savedHashRef.current) {
        pendingSinceRef.current = null;
        return;
      }
      const epoch = epochRef.current;
      setStatus("saving");

      const attempt = () => current.save({ payload, clientId, expectedRevision: revisionRef.current, overwrite });
      let result: AutosaveSaveResult;
      try {
        result = await attempt();
        if (!result.ok && result.code === "UNAUTHORIZED" && epoch === epochRef.current) {
          const refreshed = await (current.refreshSession ?? defaultRefreshSession)();
          result = refreshed ? await attempt() : result;
        }
      } catch {
        result = { ok: false, code: "NETWORK" };
      }
      if (epoch !== epochRef.current) return; // Đã bấm Lưu / markSaved trong lúc chờ.

      if (result.ok) {
        revisionRef.current = result.revision;
        setRevision(result.revision);
        savedHashRef.current = hash;
        pendingSinceRef.current = null;
        backoffRef.current = 0;
        haltedRef.current = null;
        setLastSavedAt(new Date(result.updatedAt));
        setStatus("saved");
        return;
      }
      switch (result.code) {
        case EDITOR_DRAFT_ERROR_CODES.CONFLICT:
          haltedRef.current = "conflict";
          setStatus("conflict");
          return;
        case "FORBIDDEN":
          // Mất quyền hoặc tenant tạm ngưng — không gửi lại mỗi lần gõ; "Thử lại" để gửi tiếp.
          haltedRef.current = "error";
          setStatus("error");
          return;
        case "UNAUTHORIZED":
          haltedRef.current = "unauthenticated";
          setStatus("unauthenticated");
          return;
        case EDITOR_DRAFT_ERROR_CODES.TOO_LARGE:
          // Không gửi lại cùng nội dung; thay đổi kế tiếp (có thể đã ngắn lại) sẽ thử lại.
          savedHashRef.current = hash;
          setStatus("too-large");
          return;
        case "RATE_LIMITED": {
          backoffRef.current = backoffRef.current === 0 ? BACKOFF_START_MS : Math.min(BACKOFF_MAX_MS, backoffRef.current * 2);
          setStatus("rate-limited");
          clearTimer();
          timerRef.current = setTimeout(() => void flushRef.current(), backoffRef.current);
          return;
        }
        default:
          // FORBIDDEN (tenant tạm ngưng), lỗi mạng, lỗi khác: báo lỗi, thay đổi kế tiếp hoặc "Thử lại" sẽ gửi lại.
          setStatus("error");
      }
    },
    [clientId, clearTimer],
  );

  const flush = useCallback(async (): Promise<void> => {
    clearTimer();
    if (inFlightRef.current) {
      againRef.current = true;
      return inFlightRef.current;
    }
    const run = (async () => {
      do {
        againRef.current = false;
        await runSave(false);
      } while (againRef.current && haltedRef.current === null);
    })();
    inFlightRef.current = run;
    try {
      await run;
    } finally {
      inFlightRef.current = null;
    }
  }, [clearTimer, runSave]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  // Lên lịch theo mỗi thay đổi: debounce 3 giây, nhưng không quá 30 giây kể từ thay đổi đầu tiên chưa lưu.
  const { value, dirty, enabled } = options;
  useEffect(() => {
    if (!enabled || !dirty || haltedRef.current !== null) return;
    if (backoffRef.current > 0 && timerRef.current !== null) return; // Đang chờ lùi do rate limit.
    const now = Date.now();
    pendingSinceRef.current ??= now;
    const untilCap = pendingSinceRef.current + EDITOR_DRAFT_MAX_INTERVAL_MS - now;
    clearTimer();
    timerRef.current = setTimeout(() => void flushRef.current(), Math.max(0, Math.min(EDITOR_DRAFT_DEBOUNCE_MS, untilCap)));
  }, [value, dirty, enabled, clearTimer]);

  // Rời tab, phiên sắp hết, unmount (đổi route) → lưu ngay.
  useEffect(() => {
    function onVisibility() {
      if (document.visibilityState === "hidden") void flushRef.current();
    }
    function onSessionExpiring() {
      void flushRef.current();
    }
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener(SESSION_EXPIRING_EVENT, onSessionExpiring);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener(SESSION_EXPIRING_EVENT, onSessionExpiring);
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      void flushRef.current();
    };
  }, []);

  const suspend = useCallback(() => {
    clearTimer();
    epochRef.current += 1;
    haltedRef.current = "suspended";
    setStatus("suspended");
  }, [clearTimer]);

  const resume = useCallback(() => {
    if (haltedRef.current === "suspended") haltedRef.current = null;
    setStatus("idle");
  }, []);

  const markSaved = useCallback(() => {
    clearTimer();
    epochRef.current += 1;
    savedHashRef.current = hashPayload(optionsRef.current.value);
    pendingSinceRef.current = null;
    revisionRef.current = null;
    setRevision(null);
    haltedRef.current = null;
    backoffRef.current = 0;
    setStatus("idle");
  }, [clearTimer]);

  const resolveConflict = useCallback((next: number | null, loadedPayload?: unknown) => {
    revisionRef.current = next;
    setRevision(next);
    // Form vừa được thay bằng bản mới nhất — đúng bằng nháp server, chưa có gì mới để lưu.
    savedHashRef.current = loadedPayload === undefined ? null : hashPayload(loadedPayload);
    pendingSinceRef.current = null;
    haltedRef.current = null;
    setStatus("idle");
  }, []);

  const overwrite = useCallback(async () => {
    clearTimer();
    haltedRef.current = null;
    if (inFlightRef.current) await inFlightRef.current;
    await runSave(true);
  }, [clearTimer, runSave]);

  const retry = useCallback(async () => {
    if (haltedRef.current === "unauthenticated" || haltedRef.current === "error") haltedRef.current = null;
    savedHashRef.current = null;
    await flush();
  }, [flush]);

  return { status, lastSavedAt, revision, clientId, flush, retry, suspend, resume, markSaved, resolveConflict, overwrite };
}
