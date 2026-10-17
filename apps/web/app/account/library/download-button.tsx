"use client";

import { useId, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { brandColors } from "@gieochu/config/theme";
import { ENTITLEMENT_REMEDY_ERROR_CODES } from "@gieochu/core/entitlement-remedy";
import { ConfirmDialog, LIBRARY_BTN, LIBRARY_ERROR_RED, LIBRARY_FOCUS } from "./_ui/confirm-dialog";

/** Mã lỗi `POST /api/downloads` → thông điệp tiếng Việt hiển thị cho khách (mã lạ → dùng `message` của server). */
const DOWNLOAD_ERROR_TEXT: Record<string, string> = {
  [ENTITLEMENT_REMEDY_ERROR_CODES.CHOICE_REQUIRED]:
    "Tài liệu này đã bị gỡ do vi phạm chính sách. Hãy chọn “Tải lần cuối” hoặc “Yêu cầu hoàn tiền” trong khung thông báo của tài liệu.",
  [ENTITLEMENT_REMEDY_ERROR_CODES.DOWNLOAD_BLOCKED_REFUND]: "Bạn đã yêu cầu hoàn tiền cho tài liệu này nên không thể tải xuống nữa.",
  DOWNLOAD_LIMIT_REACHED: "Bạn đã dùng hết lượt tải của tài liệu này.",
  ENTITLEMENT_REVOKED: "Quyền tải tài liệu này đã bị thu hồi.",
};

/** Lỗi cho thấy trạng thái trên trang đã cũ (khách mở 2 tab, gian hàng vừa đổi...) → làm mới dữ liệu trang. */
const STALE_STATE_CODES = new Set<string>([
  ENTITLEMENT_REMEDY_ERROR_CODES.CHOICE_REQUIRED,
  ENTITLEMENT_REMEDY_ERROR_CODES.DOWNLOAD_BLOCKED_REFUND,
  "DOWNLOAD_LIMIT_REACHED",
  "ENTITLEMENT_REVOKED",
]);

export interface DownloadButtonProps {
  fileId: string;
  disabled: boolean;
  label?: string;
  /** Tên tệp — bổ sung vào tên truy cập khi 1 tài liệu có nhiều tệp. */
  fileName?: string;
  /**
   * ADR-039 mục 2 — lượt tải cuối của tài liệu bị gỡ do vi phạm: bắt buộc đọc cảnh báo + tích cam kết trước khi tải.
   */
  finalDownload?: { productTitle: string };
}

/** §"M9": POST /api/downloads issues a single-use token URL; navigating to it triggers the actual (302) download. */
export function DownloadButton({ fileId, disabled, label = "Tải xuống", fileName, finalDownload }: DownloadButtonProps) {
  const router = useRouter();
  const uid = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, setIsPending] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [acknowledged, setAcknowledged] = useState(false);

  /** Trả về true khi đã chuyển hướng tới link tải. */
  async function download(): Promise<boolean> {
    setError(null);
    setIsPending(true);
    try {
      const response = await fetch("/api/downloads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ fileId }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const code: string | undefined = body?.error?.code;
        setError((code && DOWNLOAD_ERROR_TEXT[code]) ?? body?.error?.message ?? "Không tải được file. Vui lòng thử lại.");
        if (code && STALE_STATE_CODES.has(code)) router.refresh();
        return false;
      }
      window.location.href = body.url;
      return true;
    } catch {
      setError("Không tải được file. Kiểm tra kết nối mạng rồi thử lại.");
      return false;
    } finally {
      setIsPending(false);
    }
  }

  function handleClick() {
    if (finalDownload) {
      setError(null);
      setAcknowledged(false);
      setDialogOpen(true);
      return;
    }
    void download();
  }

  async function confirmFinalDownload() {
    if (!acknowledged) return;
    const ok = await download();
    if (ok) {
      setDialogOpen(false);
      // Lượt cuối đã dùng → làm mới để trang hiện "đã dùng lượt tải cuối" và khoá các nút tải.
      router.refresh();
    }
  }

  const errorId = `${uid}-error`;
  const ackId = `${uid}-ack`;

  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button
        ref={triggerRef}
        type="button"
        onClick={handleClick}
        disabled={disabled || isPending}
        aria-haspopup={finalDownload ? "dialog" : undefined}
        aria-describedby={error && !dialogOpen ? errorId : undefined}
        className={`inline-flex min-h-11 cursor-pointer items-center justify-center rounded-full border px-4 text-sm font-semibold transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent motion-reduce:transition-none lg:min-h-9 ${LIBRARY_FOCUS}`}
        style={{ color: brandColors.primary, borderColor: "currentColor" }}
      >
        {isPending && !dialogOpen ? "Đang chuẩn bị..." : label}
        {fileName ? <span className="sr-only">: {fileName}</span> : null}
      </button>
      {error && !dialogOpen ? (
        <p id={errorId} role="alert" className="max-w-xs text-xs sm:text-right" style={{ color: LIBRARY_ERROR_RED }}>
          {error}
        </p>
      ) : null}

      {finalDownload ? (
        <ConfirmDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          busy={isPending}
          returnFocusRef={triggerRef}
          title="Đây là lần tải cuối cùng"
          description={
            <p>
              <strong className="font-semibold">“{finalDownload.productTitle}” đã bị gỡ do vi phạm chính sách.</strong> Sau lần tải này bạn sẽ
              không tải lại được tài liệu.
            </p>
          }
          error={dialogOpen ? error : null}
          confirm={
            <button
              type="button"
              onClick={confirmFinalDownload}
              disabled={!acknowledged || isPending}
              className={`${LIBRARY_BTN} text-white hover:brightness-110`}
              style={{ background: brandColors.primary }}
            >
              {isPending ? "Đang chuẩn bị..." : "Tải lần cuối"}
            </button>
          }
        >
          <ul className="list-disc space-y-1 pl-5" style={{ color: brandColors.ink }}>
            <li>Tài liệu chỉ dùng cho mục đích cá nhân của bạn.</li>
            <li>Không chia sẻ, đăng lại hay phát tán tài liệu dưới bất kỳ hình thức nào.</li>
            <li>Bạn chịu hoàn toàn trách nhiệm nếu tài liệu bị phát tán từ bản đã tải.</li>
          </ul>
          <div className="flex items-start gap-3 rounded-xl border p-3" style={{ borderColor: brandColors.line }}>
            <input
              id={ackId}
              type="checkbox"
              checked={acknowledged}
              onChange={(event) => setAcknowledged(event.target.checked)}
              disabled={isPending}
              className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer accent-[color:var(--color-primary)]"
            />
            <label htmlFor={ackId} className="cursor-pointer font-medium">
              Tôi đã hiểu và cam kết chỉ dùng cá nhân, không phát tán tài liệu này.
            </label>
          </div>
        </ConfirmDialog>
      ) : null}
    </div>
  );
}
