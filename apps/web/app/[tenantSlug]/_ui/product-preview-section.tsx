"use client";

import { useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import type { PublicProductPreviewFile } from "../../../lib/product-file-preview";
import { ProductPreviewModal } from "./product-preview-modal";

// ADR-063 UI (Phong): trang hệ thống (ADR-025) → dùng brandColors + font hệ thống, không theme tenant.

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const PRIMARY = brandColors.primary;
const ACCENT_SOFT = brandColors.accentSoft;
const ACCENT = brandColors.accent;

type IconKind = "docx" | "xlsx" | "pdf" | "text" | "unknown";

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

/**
 * Chọn icon theo kind cache hoặc đuôi file (khi "pending"/"unsupported" vẫn muốn gợi ý định dạng).
 */
export function inferIconKind(file: PublicProductPreviewFile): IconKind {
  if (file.kind === "docx" || file.kind === "xlsx" || file.kind === "pdf" || file.kind === "text") {
    return file.kind;
  }
  const name = file.fileName.toLowerCase();
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".") + 1) : "";
  if (ext === "docx" || ext === "doc") return "docx";
  if (ext === "xlsx" || ext === "xls" || ext === "csv") return "xlsx";
  if (ext === "pdf") return "pdf";
  if (ext === "txt" || ext === "md" || ext === "json") return "text";
  return "unknown";
}

const BADGE_PALETTE: Record<IconKind, { bg: string; fg: string; label: string }> = {
  docx: { bg: "#DBEAFE", fg: "#1E40AF", label: "DOC" },
  xlsx: { bg: "#DCFCE7", fg: "#166534", label: "XLS" },
  pdf: { bg: "#FEE2E2", fg: "#B91C1C", label: "PDF" },
  text: { bg: "#E2E8F0", fg: "#334155", label: "TXT" },
  unknown: { bg: "#F1F5F9", fg: "#475569", label: "FILE" },
};

/**
 * Icon file "trung tính" (line icon) + chữ nhỏ phía dưới ghi loại — tiết kiệm diện tích, nhất quán phong cách.
 */
export function FileFormatIcon({ kind, className }: { kind: IconKind; className?: string }) {
  const palette = BADGE_PALETTE[kind];
  return (
    <span
      aria-hidden="true"
      className={`inline-flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl border font-semibold ${className ?? ""}`}
      style={{ background: palette.bg, color: palette.fg, borderColor: palette.bg }}
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" className="h-5 w-5">
        <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
        <path d="M14 3v5h5" />
      </svg>
      <span className="text-[9px] leading-none tracking-wide">{palette.label}</span>
    </span>
  );
}

/** Icon kẹp giấy cạnh tiêu đề section. */
function PaperclipIcon({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
    >
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}

function MetaLine({ file }: { file: PublicProductPreviewFile }) {
  const parts: string[] = [];
  if (file.sizeBytes > 0) parts.push(formatBytes(file.sizeBytes));
  if (file.pageCount) parts.push(`${file.pageCount} trang`);
  if (file.totalRows) parts.push(`${file.totalRows} hàng`);
  if (!file.pageCount && !file.totalRows && file.totalCharsEstimate) {
    parts.push(`${file.totalCharsEstimate.toLocaleString("vi-VN")} ký tự`);
  }
  if (parts.length === 0) return null;
  return (
    <span className="mt-1 block truncate text-xs" style={{ color: INK_SOFT }}>
      {parts.join(" · ")}
    </span>
  );
}

function PreviewBadge({ tone = "primary" }: { tone?: "primary" | "muted" }) {
  if (tone === "muted") {
    return (
      <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: "#F1F5F9", color: INK_SOFT }}>
        Chưa hỗ trợ
      </span>
    );
  }
  return (
    <span className="inline-flex shrink-0 items-center rounded-full px-2.5 py-1 text-[11px] font-semibold" style={{ background: ACCENT_SOFT, color: ACCENT }}>
      Xem trước 20%
    </span>
  );
}

/** Skeleton khi tất cả file đang pending (chưa quét/trích xong). */
function PendingSkeleton() {
  return (
    <li aria-hidden="true">
      <div className="flex animate-pulse items-center gap-3 rounded-xl border px-4 py-3" style={{ borderColor: LINE, background: "#FFFFFF" }}>
        <div className="h-11 w-11 rounded-xl" style={{ background: "#F1F5F9" }} />
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-3.5 w-3/5 rounded" style={{ background: "#F1F5F9" }} />
          <div className="h-3 w-2/5 rounded" style={{ background: "#F1F5F9" }} />
        </div>
      </div>
    </li>
  );
}

