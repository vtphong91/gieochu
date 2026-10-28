"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import type { PublicProductPreviewFile } from "../../../lib/product-file-preview";
import { FileFormatIcon, inferIconKind } from "./product-preview-section";

// ADR-063 UI (Phong): trang hệ thống (ADR-025) → brandColors + font hệ thống.

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const SURFACE = brandColors.surface;
const ACCENT = brandColors.accent;
const ACCENT_SOFT = brandColors.accentSoft;

interface ApiResponse {
  fileName: string;
  mimeType: string | null;
  sizeBytes: number;
  kind: "docx" | "xlsx" | "pdf" | "text" | "unsupported";
  payload: Record<string, unknown>;
  ratio: number;
  totalEstimate: Record<string, number>;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "";
  const units = ["B", "KB", "MB", "GB"];
  let n = bytes;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

/** Focus trap đơn giản: Tab/Shift+Tab vòng trong panel; Esc đóng. */
function useFocusTrap(active: boolean, panelRef: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!active) return;

    // Khoá cuộn body
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

    // Focus nút Đóng khi mở
    const closeBtn = panel?.querySelector<HTMLButtonElement>("[data-adr063-close]");
    closeBtn?.focus();

    function focusableElements(): HTMLElement[] {
      if (!panel) return [];
      return Array.from(
        panel.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute("inert"));
    }

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab") return;
      const nodes = focusableElements();
      if (nodes.length === 0) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (!first || !last) return;
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (current === first || !panel?.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else if (current === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
      previouslyFocused?.focus?.();
    };
    // Chủ ý bỏ `onClose` khỏi deps: dùng ref để tránh teardown mỗi lần parent re-render.
  }, [active, panelRef]);
}

