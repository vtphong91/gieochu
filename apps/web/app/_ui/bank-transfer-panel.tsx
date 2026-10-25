"use client";

import { useEffect, useId, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconCheckCircle, IconCopy, IconDownload } from "../admin/_ui/icons";
import { formatVndFull } from "../admin/_ui/stats-chart";

/**
 * Khối thanh toán chuyển khoản (checkout kiểu QR — MANUAL_QR/SePay): ảnh QR + nút "Tải ảnh QR" + bảng thông tin
 * chuyển khoản có nút sao chép từng dòng. Dùng chung cho:
 *  - Studio `/studio/[tenantSlug]/billing` — tenant trả hoá đơn gói (PaymentScope PLATFORM);
 *  - trang checkout `/[tenantSlug]/checkout/[orderCode]` — khách trả đơn tài liệu (PaymentScope TENANT).
 *
 * Thuần trình bày: không tự truy vấn. QR là data URL PNG sinh ở server (`qrcode.toDataURL`) nên tải bằng
 * `<a download>` trực tiếp — KHÔNG `fetch()` (CSP `connect-src` không có `data:`).
 *
 * Mobile: khối thông tin + nút sao chép đứng TRƯỚC ảnh QR (trên điện thoại không quét được QR của chính máy mình);
 * từ `sm` trở lên ảnh QR lên trước. Khung đủ rộng (container ≥ 32rem) thì QR và thông tin đặt cạnh nhau.
 */

export type BankTransferPanelProps = {
  qrImageDataUrl: string;
  /** Tên ngân hàng từ `bank_bins` theo `bank.bin`. Không có → ẩn dòng "Ngân hàng" (không hiện BIN thô). */
  bank?: { shortName: string; name: string } | null;
  accountNo: string;
  accountName: string;
  /** Số tiền VND (số nguyên) đã nhúng trong QR. */
  amountVnd: number;
  /** Nội dung chuyển khoản dùng để đối soát (mã đơn / mã hoá đơn). */
  content: string;
  /** Mã đơn hoặc mã hoá đơn — dùng trong tên file ảnh QR và alt text. */
  referenceCode: string;
  /** "đơn hàng" | "hoá đơn" — chèn vào alt text và chú thích. */
  referenceNoun: string;
};

type Row = {
  key: string;
  label: string;
  /** Tên đọc cho trình đọc màn hình trong "Sao chép …" (chữ thường). */
  srName: string;
  display: string;
  detail?: string;
  copyValue: string;
  mono?: boolean;
  highlight?: boolean;
};

const INK = brandColors.ink;
const INK_SOFT = brandColors.inkSoft;
const LINE = brandColors.line;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";
const COPIED_RESET_MS = 2500;

/** Bỏ ký tự không hợp lệ trong tên file (mã đơn/hoá đơn vốn chỉ gồm chữ-số-gạch). */
function safeFilePart(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "") || "thanh-toan";
}

