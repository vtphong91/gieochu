import type { ReactNode } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconAlertTriangle, IconLock } from "../../../../admin/_ui/icons";

/**
 * Mảnh giao diện nhỏ dùng chung trong editor sản phẩm (không hook — import được từ cả Server lẫn Client
 * Component). Nút của kit cao ~40px; editor cần ≥44px trên mobile nên truyền lại className đầy đủ của kit
 * + `min-h-11` (khi truyền `className`, kit dùng className này thay cho class mặc định).
 */
export const PRIMARY_BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10";
export const GHOST_BTN =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-semibold transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-10";
/** Nút phụ trong dòng danh sách (Gỡ/Sửa) — 44px trên mobile, gọn hơn từ sm. */
export const ROW_BTN =
  "inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-lg px-2.5 text-xs font-semibold transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-8 sm:min-w-0";

/**
 * Chữ trạng thái thành công. `brandColors.secondary` (#16A34A) chỉ đạt ~3.3:1 trên nền trắng — đủ cho icon
 * nhưng KHÔNG đủ 4.5:1 cho chữ nhỏ; dùng sắc đậm hơn cùng họ (green-700, ~5:1). Đề xuất token riêng đã báo Quốc.
 */
export const GREEN_TEXT = "#15803D";

/** Nhãn dùng chung editor + trang Server (file này không "use client" nên Server Component import được giá trị). */
export const PRODUCT_TYPE_LABEL: Record<string, string> = {
  TEMPLATE: "Mẫu / Template",
  SLIDE: "Slide bài giảng",
  EBOOK: "Ebook",
  EXAM: "Đề thi / Đề kiểm tra",
  OTHER: "Khác",
};

export const PRODUCT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "Nháp",
  PUBLISHED: "Đã xuất bản",
  ARCHIVED: "Đã lưu trữ",
};

export const PRODUCT_STATUS_TONE: Record<string, "success" | "warning" | "neutral"> = {
  PUBLISHED: "success",
  DRAFT: "warning",
  ARCHIVED: "neutral",
};

const RED = "#DC2626";
const RED_SOFT = "#FEF2F2";
const RED_LINE = "#FCA5A5";
const AMBER = "#B45309";
const AMBER_SOFT = "#FFFBEB";
const AMBER_LINE = "#FDE68A";

/** Khối "chưa dùng được" ở trang Tạo — icon khoá + chữ (không chỉ dựa màu). */
export function LockedNotice({ children }: { children: ReactNode }) {
  return (
    <div
      className="flex items-start gap-3 rounded-xl border border-dashed px-4 py-5 text-sm"
      style={{ borderColor: "#D1D5DB", background: "#F9FAFB", color: brandColors.inkSoft }}
    >
      <IconLock className="mt-0.5 h-5 w-5 shrink-0" />
      <p>{children}</p>
    </div>
  );
}

/** Cảnh báo vàng (icon + chữ). `role` mặc định note — dùng "alert" chỉ khi cần đọc ngay. */
export function WarningNote({ children, title }: { children: ReactNode; title?: string }) {
  return (
    <div className="flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm" style={{ background: AMBER_SOFT, borderColor: AMBER_LINE, color: AMBER }}>
      <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="min-w-0">
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={title ? "mt-0.5" : undefined}>{children}</div>
      </div>
    </div>
  );
}

/** Thanh tiến độ có `role=progressbar` + phần trăm bằng chữ. `value` 0..1. */
export function ProgressBar({ label, value }: { label: string; value: number }) {
  const percent = Math.min(100, Math.max(0, Math.round(value * 100)));
  return (
    <div className="flex items-center gap-3">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}%`}
        className="h-2 flex-1 overflow-hidden rounded-full"
        style={{ background: "#E5E7EB" }}
      >
        <div className="h-full rounded-full transition-[width] duration-150 motion-reduce:transition-none" style={{ width: `${percent}%`, background: brandColors.primary }} />
      </div>
      <span className="w-10 shrink-0 text-right text-xs font-semibold tabular-nums" style={{ color: brandColors.ink }} aria-hidden="true">
        {percent}%
      </span>
    </div>
  );
}

/** Lỗi upload + nút Thử lại (error-recovery). */
export function UploadError({ message, onRetry, onDismiss }: { message: string; onRetry?: () => void; onDismiss?: () => void }) {
  return (
    <div role="alert" className="flex flex-wrap items-center gap-2 rounded-lg border px-3 py-2 text-sm" style={{ background: RED_SOFT, borderColor: RED_LINE, color: RED }}>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{message}</span>
      {onRetry ? (
        <button type="button" onClick={onRetry} className={ROW_BTN} style={{ background: "#FFFFFF", color: RED }}>
          Thử lại
        </button>
      ) : null}
      {onDismiss ? (
        <button type="button" onClick={onDismiss} className={ROW_BTN} style={{ background: "transparent", color: RED }}>
          Bỏ qua
        </button>
      ) : null}
    </div>
  );
}
