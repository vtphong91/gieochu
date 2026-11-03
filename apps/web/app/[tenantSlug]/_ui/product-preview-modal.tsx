"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  kind: "docx" | "xlsx" | "pdf" | "pptx" | "text" | "unsupported";
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

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const panel = panelRef.current;
    const previouslyFocused = document.activeElement as HTMLElement | null;

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
  if (typeof totalEstimate.slideCount === "number") metaParts.push(`${totalEstimate.slideCount} slide`);
  else if (file.slideCount) metaParts.push(`${file.slideCount} slide`);
  if (typeof totalEstimate.totalRows === "number") metaParts.push(`${totalEstimate.totalRows} hàng`);
  else if (file.totalRows) metaParts.push(`${file.totalRows} hàng`);
  if (metaParts.length === 0 && typeof totalEstimate.totalChars === "number") {
    metaParts.push(`${totalEstimate.totalChars.toLocaleString("vi-VN")} ký tự`);
  }

  const isWide = data?.kind === "pdf" || data?.kind === "pptx" || data?.kind === "xlsx";

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
        className={`adr063-preview-panel relative flex max-h-[95dvh] w-full flex-col overflow-hidden bg-white shadow-2xl sm:rounded-2xl ${
          isWide ? "max-w-4xl" : "max-w-3xl"
        }`}
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

        <div className="min-h-0 flex-1 overflow-auto px-4 py-4 sm:px-6 sm:py-5 text-sm" style={{ color: INK }}>
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

/* -------------------------------------------------------------------------- */
/*                                PDF Viewer                                  */
/* -------------------------------------------------------------------------- */