export function ProductPreviewModal({
  file,
  tenantSlug,
  productSlug,
  onClose,
}: {
  file: PublicProductPreviewFile;
  tenantSlug: string;
  productSlug: string;
  onClose: () => void;
}) {
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const titleId = `adr063-preview-title-${file.id}`;

  useFocusTrap(true, panelRef, onClose);

  useEffect(() => {
    // Reset state nằm ở retry handler + key prop ở component cha (openFile.id) để tránh gọi setState trong effect
    // body (ESLint `react-hooks/set-state-in-effect`). Khi file đổi → remount theo key; khi retry → event handler reset.
    let cancelled = false;
    fetch(`/api/${encodeURIComponent(tenantSlug)}/${encodeURIComponent(productSlug)}/preview/${encodeURIComponent(file.id)}`)
      .then(async (res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((json: ApiResponse) => {
        if (!cancelled) setData(json);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message || "Không tải được bản xem trước.");
      });
    return () => {
      cancelled = true;
    };
  }, [tenantSlug, productSlug, file.id, attempt]);

  const retry = useCallback(() => {
    setData(null);
    setError(null);
    setAttempt((n) => n + 1);
  }, []);

  const buyHref = `/${encodeURIComponent(tenantSlug)}/checkout?tai-lieu=${encodeURIComponent(productSlug)}`;
  const iconKind = inferIconKind(file);

  // Dòng meta dưới tiêu đề: dung lượng · ước lượng tổng
  const metaParts: string[] = [];
  if (file.sizeBytes > 0) metaParts.push(formatBytes(file.sizeBytes));
  const totalEstimate = data?.totalEstimate ?? {};
  if (typeof totalEstimate.pageCount === "number") metaParts.push(`${totalEstimate.pageCount} trang`);
  else if (file.pageCount) metaParts.push(`${file.pageCount} trang`);
  if (typeof totalEstimate.totalRows === "number") metaParts.push(`${totalEstimate.totalRows} hàng`);
  else if (file.totalRows) metaParts.push(`${file.totalRows} hàng`);
  if (metaParts.length === 0 && typeof totalEstimate.totalChars === "number") {
    metaParts.push(`${totalEstimate.totalChars.toLocaleString("vi-VN")} ký tự`);
  }

  return (
    <div
      className="adr063-preview-overlay fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/60 p-0 sm:items-center sm:p-6"
      onClick={onClose}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="adr063-preview-panel relative flex max-h-[95dvh] w-full max-w-3xl flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-start gap-3 border-b px-5 py-4" style={{ borderColor: LINE }}>
          <FileFormatIcon kind={iconKind} />
          <div className="min-w-0 flex-1">
            <h3
              id={titleId}
              className="font-[family-name:var(--font-heading)] truncate text-base font-bold sm:text-lg"
              style={{ color: INK }}
            >
              {file.fileName}
            </h3>
            {metaParts.length > 0 ? (
              <p className="mt-0.5 truncate text-xs" style={{ color: INK_SOFT }}>
                {metaParts.join(" · ")}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            data-adr063-close
            onClick={onClose}
            aria-label="Đóng"
            className="shrink-0 rounded-full p-2 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2"
            style={{ color: INK_SOFT }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto px-5 py-5 text-sm" style={{ color: INK }}>
          {error ? <ErrorCard message={error} onRetry={retry} /> : null}
          {!data && !error ? <LoadingSkeleton /> : null}
          {data ? <PreviewBody data={data} /> : null}
        </div>

        <footer
          className="sticky bottom-0 flex flex-col gap-2 border-t px-5 py-3 sm:flex-row sm:items-center sm:justify-between"
          style={{ background: ACCENT_SOFT, borderColor: LINE }}
        >
          <p className="text-sm" style={{ color: INK }}>
            Bạn đang xem{" "}
            <strong style={{ color: ACCENT }}>bản xem trước (20%)</strong>. Mua tài liệu để xem đầy đủ.
          </p>
          <a
            href={buyHref}
            className="inline-flex w-full items-center justify-center rounded-full px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 sm:w-auto"
            style={{ background: "var(--color-primary)" }}
          >
            Mua tài liệu
          </a>
        </footer>
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-live="polite" aria-busy="true">
      <p className="text-sm" style={{ color: INK_SOFT }}>
        Đang trích nội dung...
      </p>
      <div className="h-3.5 w-5/6 rounded" style={{ background: "#F1F5F9" }} />
      <div className="h-3.5 w-full rounded" style={{ background: "#F1F5F9" }} />
      <div className="h-3.5 w-4/5 rounded" style={{ background: "#F1F5F9" }} />
    </div>
  );
}

function ErrorCard({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border p-4"
      style={{ borderColor: "#FCA5A5", background: "#FEF2F2", color: "#991B1B" }}
    >
      <div className="flex items-center gap-2">
        <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
          <path d="M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
        <p className="text-sm font-semibold">Không tải được bản xem trước.</p>
      </div>
      <p className="text-xs opacity-80">{message}</p>
      <button
        type="button"
        onClick={onRetry}
        className="rounded-full border border-current px-4 py-1.5 text-xs font-semibold transition hover:bg-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2"
      >
        Thử lại
      </button>
    </div>
  );
}

function UnsupportedCard() {
  return (
    <div
      className="flex flex-col items-center gap-3 rounded-xl border p-8 text-center"
      style={{ borderColor: LINE, background: "#FAFAFA", color: INK_SOFT }}
    >
      <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-10 w-10">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <path d="M14 2v6h6M9 15h6M9 11h6" />
      </svg>
      <p className="text-sm font-semibold" style={{ color: INK }}>
        Định dạng này chưa hỗ trợ xem trước.
      </p>
      <p className="text-xs">Vui lòng mua tài liệu để tải file đầy đủ.</p>
    </div>
  );
}

const XLSX_MAX_COLS = 10;
const XLSX_CELL_MAX_WIDTH_PX = 240;

function PreviewBody({ data }: { data: ApiResponse }) {
  const p = data.payload;
  if (data.kind === "docx") {
    const html = typeof p.html === "string" ? p.html : "";
    // HTML đã sanitize ở server bằng sanitizeRichTextHtml (ảnh đã bị loại).
    return (
      <div
        className="gieochu-rich-content max-w-none text-[15px] leading-relaxed"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    );
  }
  if (data.kind === "text" || data.kind === "pdf") {
    const text = typeof p.text === "string" ? p.text : "";
    return (
      <pre
        className="whitespace-pre-wrap break-words font-mono text-[13.5px] leading-relaxed"
        style={{ color: INK }}
      >
        {text}
      </pre>
    );
  }
  if (data.kind === "xlsx") {
    const rows = Array.isArray(p.rows) ? (p.rows as unknown[][]) : [];
    if (rows.length === 0) return <UnsupportedCard />;
    const maxCols = Math.max(0, ...rows.map((r) => (r?.length ?? 0)));
    const shownCols = Math.min(maxCols, XLSX_MAX_COLS);
    const hiddenCols = maxCols - shownCols;
    return (
      <div className="overflow-x-auto rounded-xl border" style={{ borderColor: LINE }}>
        <table className="min-w-full border-collapse text-[13px]" style={{ color: INK }}>
          <tbody>
            {rows.map((row, i) => {
              const isHeader = i === 0;
              return (
                <tr
                  key={i}
                  className="transition-colors hover:bg-slate-50"
                  style={isHeader ? { background: SURFACE, fontWeight: 600 } : undefined}
                >
                  {Array.from({ length: shownCols }).map((_, j) => {
                    const cell = (row ?? [])[j];
                    const text = cell == null ? "" : String(cell);
                    return (
                      <td
                        key={j}
                        className="truncate border-r border-b px-3 py-2 align-top"
                        style={{
                          borderColor: LINE,
                          maxWidth: XLSX_CELL_MAX_WIDTH_PX,
                        }}
                        title={text || undefined}
                      >
                        {text}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
        {hiddenCols > 0 ? (
          <p className="px-3 py-2 text-xs" style={{ color: INK_SOFT, background: "#FAFAFA" }}>
            Còn {hiddenCols} cột không hiển thị trong bản xem trước.
          </p>
        ) : null}
      </div>
    );
  }
  return <UnsupportedCard />;
}
