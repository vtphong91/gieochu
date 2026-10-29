"use client";

import Link from "next/link";
import { useState } from "react";
import { brandColors } from "@gieochu/config/theme";
import { TransferDetails } from "./transfer-details";
import { walletTransferRows } from "./transfer-rows";

/**
 * ADR-059 bổ sung lần 3 — khối thanh toán **Ví MoMo (chuyển thủ công)** của **Studio `/studio/[tenantSlug]/billing`**
 * (PaymentScope PLATFORM). Từ ADR-062 phần QR + dòng sao chép dùng chung `TransferDetails` (thêm "Tải ảnh QR", bỏ dòng sao
 * chép chữ "MoMo"); thứ tự giữ như billing cũ (`info-first`). Trang checkout của khách KHÔNG dùng component này — dựng
 * `TransferDetails` trực tiếp, nút "Tôi đã chuyển khoản" ở đó lưu thật (ADR-062 Q1).
 *
 * Ở billing, "Tôi đã chuyển khoản" chỉ hiện lời nhắn tại chỗ — KHÔNG đổi trạng thái hoá đơn (quản trị đối chiếu lịch sử ví
 * rồi xác nhận thủ công).
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

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-primary)]";

export function WalletTransferPanel({ phone, accountName, content, amountVnd, qrImageDataUrl, referenceCode, referenceNoun, laterHref }: WalletTransferPanelProps) {
  const [declaredPaid, setDeclaredPaid] = useState(false);

  return (
    <div style={{ color: brandColors.ink }}>
      <TransferDetails
        rows={walletTransferRows({
          phone,
          accountName,
          amountVnd,
          content,
          contentNote: `Nhập đúng nguyên văn nội dung này để người nhận nhận ra ${referenceNoun} của bạn.`,
        })}
        qr={qrImageDataUrl ? { dataUrl: qrImageDataUrl, alt: `Mã QR chuyển tiền MoMo cho ${referenceNoun} ${referenceCode}` } : null}
        amountVnd={amountVnd}
        referenceCode={referenceCode}
        intro={
          qrImageDataUrl
            ? {
                mobile: "Mở app MoMo → Chuyển tiền → nhập số điện thoại bên dưới, hoặc tải ảnh QR và quét từ ảnh.",
                wide: "Quét mã QR bằng app MoMo, hoặc chuyển tiền theo số điện thoại bên dưới.",
              }
            : {
                // Bổ sung ADR-059 lần 4: MoMo thủ công không còn QR — chỉ chuyển theo số điện thoại.
                mobile: "Mở app MoMo → Chuyển tiền → nhập số điện thoại và nội dung bên dưới.",
                wide: "Mở app MoMo → Chuyển tiền → nhập số điện thoại, số tiền và nội dung bên dưới.",
              }
        }
      />

      <p className="mt-3 text-sm leading-relaxed" style={{ color: brandColors.inkSoft }}>
        Điền <strong className="font-semibold">đúng nội dung chuyển khoản</strong> để {referenceNoun} được xác nhận. Người nhận đối chiếu lịch sử ví
        MoMo rồi xác nhận thủ công.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={laterHref}
          className={`inline-flex min-h-11 touch-manipulation items-center rounded-lg border px-4 text-sm font-semibold hover:bg-gray-50 ${FOCUS}`}
          style={{ borderColor: brandColors.line }}
        >
          Chuyển khoản sau
        </Link>
        <button
          type="button"
          onClick={() => setDeclaredPaid(true)}
          className={`inline-flex min-h-11 cursor-pointer touch-manipulation items-center rounded-lg px-4 text-sm font-semibold text-white hover:brightness-110 ${FOCUS}`}
          style={{ background: brandColors.primary }}
        >
          Tôi đã chuyển khoản
        </button>
      </div>
      <p role="status" className="mt-3 text-sm leading-relaxed">
        {declaredPaid
          ? `Cảm ơn bạn. ${referenceNoun.charAt(0).toUpperCase() + referenceNoun.slice(1)} sẽ được xác nhận khi người nhận đối chiếu xong — bạn không cần chuyển lại.`
          : null}
      </p>
    </div>
  );
}