function PdfPreviewView({ payload }: { payload: Record<string, unknown> }) {
  const pdfBase64 = typeof payload.pdfBase64 === "string" ? payload.pdfBase64 : null;
  const pagesShown = typeof payload.pagesShown === "number" ? payload.pagesShown : 1;
  const pageCount = typeof payload.pageCount === "number" ? payload.pageCount : pagesShown;
  const fallbackText = typeof payload.text === "string" ? payload.text : "";
  const blobUrl = useMemo(() => {
    if (!pdfBase64) return null;
    try {
      const byteCharacters = atob(pdfBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/pdf" });
      return URL.createObjectURL(blob);
    } catch {
      return null;
    }
  }, [pdfBase64]);

  useEffect(() => {
    return () => {
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [blobUrl]);

  if (blobUrl) {
    return (
      <div className="flex flex-col h-full w-full">
        <div className="mb-2.5 flex items-center justify-between text-xs" style={{ color: INK_SOFT }}>
          <div className="flex items-center gap-1.5 font-medium">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500" />
            <span>Đang hiển thị {pagesShown} trang đầu tiên trên tổng số {pageCount} trang</span>
          </div>
          <a
            href={blobUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 font-semibold text-[color:var(--color-primary)] hover:underline"
          >
            <span>Mở thẻ mới ↗</span>
          </a>
        </div>
        <div
          className="relative h-[62vh] min-h-[420px] w-full overflow-hidden rounded-xl border bg-slate-100 shadow-inner"
          style={{ borderColor: LINE }}
        >
          <iframe
            src={`${blobUrl}#toolbar=0&navpanes=0`}
            title="Bản xem trước PDF"
            className="h-full w-full border-0"
          />
        </div>
      </div>
    );
  }

  // Fallback nếu không có stream/base64 PDF
  return (
    <pre
      className="whitespace-pre-wrap break-words font-mono text-[13.5px] leading-relaxed"
      style={{ color: INK }}
    >
      {fallbackText || "Không có nội dung văn bản hiển thị."}
    </pre>
  );
}

/* -------------------------------------------------------------------------- */
/*                            PPT / PPTX Slide Viewer                         */
/* -------------------------------------------------------------------------- */

interface SlideItem {
  slideNumber: number;
  title: string;
  bullets: string[];
}

function PptxPreviewView({ payload }: { payload: Record<string, unknown> }) {
  const slides = (Array.isArray(payload.slides) ? payload.slides : []) as SlideItem[];
  const totalSlides = typeof payload.totalSlides === "number" ? payload.totalSlides : slides.length;
  const [currentIdx, setCurrentIdx] = useState(0);

  if (slides.length === 0) return <UnsupportedCard />;

  const activeSlide = slides[currentIdx] || slides[0];
  if (!activeSlide) return <UnsupportedCard />;
  const canPrev = currentIdx > 0;
  const canNext = currentIdx < slides.length - 1;

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Slide Controls */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-xs" style={{ color: INK_SOFT }}>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-800">
            Slide {currentIdx + 1} / {slides.length}
          </span>
          <span>·</span>
          <span>Đã trích 20% ({slides.length}/{totalSlides} slide)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
            disabled={!canPrev}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-35"
            style={{ borderColor: LINE }}
          >
            ← Trước
          </button>
          <button
            type="button"
            onClick={() => setCurrentIdx((i) => Math.min(slides.length - 1, i + 1))}
            disabled={!canNext}
            className="inline-flex h-8 items-center gap-1 rounded-lg border px-3 font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-35"
            style={{ borderColor: LINE }}
          >
            Sau →
          </button>
        </div>
      </div>

      {/* Slide Canvas 16:9 Presentation View */}
      <div
        className="relative flex flex-col justify-between overflow-hidden rounded-2xl border p-6 sm:p-10 shadow-md transition-all min-h-[340px]"
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
          borderColor: "#334155",
          color: "#F8FAFC",
        }}
      >
        <div>
          {/* Slide badge */}
          <div className="flex items-center justify-between border-b border-slate-700/60 pb-3">
            <span className="rounded-md bg-orange-500/20 px-2.5 py-1 text-xs font-bold tracking-wider text-orange-400">
              SLIDE {String(activeSlide.slideNumber).padStart(2, "0")}
            </span>
            <span className="text-xs text-slate-400 font-mono">Bản xem trước PowerPoint</span>
          </div>

          {/* Slide Title */}
          <h4 className="mt-4 font-[family-name:var(--font-heading)] text-lg sm:text-2xl font-extrabold text-white leading-snug">
            {activeSlide.title}
          </h4>

          {/* Slide Bullets */}
          {activeSlide.bullets.length > 0 ? (
            <ul className="mt-6 space-y-3 text-[14.5px] leading-relaxed text-slate-200">
              {activeSlide.bullets.map((bullet, bIdx) => (
                <li key={bIdx} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-orange-400" />
                  <span className="[overflow-wrap:anywhere]">{bullet}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-sm text-slate-400 italic">Slide chứa biểu đồ hoặc hình vẽ thuyết trình.</p>
          )}
        </div>

        {/* Slide Footer */}
        <div className="mt-8 flex items-center justify-between border-t border-slate-800 pt-3 text-xs text-slate-400">
          <span>Gieo Chữ Presentation Preview</span>
          <span>
            {currentIdx + 1} / {totalSlides}
          </span>
        </div>
      </div>

      {/* Slide Thumbnails / Indicators */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-1.5">
        {slides.map((s, idx) => (
          <button
            key={s.slideNumber}
            type="button"
            onClick={() => setCurrentIdx(idx)}
            className={`h-7 px-2.5 rounded-md text-xs font-medium transition ${
              currentIdx === idx
                ? "bg-slate-900 text-white font-bold shadow-xs"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            Slide {idx + 1}
          </button>
        ))}
        {totalSlides > slides.length ? (
          <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 border border-amber-200">
            🔒 Còn {totalSlides - slides.length} slide
          </span>
        ) : null}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                DOCX Viewer                                 */
/* -------------------------------------------------------------------------- */

function DocxPreviewView({ payload }: { payload: Record<string, unknown> }) {
  const html = typeof payload.html === "string" ? payload.html : "";
  const paragraphsShown = typeof payload.paragraphsShown === "number" ? payload.paragraphsShown : null;
  const totalParagraphs = typeof payload.totalParagraphs === "number" ? payload.totalParagraphs : null;

  return (
    <div className="flex flex-col h-full w-full">
      {paragraphsShown && totalParagraphs ? (
        <div className="mb-2 text-xs text-right" style={{ color: INK_SOFT }}>
          Đã trích {paragraphsShown} / {totalParagraphs} đoạn văn bản (20%)
        </div>
      ) : null}
      <div className="mx-auto w-full max-w-3xl rounded-xl border bg-white p-6 sm:p-10 shadow-xs" style={{ borderColor: LINE }}>
        <div
          className="gieochu-rich-content max-w-none text-[15px] leading-relaxed [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-3 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:mb-2 [&_p]:mb-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:p-2 [&_td]:border [&_td]:border-slate-300 [&_td]:p-2"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                                XLSX Viewer                                 */
/* -------------------------------------------------------------------------- */

const XLSX_MAX_COLS = 12;
const XLSX_CELL_MAX_WIDTH_PX = 240;

function XlsxPreviewView({ payload }: { payload: Record<string, unknown> }) {
  const [searchQuery, setSearchQuery] = useState("");
  const sheetName = typeof payload.sheetName === "string" ? payload.sheetName : "Sheet1";
  const rawRows = payload.rows;
  const rows = useMemo(() => (Array.isArray(rawRows) ? rawRows : []) as unknown[][], [rawRows]);

  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase().trim();
    return rows.filter((row, idx) => {
      if (idx === 0) return true; // giữ hàng header
      return row.some((cell) => String(cell ?? "").toLowerCase().includes(q));
    });
  }, [rows, searchQuery]);

  if (rows.length === 0) return <UnsupportedCard />;

  const maxCols = Math.max(0, ...rows.map((r) => (r?.length ?? 0)));
  const shownCols = Math.min(maxCols, XLSX_MAX_COLS);
  const hiddenCols = maxCols - shownCols;

  function getColLabel(colIdx: number): string {
    let label = "";
    let n = colIdx;
    while (n >= 0) {
      label = String.fromCharCode((n % 26) + 65) + label;
      n = Math.floor(n / 26) - 1;
    }
    return label;
  }

  return (
    <div className="flex flex-col h-full w-full">
      {/* Top Excel Bar */}
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="rounded-md border bg-slate-50 px-2.5 py-1 font-semibold text-emerald-800" style={{ borderColor: LINE }}>
            📊 {sheetName}
          </span>
          <span style={{ color: INK_SOFT }}>
            {rows.length} hàng dữ liệu xem trước
          </span>
        </div>
        <div className="relative">
          <input
            type="text"
            placeholder="Tìm kiếm ô dữ liệu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-8 w-44 rounded-lg border bg-white px-2.5 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            style={{ borderColor: LINE }}
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
            >
              ×
            </button>
          ) : null}
        </div>
      </div>

      {/* Excel Table Grid */}
      <div className="overflow-x-auto rounded-xl border bg-white shadow-xs" style={{ borderColor: LINE }}>
        <table className="min-w-full border-collapse text-[13px] font-sans" style={{ color: INK }}>
          <thead>
            <tr className="bg-slate-100 text-slate-600">
              <th className="w-10 border border-slate-300 bg-slate-200/80 px-2 py-1 text-center font-normal select-none">#</th>
              {Array.from({ length: shownCols }).map((_, cIdx) => (
                <th key={cIdx} className="border border-slate-300 px-3 py-1 text-center font-semibold text-slate-700 select-none">
                  {getColLabel(cIdx)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredRows.map((row, i) => {
              const isHeader = i === 0;
              return (
                <tr
                  key={i}
                  className="transition-colors hover:bg-blue-50/40"
                  style={isHeader ? { background: SURFACE, fontWeight: 600 } : undefined}
                >
                  <td className="border border-slate-300 bg-slate-100 px-2 py-1 text-center font-medium text-slate-500 select-none text-xs">
                    {i + 1}
                  </td>
                  {Array.from({ length: shownCols }).map((_, j) => {
                    const cell = (row ?? [])[j];
                    const text = cell == null ? "" : String(cell);
                    return (
                      <td
                        key={j}
                        className="truncate border border-slate-200 px-3 py-2 align-top text-xs"
                        style={{ maxWidth: XLSX_CELL_MAX_WIDTH_PX }}
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
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Preview Body                                 */
/* -------------------------------------------------------------------------- */

function PreviewBody({ data }: { data: ApiResponse }) {
  const p = data.payload;

  if (data.kind === "pdf") {
    return <PdfPreviewView payload={p} />;
  }
  if (data.kind === "pptx") {
    return <PptxPreviewView payload={p} />;
  }
  if (data.kind === "docx") {
    return <DocxPreviewView payload={p} />;
  }
  if (data.kind === "xlsx") {
    return <XlsxPreviewView payload={p} />;
  }
  if (data.kind === "text") {
    const text = typeof p.text === "string" ? p.text : "";
    return (
      <div className="rounded-xl border bg-slate-900 p-4 font-mono text-xs text-slate-200 shadow-xs">
        <pre className="whitespace-pre-wrap break-words leading-relaxed">{text}</pre>
      </div>
    );
  }
  return <UnsupportedCard />;
}
