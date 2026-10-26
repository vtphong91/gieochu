"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { IconCheckCircle, IconCopy } from "../admin/_ui/icons";
import { formatVndFull } from "../admin/_ui/stats-chart";

/**
 * ADR-059 bổ sung lần 3 — khối thanh toán **Ví MoMo (chuyển tay)** (`checkoutPayload.kind === "WALLET"`). Dùng ở checkout đơn
 * tài liệu (PaymentScope TENANT) và trang gói Studio (PaymentScope PLATFORM). Thuần trình bày, không truy vấn.
 *
 * MARKUP TỐI THIỂU (Hiếu) — Phong hoàn thiện giao diện theo ảnh mẫu của chủ dự án; contract ở `WalletTransferPanelProps`.
 * - Các ô chỉ đọc có nút sao chép: Ví MoMo, Số điện thoại MoMo, Tên chủ tài khoản, Nội dung chuyển khoản (bắt buộc), Số tiền.
 * - Có VietQR (`qrImageDataUrl`) khi người nhận đã điền số tài khoản VietQR của ví; không có → chỉ thông tin.
 * - "Chuyển khoản sau" là link (`laterHref`); "Tôi đã chuyển khoản" chỉ hiện lời nhắn tại chỗ — KHÔNG đổi trạng thái đơn (người
 *   nhận xác nhận tay theo lịch sử ví).
 */
export type WalletTransferPanelProps = {
  phone: string;
  accountName: string;
  /** Nội dung chuyển khoản bắt buộc (mã đơn / mã hoá đơn). */
  content: string;
  amountVnd: number;
  /** Data URL PNG VietQR sinh ở server; `null` = không có QR. */
  qrImageDataUrl: string | null;
  referenceCode: string;
  /** "đơn hàng" | "hoá đơn". */
  referenceNoun: string;
  /** Đích của nút "Chuyển khoản sau". */
  laterHref: string;
};

type Row = { key: string; label: string; srName: string; display: string; copyValue: string; highlight?: boolean };

const COPIED_RESET_MS = 2500;
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

export function WalletTransferPanel({ phone, accountName, content, amountVnd, qrImageDataUrl, referenceCode, referenceNoun, laterHref }: WalletTransferPanelProps) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [declaredPaid, setDeclaredPaid] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const rows: Row[] = [
    { key: "wallet", label: "Ví", srName: "tên ví", display: "Ví MoMo", copyValue: "MoMo" },
    { key: "phone", label: "Số điện thoại MoMo", srName: "số điện thoại MoMo", display: phone, copyValue: phone },
    { key: "accountName", label: "Tên chủ tài khoản", srName: "tên chủ tài khoản", display: accountName, copyValue: accountName },
    { key: "content", label: "Nội dung chuyển khoản (bắt buộc)", srName: "nội dung chuyển khoản", display: content, copyValue: content, highlight: true },
    { key: "amount", label: "Số tiền", srName: "số tiền", display: formatVndFull(amountVnd), copyValue: String(Math.trunc(amountVnd)) },
  ];

  async function copy(row: Row) {
    if (timer.current) clearTimeout(timer.current);
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
    <div style={{ color: brandColors.ink }}>
      {qrImageDataUrl ? (
        <div className="mb-4 flex justify-center">
          {/* eslint-disable-next-line @next/next/no-img-element -- data URL sinh ở server, không qua next/image */}
          <img
            src={qrImageDataUrl}
            alt={`Mã QR chuyển tiền MoMo cho ${referenceNoun} ${referenceCode}`}
            width={192}
            height={192}
            className="h-48 w-48 rounded-lg border bg-white p-2"
            style={{ borderColor: brandColors.line }}
          />
        </div>
      ) : null}

      <dl className="divide-y rounded-xl border" style={{ borderColor: brandColors.line }}>
        {rows.map((row) => {
          const copied = copiedKey === row.key;
          return (
            <div key={row.key} className="flex items-center gap-3 px-3.5 py-2.5" style={{ borderColor: brandColors.line }}>
              <div className="min-w-0 flex-1">
                <dt className="text-xs font-medium" style={{ color: brandColors.inkSoft }}>
                  {row.label}
                </dt>
                <dd className="mt-0.5 text-base font-semibold [overflow-wrap:anywhere]">
                  <span className="select-all">{row.display}</span>
                </dd>
              </div>
              <button
                type="button"
                onClick={() => void copy(row)}
                aria-label={`${copied ? "Đã chép" : "Sao chép"} ${row.srName}`}
                className={`inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-1.5 rounded-lg border bg-white px-3 text-sm font-medium ${FOCUS}`}
                style={{ borderColor: brandColors.line }}
              >
                {copied ? <IconCheckCircle className="h-4 w-4" /> : <IconCopy className="h-4 w-4" />}
                {copied ? "Đã chép" : "Sao chép"}
              </button>
            </div>
          );
        })}
      </dl>

      <p className="mt-3 text-sm leading-relaxed" style={{ color: brandColors.inkSoft }}>
        Điền <strong className="font-semibold">đúng nội dung chuyển khoản</strong> để {referenceNoun} được xác nhận. Người nhận đối chiếu lịch sử ví
        MoMo rồi xác nhận thủ công.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link href={laterHref} className={`inline-flex min-h-11 items-center rounded-lg border px-4 text-sm font-semibold ${FOCUS}`} style={{ borderColor: brandColors.line }}>
          Chuyển khoản sau
        </Link>
        <button
          type="button"
          onClick={() => setDeclaredPaid(true)}
          className={`inline-flex min-h-11 cursor-pointer items-center rounded-lg px-4 text-sm font-semibold text-white ${FOCUS}`}
          style={{ background: brandColors.primary }}
        >
          Tôi đã chuyển khoản
        </button>
      </div>
      {declaredPaid ? (
        <p role="status" className="mt-3 text-sm leading-relaxed">
          Cảm ơn bạn. {referenceNoun.charAt(0).toUpperCase() + referenceNoun.slice(1)} sẽ được xác nhận khi người nhận đối chiếu xong — bạn không cần
          chuyển lại.
        </p>
      ) : null}

      <p role="status" aria-live="polite" className="sr-only">
        {status}
      </p>
    </div>
  );
}
