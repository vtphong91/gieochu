"use client";

import { TransferDetails } from "./transfer-details";
import { bankTransferRows, defaultContentNote } from "./transfer-rows";

/**
 * Khối thanh toán chuyển khoản (checkout kiểu QR — MANUAL_QR/SePay) của **Studio `/studio/[tenantSlug]/billing`** (tenant trả
 * hoá đơn gói, PaymentScope PLATFORM). Từ ADR-062 là lớp bọc mỏng quanh `TransferDetails` dùng chung; giữ nguyên props và
 * thứ tự cũ (§24.3): mobile thông tin + nút sao chép TRƯỚC ảnh QR, từ `sm` QR lên trước. Trang checkout của khách dựng
 * `TransferDetails` trực tiếp với `order="qr-first"`.
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

export function BankTransferPanel({ qrImageDataUrl, bank, accountNo, accountName, amountVnd, content, referenceCode, referenceNoun }: BankTransferPanelProps) {
  return (
    <TransferDetails
      rows={bankTransferRows({ bank: bank ?? null, accountNo, accountName, amountVnd, content, contentNote: defaultContentNote(referenceNoun) })}
      qr={{ dataUrl: qrImageDataUrl, alt: `Mã QR chuyển khoản cho ${referenceNoun} ${referenceCode}` }}
      amountVnd={amountVnd}
      referenceCode={referenceCode}
      intro={{
        mobile: "Sao chép từng dòng bên dưới rồi dán vào ứng dụng ngân hàng — hoặc tải ảnh QR và chọn quét mã từ ảnh trong ứng dụng.",
        wide: "Quét mã QR bằng ứng dụng ngân hàng, hoặc chuyển khoản thủ công theo thông tin bên dưới.",
      }}
    />
  );
}
