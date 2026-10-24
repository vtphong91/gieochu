"use client";

import { useEffect, useId, useMemo, useRef, useState, type MouseEvent } from "react";
import { IconClose, IconDoc, IconFile } from "../../admin/_ui/icons";

function IconSearch({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                                    Types                                   */
/* -------------------------------------------------------------------------- */

export type DocKind = "image" | "pdf" | "excel" | "word" | "text" | "other";

export interface ViewDocsProps {
  /** File object (từ input kéo thả / hàng đợi tải lên của trình duyệt) */
  file?: File | Blob | null;
  /** URL truy cập tài liệu (presigned URL hoặc link ngoài hoặc blob URL) */
  url?: string | null;
  /** Tên file hiển thị */
  fileName: string;
  /** Dung lượng tệp tính theo byte */
  sizeBytes?: number;
  /** MIME type nếu có */
  mimeType?: string | null;
  /** ClassName tuỳ chọn cho container */
  className?: string;
}

export interface ViewDocsModalProps extends ViewDocsProps {
  /** Trạng thái mở modal */
  open: boolean;
  /** Hàm callback khi đóng modal */
  onClose: () => void;
  /** Element cần trả lại focus sau khi đóng */
  returnFocusRef?: React.RefObject<HTMLElement | null>;
}

/* -------------------------------------------------------------------------- */
/*                                   Helpers                                  */
/* -------------------------------------------------------------------------- */

export function detectDocKind(fileName: string, mimeType?: string | null): DocKind {
  const ext = fileName.split(".").pop()?.toLowerCase() || "";
  const mime = mimeType?.toLowerCase() || "";

  if (["png", "jpg", "jpeg", "webp", "gif", "svg", "bmp", "ico"].includes(ext) || mime.startsWith("image/")) {
    return "image";
  }
  if (ext === "pdf" || mime === "application/pdf") {
    return "pdf";
  }
  if (["xlsx", "xls", "csv"].includes(ext) || mime.includes("spreadsheet") || mime.includes("excel") || mime === "text/csv") {
    return "excel";
  }
  if (["docx", "doc"].includes(ext) || mime.includes("wordprocessingml") || mime.includes("msword")) {
    return "word";
  }
  if (
    ["txt", "md", "json", "xml", "log", "js", "ts", "jsx", "tsx", "html", "css", "yml", "yaml"].includes(ext) ||
    mime.startsWith("text/") ||
    mime === "application/json"
  ) {
    return "text";
  }
  return "other";
}

export function formatBytes(bytes?: number): string {
  if (bytes === undefined || bytes === null || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  const mb = kb / 1024;
  if (mb < 1024) return `${mb.toFixed(1)} MB`;
  const gb = mb / 1024;
  return `${gb.toFixed(2)} GB`;
}

/* -------------------------------------------------------------------------- */
/*                                Mini Icons                                  */
/* -------------------------------------------------------------------------- */

function IconZoomIn({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="11" y1="8" x2="11" y2="14" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function IconZoomOut({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <line x1="21" y1="21" x2="16.65" y2="16.65" />
      <line x1="8" y1="11" x2="14" y2="11" />
    </svg>
  );
}

function IconRotate({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
    </svg>
  );
}

function IconReset({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  );
}

function IconDownloadFile({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

function IconExternal({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
      <polyline points="15 3 21 3 21 9" />
      <line x1="10" y1="14" x2="21" y2="3" />
    </svg>
  );
}

function IconCopy({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function IconCheck({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Sub-Viewers Components                          */
/* -------------------------------------------------------------------------- */

function ImageViewer({ sourceUrl, fileName }: { sourceUrl: string; fileName: string }) {
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  function handleZoomIn() {
    setZoom((z) => Math.min(z + 25, 400));
  }
  function handleZoomOut() {
    setZoom((z) => Math.max(z - 25, 25));
  }
  function handleRotate() {
    setRotation((r) => (r + 90) % 360);
  }
  function handleReset() {
    setZoom(100);
    setRotation(0);
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Control bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-gray-50/90 px-4 py-2 text-xs backdrop-blur-xs">
        <div className="flex items-center gap-1.5 text-gray-600">
          <span>Định dạng: Ảnh</span>
          <span>·</span>
          <span>Tỉ lệ: {zoom}%</span>
          {rotation > 0 ? (
            <>
              <span>·</span>
              <span>Góc xoay: {rotation}°</span>
            </>
          ) : null}
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 25}
            title="Thu nhỏ (-25%)"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            <IconZoomOut />
          </button>
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 400}
            title="Phóng to (+25%)"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100 disabled:opacity-40"
          >
            <IconZoomIn />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            title="Xoay 90 độ"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-100"
          >
            <IconRotate />
          </button>
          <button
            type="button"
            onClick={handleReset}
            title="Đặt lại góc & tỉ lệ ban đầu"
            className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 text-gray-700 hover:bg-gray-100"
          >
            <IconReset />
            <span>Mặc định</span>
          </button>
        </div>
      </div>

      {/* Main Image View Area */}
      <div
        className="relative flex flex-1 items-center justify-center overflow-auto p-4"
        style={{
          backgroundColor: "#f9fafb",
          backgroundImage: `linear-gradient(45deg, #e5e7eb 25%, transparent 25%), 
                            linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), 
                            linear-gradient(45deg, transparent 75%, #e5e7eb 75%), 
                            linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)`,
          backgroundSize: "20px 20px",
          backgroundPosition: "0 0, 0 10px, 10px -10px, -10px 0px",
        }}
      >
        <div
          className="transition-transform duration-150 ease-out"
          style={{
            transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
            transformOrigin: "center center",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={sourceUrl}
            alt={fileName}
            className="max-h-[70vh] max-w-full rounded shadow-md object-contain"
          />
        </div>
      </div>
    </div>
  );
}

function PdfViewer({ sourceUrl, fileName }: { sourceUrl: string; fileName: string }) {
  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b bg-gray-50/90 px-4 py-2 text-xs">
        <span className="text-gray-600">Trình xem tài liệu PDF</span>
        <div className="flex items-center gap-2">
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-gray-700 hover:bg-gray-100"
          >
            <IconExternal className="h-3.5 w-3.5" />
            <span>Mở toàn màn hình</span>
          </a>
        </div>
      </div>
      <div className="relative flex-1 bg-gray-100">
        <iframe
          src={sourceUrl}
          title={fileName}
          className="h-full w-full border-0"
        />
      </div>
    </div>
  );
}

function ExcelViewer({ buffer }: { buffer: ArrayBuffer }) {
  const [sheets, setSheets] = useState<{ name: string; rows: unknown[][] }[]>([]);
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [searchQuery, setSearchQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unmounted = false;
    async function parseWorkbook() {
      try {
        const XLSX = await import("xlsx");
        const workbook = XLSX.read(buffer, { type: "array" });
        if (unmounted) return;

        const parsedSheets = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const rows = sheet ? (XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" }) as unknown[][]) : [];
          return { name, rows };
        });

        setSheets(parsedSheets);
      } catch (err) {
        if (!unmounted) {
          setError(err instanceof Error ? err.message : "Không thể đọc dữ liệu tệp bảng tính Excel.");
        }
      }
    }
    void parseWorkbook();
    return () => {
      unmounted = true;
    };
  }, [buffer]);

  const activeSheet = sheets[activeSheetIndex];
  const allRows = useMemo(() => activeSheet?.rows ?? [], [activeSheet]);

  // Filter search
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return allRows;
    const q = searchQuery.toLowerCase().trim();
    return allRows.filter((row, idx) => {
      if (idx === 0) return true; // Luôn giữ hàng tiêu đề nếu có
      return row.some((cell) => String(cell ?? "").toLowerCase().includes(q));
    });
  }, [allRows, searchQuery]);

  // Giới hạn hiển thị 150 hàng đầu để tối ưu hiệu năng giao diện
  const displayedRows = filteredRows.slice(0, 150);

  // Số cột lớn nhất
  const maxCols = useMemo(() => {
    let max = 0;
    for (const r of displayedRows) {
      if (r.length > max) max = r.length;
    }
    return max;
  }, [displayedRows]);

  function getColLabel(colIdx: number): string {
    let label = "";
    let n = colIdx;
    while (n >= 0) {
      label = String.fromCharCode((n % 26) + 65) + label;
      n = Math.floor(n / 26) - 1;
    }
    return label;
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <p className="font-semibold text-red-600">Lỗi khi đọc file Excel</p>
        <p className="mt-1 text-sm text-gray-500">{error}</p>
      </div>
    );
  }

  if (sheets.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
        Đang phân tích bảng tính Excel...
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col">
      {/* Excel Top Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-gray-50/90 px-4 py-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-medium text-gray-700">Trang tính ({sheets.length}):</span>
          <div className="flex items-center gap-1 overflow-x-auto">
            {sheets.map((sheet, index) => (
              <button
                key={sheet.name}
                type="button"
                onClick={() => {
                  setActiveSheetIndex(index);
                  setSearchQuery("");
                }}
                className={`rounded-md px-3 py-1 font-medium transition-colors ${
                  activeSheetIndex === index
                    ? "bg-white text-emerald-700 shadow-xs border border-gray-200"
                    : "text-gray-600 hover:bg-gray-200/60"
                }`}
              >
                {sheet.name}
              </button>
            ))}
          </div>
        </div>

        {/* Search */}
        <div className="relative flex items-center">
          <IconSearch className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="Tìm kiếm ô dữ liệu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-7 w-44 rounded-md border border-gray-300 bg-white pl-8 pr-2 text-xs text-gray-800 placeholder-gray-400 focus:border-emerald-600 focus:outline-hidden"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2 text-gray-400 hover:text-gray-600"
            >
              ×
            </button>
          )}
        </div>
      </div>

      {/* Excel Grid Table */}
      <div className="flex-1 overflow-auto bg-white p-2">
        {displayedRows.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-gray-500">
            Không tìm thấy dữ liệu phù hợp với “{searchQuery}”.
          </div>
        ) : (
          <div className="inline-block min-w-full align-middle">
            <table className="min-w-full border-collapse border border-gray-200 text-xs font-sans">
              <thead>
                <tr className="bg-gray-100 text-gray-600">
                  <th className="w-10 border border-gray-300 bg-gray-200 px-2 py-1 text-center font-normal">#</th>
                  {Array.from({ length: maxCols }).map((_, cIdx) => (
                    <th
                      key={cIdx}
                      className="border border-gray-300 px-3 py-1 text-center font-semibold text-gray-700"
                    >
                      {getColLabel(cIdx)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayedRows.map((row, rIdx) => (
                  <tr key={rIdx} className="hover:bg-blue-50/40">
                    <td className="border border-gray-300 bg-gray-100 px-2 py-1 text-center font-medium text-gray-500 select-none">
                      {rIdx + 1}
                    </td>
                    {Array.from({ length: maxCols }).map((_, cIdx) => {
                      const cellVal = row[cIdx];
                      const valStr = cellVal !== undefined && cellVal !== null ? String(cellVal) : "";
                      return (
                        <td
                          key={cIdx}
                          className="max-w-xs truncate border border-gray-200 px-2 py-1.5 text-gray-800"
                          title={valStr}
                        >
                          {valStr}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Excel Footer Info */}
      <div className="flex items-center justify-between border-t bg-gray-50 px-4 py-1.5 text-xs text-gray-500">
        <span>
          Đang hiển thị {displayedRows.length}/{allRows.length} dòng
          {allRows.length > 150 ? " (đã giới hạn 150 dòng để tối ưu tốc độ)" : ""}
        </span>
        <span>{maxCols} cột</span>
      </div>
    </div>
  );
}

function WordViewer({ buffer, fileName }: { buffer: ArrayBuffer; fileName: string }) {
  const [html, setHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let unmounted = false;
    async function convertWord() {
      try {
        const ext = fileName.split(".").pop()?.toLowerCase();
        if (ext === "doc") {
          throw new Error("Định dạng .doc cũ (Word 97-2003) không hỗ trợ đọc trực tiếp trong trình duyệt. Vui lòng chuyển sang định dạng .docx hoặc tải file về để xem.");
        }
        const mammoth = await import("mammoth");
        const res = await mammoth.convertToHtml({ arrayBuffer: buffer });
        if (unmounted) return;
        setHtml(res.value || "<p class='text-gray-400 italic'>Tài liệu không có nội dung chữ hiển thị.</p>");
      } catch (err) {
        if (!unmounted) {
          setError(err instanceof Error ? err.message : "Không thể chuyển đổi tài liệu Word.");
        }
      }
    }
    void convertWord();
    return () => {
      unmounted = true;
    };
  }, [buffer, fileName]);

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center p-8 text-center">
        <div className="mb-3 rounded-full bg-amber-100 p-3 text-amber-700">
          <IconDoc className="h-6 w-6" />
        </div>
        <p className="font-semibold text-gray-800">Không thể xem trực tiếp tài liệu Word</p>
        <p className="mt-2 max-w-md text-sm text-gray-600">{error}</p>
      </div>
    );
  }

  if (html === null) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-sm text-gray-500">
        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
        Đang nạp và định dạng văn bản Word...
      </div>
    );
  }

  return (
    <div className="h-full w-full overflow-y-auto bg-gray-100 p-4 sm:p-8">
      {/* Word Page Simulation */}
      <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 sm:p-12 shadow-md">
        <div
          className="prose prose-slate max-w-none text-gray-800 [&_h1]:text-2xl [&_h1]:font-bold [&_h1]:mb-4 [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:mb-3 [&_h3]:text-lg [&_h3]:font-medium [&_p]:mb-3 [&_p]:leading-relaxed [&_table]:w-full [&_table]:border-collapse [&_table]:my-4 [&_th]:border [&_th]:border-gray-300 [&_th]:bg-gray-50 [&_th]:p-2 [&_td]:border [&_td]:border-gray-300 [&_td]:p-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:mb-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:mb-3 [&_img]:max-w-full [&_img]:rounded-md"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}

function TextViewer({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const lines = useMemo(() => text.split("\n"), [text]);

  function handleCopy() {
    void navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex items-center justify-between border-b bg-gray-50/90 px-4 py-2 text-xs">
        <span className="text-gray-600">{lines.length} dòng văn bản</span>
        <button
          type="button"
          onClick={handleCopy}
          className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white px-2.5 py-1 text-gray-700 hover:bg-gray-100"
        >
          {copied ? (
            <>
              <IconCheck className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-emerald-700 font-medium">Đã sao chép!</span>
            </>
          ) : (
            <>
              <IconCopy className="h-3.5 w-3.5" />
              <span>Sao chép toàn bộ</span>
            </>
          )}
        </button>
      </div>
      <div className="flex-1 overflow-auto bg-gray-900 p-4 font-mono text-xs text-gray-200">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx} className="hover:bg-gray-800/60">
                <td className="w-10 pr-4 text-right text-gray-500 select-none align-top">{idx + 1}</td>
                <td className="whitespace-pre-wrap break-all text-gray-100">{line || " "}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function FallbackViewer({
  fileName,
  sizeBytes,
  mimeType,
  sourceUrl,
}: {
  fileName: string;
  sizeBytes?: number;
  mimeType?: string | null;
  sourceUrl?: string | null;
}) {
  return (
    <div className="flex h-full flex-col items-center justify-center p-8 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 shadow-xs">
        <IconFile className="h-8 w-8" />
      </div>
      <h4 className="text-base font-semibold text-gray-900 [overflow-wrap:anywhere] max-w-md">{fileName}</h4>
      <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
        {sizeBytes !== undefined ? <span>{formatBytes(sizeBytes)}</span> : null}
        {mimeType ? (
          <>
            <span>·</span>
            <span>{mimeType}</span>
          </>
        ) : null}
      </div>
      <p className="mt-4 max-w-sm text-sm text-gray-600">
        Định dạng này chưa hỗ trợ xem trước trực tiếp trên trình duyệt. Bạn có thể mở liên kết hoặc tải tệp về thiết bị.
      </p>
      {sourceUrl ? (
        <a
          href={sourceUrl}
          download={fileName}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:opacity-90"
        >
          <IconDownloadFile className="h-4 w-4" />
          <span>Tải file về máy</span>
        </a>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                               Main ViewDocs                                */
/* -------------------------------------------------------------------------- */

export function ViewDocs({ file, url, fileName, sizeBytes, mimeType, className = "" }: ViewDocsProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [arrayBuffer, setArrayBuffer] = useState<ArrayBuffer | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);

  const docKind = useMemo(() => detectDocKind(fileName, mimeType), [fileName, mimeType]);

  // Load resource
  useEffect(() => {
    let unmounted = false;
    let localBlobUrl: string | null = null;

    async function loadData() {
      setLoading(true);
      setError(null);
      try {
        if (file) {
          // File object từ trình duyệt
          if (docKind === "image" || docKind === "pdf") {
            localBlobUrl = URL.createObjectURL(file);
            if (!unmounted) setObjectUrl(localBlobUrl);
          } else if (docKind === "excel" || docKind === "word") {
            const buf = await file.arrayBuffer();
            if (!unmounted) setArrayBuffer(buf);
          } else if (docKind === "text") {
            const txt = await file.text();
            if (!unmounted) setTextContent(txt);
          }
        } else if (url) {
          // URL từ server hoặc cloud
          if (docKind === "image" || docKind === "pdf") {
            if (!unmounted) setObjectUrl(url);
          } else if (docKind === "excel" || docKind === "word") {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Không thể nạp tệp từ máy chủ (${res.status})`);
            const buf = await res.arrayBuffer();
            if (!unmounted) setArrayBuffer(buf);
          } else if (docKind === "text") {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Không thể nạp tệp từ máy chủ (${res.status})`);
            const txt = await res.text();
            if (!unmounted) setTextContent(txt);
          }
        } else {
          throw new Error("Không có dữ liệu tệp hoặc đường dẫn xem trước.");
        }
      } catch (err) {
        if (!unmounted) {
          setError(err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải nội dung tệp.");
        }
      } finally {
        if (!unmounted) setLoading(false);
      }
    }

    void loadData();

    return () => {
      unmounted = true;
      if (localBlobUrl) {
        URL.revokeObjectURL(localBlobUrl);
      }
    };
  }, [file, url, docKind]);

  if (loading) {
    return (
      <div className={`flex h-64 w-full flex-col items-center justify-center p-8 text-center text-gray-500 ${className}`}>
        <span className="inline-block h-8 w-8 animate-spin rounded-full border-3 border-primary border-t-transparent mb-3" />
        <p className="text-sm font-medium">Đang chuẩn bị nội dung xem trước...</p>
        <p className="text-xs text-gray-400 mt-1">{fileName}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex h-64 w-full flex-col items-center justify-center p-8 text-center ${className}`}>
        <div className="mb-3 rounded-full bg-red-100 p-3 text-red-600">
          <IconFile className="h-6 w-6" />
        </div>
        <p className="font-semibold text-gray-900">Không thể xem trước tệp</p>
        <p className="mt-1 max-w-md text-sm text-red-600">{error}</p>
        {(url || objectUrl) && (
          <a
            href={url || objectUrl || undefined}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
          >
            <IconExternal className="h-3.5 w-3.5" />
            <span>Thử mở bằng trình duyệt</span>
          </a>
        )}
      </div>
    );
  }

  const effectiveUrl = objectUrl || url;

  return (
    <div className={`h-full w-full overflow-hidden ${className}`}>
      {docKind === "image" && effectiveUrl ? (
        <ImageViewer sourceUrl={effectiveUrl} fileName={fileName} />
      ) : docKind === "pdf" && effectiveUrl ? (
        <PdfViewer sourceUrl={effectiveUrl} fileName={fileName} />
      ) : docKind === "excel" && arrayBuffer ? (
        <ExcelViewer buffer={arrayBuffer} />
      ) : docKind === "word" && arrayBuffer ? (
        <WordViewer buffer={arrayBuffer} fileName={fileName} />
      ) : docKind === "text" && textContent !== null ? (
        <TextViewer text={textContent} />
      ) : (
        <FallbackViewer
          fileName={fileName}
          sizeBytes={sizeBytes}
          mimeType={mimeType}
          sourceUrl={effectiveUrl}
        />
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*                              ViewDocsModal                                 */
/* -------------------------------------------------------------------------- */

export function ViewDocsModal({
  open,
  onClose,
  file,
  url,
  fileName,
  sizeBytes,
  mimeType,
  returnFocusRef,
}: ViewDocsModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  function handleBackdrop(e: MouseEvent<HTMLDialogElement>) {
    if (e.target === dialogRef.current) {
      onClose();
    }
  }

  function handleCloseEvent() {
    onClose();
    returnFocusRef?.current?.focus();
  }

  if (!open) return null;

  const docKind = detectDocKind(fileName, mimeType);
  const kindBadge: Record<DocKind, { label: string; color: string }> = {
    image: { label: "Hình ảnh", color: "bg-blue-50 text-blue-700 border-blue-200" },
    pdf: { label: "PDF", color: "bg-red-50 text-red-700 border-red-200" },
    excel: { label: "Excel", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
    word: { label: "Word", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    text: { label: "Văn bản", color: "bg-gray-100 text-gray-700 border-gray-300" },
    other: { label: "Tài liệu", color: "bg-purple-50 text-purple-700 border-purple-200" },
  };

  const badge = kindBadge[docKind];

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClose={handleCloseEvent}
      onClick={handleBackdrop}
      aria-modal="true"
      aria-labelledby={titleId}
      className="m-auto h-[90vh] w-[95vw] max-w-6xl rounded-2xl border-0 p-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-xs flex flex-col overflow-hidden"
    >
      {/* Modal Header */}
      <div className="flex items-center justify-between border-b bg-white px-5 py-3.5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-700">
            {docKind === "word" ? (
              <IconDoc className="h-5 w-5" />
            ) : docKind === "excel" ? (
              <IconFile className="h-5 w-5 text-emerald-600" />
            ) : (
              <IconFile className="h-5 w-5" />
            )}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 id={titleId} className="truncate text-base font-semibold text-gray-900" title={fileName}>
                {fileName}
              </h2>
              <span className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${badge.color}`}>
                {badge.label}
              </span>
            </div>
            {sizeBytes ? (
              <p className="text-xs text-gray-500 tabular-nums">{formatBytes(sizeBytes)}</p>
            ) : null}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          {url ? (
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              title="Mở trong tab mới"
              className="hidden sm:inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <IconExternal className="h-4 w-4" />
              <span>Mở tab mới</span>
            </a>
          ) : null}

          {url ? (
            <a
              href={url}
              download={fileName}
              title="Tải tệp xuống thiết bị"
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-xs font-semibold text-gray-700 hover:bg-gray-50"
            >
              <IconDownloadFile className="h-4 w-4" />
              <span className="hidden sm:inline">Tải về</span>
            </a>
          ) : null}

          <button
            type="button"
            onClick={onClose}
            aria-label="Đóng hộp thoại xem trước"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
          >
            <IconClose className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Modal Body */}
      <div className="flex-1 overflow-hidden bg-gray-50">
        <ViewDocs
          file={file}
          url={url}
          fileName={fileName}
          sizeBytes={sizeBytes}
          mimeType={mimeType}
          className="h-full"
        />
      </div>
    </dialog>
  );
}