export function ProductPreviewSection({
  files,
  tenantSlug,
  productSlug,
}: {
  files: PublicProductPreviewFile[];
  tenantSlug: string;
  productSlug: string;
}) {
  const [openFile, setOpenFile] = useState<PublicProductPreviewFile | null>(null);
  if (files.length === 0) return null;

  const allPending = files.every((f) => f.kind === "pending");
  const useGrid = files.length >= 4;

  return (
    <section aria-labelledby="adr063-tai-lieu-dinh-kem">
      <div className="flex items-center gap-2">
        <PaperclipIcon className="h-5 w-5" style={{ color: PRIMARY }} />
        <h2
          id="adr063-tai-lieu-dinh-kem"
          className="font-[family-name:var(--font-heading)] text-xl font-extrabold sm:text-2xl"
          style={{ color: INK }}
        >
          Tài liệu đính kèm
        </h2>
      </div>
      <span aria-hidden="true" className="mt-3 block h-[3px] w-[45px] rounded-full" style={{ background: ACCENT }} />
      <p className="mt-3 text-sm" style={{ color: INK_SOFT }}>
        Bấm vào một file để xem trước <strong>20% nội dung đầu</strong>. Mua tài liệu để xem đầy đủ.
      </p>

      {allPending ? (
        <>
          <p className="sr-only" aria-live="polite">
            Đang chuẩn bị bản xem trước, vui lòng quay lại sau ít phút.
          </p>
          <ul className="mt-5 flex flex-col gap-3">
            <PendingSkeleton />
            <PendingSkeleton />
          </ul>
        </>
      ) : (
        <ul className={`mt-5 ${useGrid ? "grid grid-cols-1 gap-3 sm:grid-cols-2" : "flex flex-col gap-3"}`}>
          {files.map((file) => {
            const iconKind = inferIconKind(file);
            const isPending = file.kind === "pending";
            const isUnsupported = file.kind === "unsupported";
            const disabled = isPending || isUnsupported;
            const tooltip = isPending
              ? "Đang chuẩn bị bản xem trước…"
              : isUnsupported
                ? "Định dạng chưa hỗ trợ xem trước"
                : undefined;

            return (
              <li key={file.id}>
                <button
                  type="button"
                  onClick={() => (disabled ? undefined : setOpenFile(file))}
                  disabled={disabled}
                  title={tooltip}
                  aria-disabled={disabled || undefined}
                  aria-describedby={isPending ? `preview-pending-${file.id}` : undefined}
                  className="group relative flex w-full min-h-[76px] items-center gap-3 rounded-xl border bg-white px-4 py-3 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--color-primary)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 enabled:hover:-translate-y-0.5 enabled:hover:shadow-md"
                  style={{ borderColor: LINE, color: INK }}
                  onMouseEnter={(e) => {
                    if (!disabled) e.currentTarget.style.borderColor = PRIMARY;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = LINE;
                  }}
                  onFocus={(e) => {
                    if (!disabled) e.currentTarget.style.borderColor = PRIMARY;
                  }}
                  onBlur={(e) => {
                    e.currentTarget.style.borderColor = LINE;
                  }}
                >
                  <FileFormatIcon kind={iconKind} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-semibold" style={{ color: INK }}>
                      {file.fileName}
                    </span>
                    <MetaLine file={file} />
                    {isPending ? (
                      <span id={`preview-pending-${file.id}`} className="mt-1 block text-xs" style={{ color: INK_SOFT }}>
                        Đang chuẩn bị bản xem trước…
                      </span>
                    ) : null}
                    {isUnsupported ? (
                      <span className="mt-1 block text-xs" style={{ color: INK_SOFT }}>
                        Định dạng chưa hỗ trợ xem trước.
                      </span>
                    ) : null}
                  </span>
                  {isPending || isUnsupported ? <PreviewBadge tone="muted" /> : <PreviewBadge />}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {openFile ? (
        <ProductPreviewModal
          // Key theo file.id → đổi file làm remount, reset state fetch/error — tránh gọi setState trong effect body.
          key={openFile.id}
          file={openFile}
          tenantSlug={tenantSlug}
          productSlug={productSlug}
          onClose={() => setOpenFile(null)}
        />
      ) : null}
    </section>
  );
}
