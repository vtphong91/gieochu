"use client";

import { useEffect, useId, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconCheckCircle, IconCopy, IconDownload } from "../admin/_ui/icons";
import { formatVndFull } from "../admin/_ui/stats-chart";
import type { TransferRow } from "./transfer-rows";

/**
 * ADR-062 — khối chuyển khoản dùng chung cho **ngân hàng (QR)** và **Ví MoMo**: ảnh QR + "Tải ảnh QR" + các dòng có nút
 * "Sao chép". Một kiểu dòng, một vùng `aria-live` cho cả khối. Thuần trình bày, không truy vấn; dòng dựng bằng
 * `bankTransferRows`/`walletTransferRows` (`./transfer-rows`).
 *
 * `order`:
 *  - `"info-first"` (mặc định — Studio billing giữ thứ tự cũ, §24.3): mobile thông tin trước, QR sau; từ `sm` QR trước.
 *  - `"qr-first"` (trang checkout của khách, ADR-062 Q10): QR 224px luôn trước + "Số tiền cần chuyển" lớn + "Tải ảnh QR"
 *    ngay dưới QR (khách tải ảnh rồi "quét từ ảnh" trong app ngân hàng).
 *
 * QR là data URL PNG sinh ở server → tải bằng `<a download>` trực tiếp, KHÔNG `fetch()` (CSP `connect-src` không có `data:`).
 */
export type TransferDetailsProps = {
  rows: TransferRow[];
  /** `null` = không có QR (vd. ví MoMo chưa khai báo số TK VietQR) → chỉ hiện thông tin. */
  qr: { dataUrl: string; alt: string; caption?: string } | null;
  amountVnd: number;
  /** Mã đơn / mã hoá đơn — dùng trong tên file ảnh QR. */
  referenceCode: string;
  order?: "info-first" | "qr-first";
  /** Câu dẫn trên khối: bản mobile (< sm) và bản rộng. */
  intro: { mobile: string; wide: string };
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

export function TransferDetails({ rows, qr, amountVnd, referenceCode, order = "info-first", intro }: TransferDetailsProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uid = useId();
  const qrFirst = order === "qr-first";
  const qrSize = qrFirst ? 224 : 192;

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function copy(row: TransferRow) {
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

  const downloadLink = qr ? (
    <a
      href={qr.dataUrl}
      download={`QR-${safeFilePart(referenceCode)}.png`}
      className={`inline-flex min-h-11 w-full max-w-56 touch-manipulation items-center justify-center gap-2 rounded-lg border px-4 text-sm font-semibold transition-colors hover:bg-[color:var(--color-primary)] hover:text-white motion-reduce:transition-none ${FOCUS}`}
      style={{ borderColor: "var(--color-primary)", color: "var(--color-primary)" }}
    >
      <IconDownload className="h-4 w-4" />
      Tải ảnh QR
    </a>
  ) : null;

  const amountHero = (
    <p className="text-center">
      <span className="block text-xs font-medium" style={{ color: INK_SOFT }}>
        Số tiền cần chuyển
      </span>
      <span className="mt-0.5 block font-[family-name:var(--font-heading)] text-[28px] leading-tight font-bold tabular-nums">{formatVndFull(amountVnd)}</span>
    </p>
  );

  return (
    <div className="@container" style={{ color: INK }}>
      <p className="text-sm leading-relaxed sm:hidden" style={{ color: INK_SOFT }}>
        {intro.mobile}
      </p>
      <p className="hidden text-sm leading-relaxed sm:block" style={{ color: INK_SOFT }}>
        {intro.wide}
      </p>

      <div className={`mt-4 grid gap-5 @lg:items-start ${qr ? (qrFirst ? "@lg:grid-cols-[14rem_minmax(0,1fr)]" : "@lg:grid-cols-[12rem_minmax(0,1fr)]") : ""}`}>
        {qr ? (
          <div className={`flex flex-col items-center gap-3 ${qrFirst ? "" : "order-2 sm:order-1"}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL sinh ở server, không qua next/image */}
            <img
              src={qr.dataUrl}
              alt={qr.alt}
              width={qrSize}
              height={qrSize}
              className={`${qrFirst ? "h-56 w-56" : "h-48 w-48"} rounded-lg border bg-white p-2`}
              style={{ borderColor: LINE }}
            />
            {qr.caption ? (
              <p className="-mt-1 text-sm font-semibold" style={{ color: INK }}>
                {qr.caption}
              </p>
            ) : null}
            {qrFirst ? amountHero : null}
            {downloadLink}
          </div>
        ) : qrFirst ? (
          amountHero
        ) : null}

        <dl className={`divide-y rounded-xl border ${qr && !qrFirst ? "order-1 sm:order-2" : ""}`} style={{ borderColor: LINE }}>
          {rows.map((row) => {
            const copied = copiedKey === row.key;
            const noteId = row.note ? `${uid}-${row.key}-note` : undefined;
            return (
              <div
                key={row.key}
                className="flex items-center gap-3 px-3.5 py-2.5 first:rounded-t-xl last:rounded-b-xl"
                style={{ borderColor: LINE, background: row.note ? brandColors.accentSoft : undefined }}
              >
                <div className="min-w-0 flex-1">
                  <dt className="text-xs font-medium" style={{ color: row.note ? INK : INK_SOFT }}>
                    {row.label}
                  </dt>
                  <dd className="mt-0.5 text-base font-semibold [overflow-wrap:anywhere]">
                    <span className={`select-all ${row.mono ? "tabular-nums tracking-wide" : ""}`}>{row.display}</span>
                    {row.detail ? (
                      <span className="block text-xs font-normal" style={{ color: INK_SOFT }}>
                        {row.detail}
                      </span>
                    ) : null}
                    {row.note ? (
                      <span id={noteId} className="mt-1 block text-xs font-normal leading-relaxed" style={{ color: INK }}>
                        {row.note}
                      </span>
                    ) : null}
                  </dd>
                </div>
                <button
                  type="button"
                  onClick={() => void copy(row)}
                  aria-label={`${copied ? "Đã chép" : "Sao chép"} ${row.srName}`}
                  aria-describedby={noteId}
                  className={`inline-flex min-h-11 min-w-[6.75rem] shrink-0 cursor-pointer touch-manipulation items-center justify-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium transition-colors hover:bg-[color:var(--color-primary)] hover:text-white motion-reduce:transition-none ${FOCUS}`}
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