export function BankTransferPanel({
  qrImageDataUrl,
  bank,
  accountNo,
  accountName,
  amountVnd,
  content,
  referenceCode,
  referenceNoun,
}: BankTransferPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const contentNoteId = useId();

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const rows: Row[] = [
    ...(bank
      ? [{ key: "bank", label: "Ngân hàng", srName: "tên ngân hàng", display: bank.shortName, detail: bank.name, copyValue: bank.shortName }]
      : []),
    { key: "accountNo", label: "Số tài khoản", srName: "số tài khoản", display: accountNo, copyValue: accountNo, mono: true },
    { key: "accountName", label: "Chủ tài khoản", srName: "tên chủ tài khoản", display: accountName, copyValue: accountName },
    {
      key: "amount",
      label: "Số tiền",
      srName: "số tiền",
      display: formatVndFull(amountVnd),
      copyValue: String(Math.trunc(amountVnd)),
    },
    { key: "content", label: "Nội dung chuyển khoản", srName: "nội dung chuyển khoản", display: content, copyValue: content, mono: true, highlight: true },
  ];

  async function copy(row: Row) {
    if (timer.current) clearTimeout(timer.current);
    // Xoá trước để bấm lại cùng một dòng vẫn được trình đọc màn hình đọc lại.
    setStatus("");
    try {
      await navigator.clipboard.writeText(row.copyValue);
      setCopiedKey(row.key);
      setStatus(`Đã sao chép ${row.srName}.`);
    } catch {
      setCopiedKey(null);
      setStatus(`Không sao chép được ${row.srName} — hãy chạm giữ vào chữ để chọn và sao chép thủ công.`);
    }
    timer.current = setTimeout(() => {
      setCopiedKey(null);
      setStatus("");
    }, COPIED_RESET_MS);
  }

  return (
    <div className="@container" style={{ color: INK }}>
      <p className="text-sm leading-relaxed sm:hidden" style={{ color: INK_SOFT }}>
        Sao chép từng dòng bên dưới rồi dán vào ứng dụng ngân hàng — hoặc tải ảnh QR và chọn quét mã từ ảnh trong ứng dụng.
      </p>
      <p className="hidden text-sm leading-relaxed sm:block" style={{ color: INK_SOFT }}>
        Quét mã QR bằng ứng dụng ngân hàng, hoặc chuyển khoản thủ công theo thông tin bên dưới.
      </p>

      <div className="mt-4 grid gap-5 @lg:grid-cols-[12rem_minmax(0,1fr)] @lg:items-start">
        {/* Ảnh QR: sau khối thông tin trên mobile, trước từ sm trở lên. */}
        <div className="order-2 flex flex-col items-center gap-3 sm:order-1">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL sinh ở server, không qua next/image */}
          <img
            src={qrImageDataUrl}
            alt={`Mã QR chuyển khoản cho ${referenceNoun} ${referenceCode}`}
            width={192}
            height={192}
            className="h-48 w-48 rounded-lg border bg-white p-2"
            style={{ borderColor: LINE }}
          />
          <a
            href={qrImageDataUrl}
            download={`QR-${safeFilePart(referenceCode)}.png`}
            className={`inline-flex min-h-11 w-full max-w-48 touch-manipulation items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors hover:bg-[color:var(--color-primary)] hover:text-white ${FOCUS}`}
            style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
          >
            <IconDownload className="h-4 w-4" />
            Tải ảnh QR
          </a>
        </div>

        <dl className="order-1 divide-y rounded-xl border sm:order-2" style={{ borderColor: LINE }}>
          {rows.map((row) => {
            const copied = copiedKey === row.key;
            return (
              <div
                key={row.key}
                className="flex items-center gap-3 px-3.5 py-2.5 first:rounded-t-xl last:rounded-b-xl"
                style={{ borderColor: LINE, background: row.highlight ? brandColors.accentSoft : undefined }}
              >
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-medium" style={{ color: INK_SOFT }}>
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 text-base font-semibold [overflow-wrap:anywhere]">
                    <span className={`select-all ${row.mono ? "tabular-nums tracking-wide" : ""}`}>{row.display}</span>
                    {row.detail ? (
                      <span className="block text-xs font-normal" style={{ color: INK_SOFT }}>
                        {row.detail}
                      </span>
                    ) : null}
                    {row.highlight ? (
                      <span id={contentNoteId} className="mt-1 block text-xs font-normal leading-relaxed" style={{ color: INK }}>
                        Nhập <strong className="font-semibold">đúng nguyên văn</strong> nội dung này để hệ thống tự đối soát {referenceNoun}. Sai hoặc
                        thiếu nội dung, thanh toán có thể không được xác nhận tự động.
                      </span>
                    ) : null}
                  </dd>
                </div>
                <button
                  type="button"
                  onClick={() => void copy(row)}
                  aria-label={`${copied ? "Đã chép" : "Sao chép"} ${row.srName}`}
                  aria-describedby={row.highlight ? contentNoteId : undefined}
                  className={`inline-flex min-h-11 min-w-[6.75rem] shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium transition-colors hover:bg-[color:var(--color-primary)] hover:text-white ${FOCUS}`}
                  style={{ borderColor: LINE }}
                >
                  {copied ? <IconCheckCircle className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
                  {copied ? "Đã chép" : "Sao chép"}
                </button>
              </div>
            );
          })}
        </dl>
      </div>

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
