import { formatVndFull } from "../admin/_ui/stats-chart";

/**
 * Dòng thông tin chuyển khoản cho `TransferDetails` (ADR-062). Module thuần (không "use client") để cả Server Component
 * (trang checkout) lẫn Client Component (`BankTransferPanel`/`WalletTransferPanel`) dựng cùng một danh sách dòng.
 */
export type TransferRow = {
  key: string;
  label: string;
  /** Tên đọc cho trình đọc màn hình trong "Sao chép …" (chữ thường). */
  srName: string;
  display: string;
  /** Dòng phụ dưới giá trị (vd. tên đầy đủ ngân hàng). */
  detail?: string;
  copyValue: string;
  /** Số/mã: chữ số đều (`tabular-nums`) + giãn chữ nhẹ. */
  mono?: boolean;
  /** Dòng bắt buộc (nội dung chuyển khoản): nền `accentSoft`, câu giải thích gắn `aria-describedby` vào nút sao chép. */
  note?: string;
};

/** Câu giải thích mặc định của dòng nội dung chuyển khoản (giữ nguyên chữ cũ của Studio billing). */
export function defaultContentNote(referenceNoun: string): string {
  return `Nhập đúng nguyên văn nội dung này để hệ thống tự đối soát ${referenceNoun}. Sai hoặc thiếu nội dung, thanh toán có thể không được xác nhận tự động.`;
}

function amountRow(amountVnd: number): TransferRow {
  // Sao chép số thuần (vd. 99000) để dán thẳng vào ô số tiền của app ngân hàng/ví.
  return { key: "amount", label: "Số tiền", srName: "số tiền", display: formatVndFull(amountVnd), copyValue: String(Math.trunc(amountVnd)), mono: true };
}

export function bankTransferRows({
  bank,
  accountNo,
  accountName,
  amountVnd,
  content,
  contentNote,
  contentFirst = false,
}: {
  bank?: { shortName: string; name: string } | null;
  accountNo: string;
  accountName: string;
  amountVnd: number;
  content: string;
  contentNote: string;
  /** `true` (trang checkout của khách): nội dung chuyển khoản lên đầu — dòng quan trọng nhất. `false`: thứ tự cũ của billing. */
  contentFirst?: boolean;
}): TransferRow[] {
  const contentRow: TransferRow = {
    key: "content",
    label: contentFirst ? "Nội dung chuyển khoản (bắt buộc)" : "Nội dung chuyển khoản",
    srName: "nội dung chuyển khoản",
    display: content,
    copyValue: content,
    mono: true,
    note: contentNote,
  };
  const rest: TransferRow[] = [
    ...(bank ? [{ key: "bank", label: "Ngân hàng", srName: "tên ngân hàng", display: bank.shortName, detail: bank.name, copyValue: bank.shortName }] : []),
    { key: "accountNo", label: "Số tài khoản", srName: "số tài khoản", display: accountNo, copyValue: accountNo, mono: true },
    { key: "accountName", label: "Chủ tài khoản", srName: "tên chủ tài khoản", display: accountName, copyValue: accountName },
    amountRow(amountVnd),
  ];
  return contentFirst ? [contentRow, ...rest] : [...rest, contentRow];
}

/**
 * Ví MoMo chuyển thủ công (ADR-059 bổ sung lần 3). Không có dòng "Ví: MoMo" — sao chép chữ "MoMo" vô ích; tên ví là tiêu đề
 * khối (đề xuất ADR-062 §2.2).
 */
export function walletTransferRows({
  phone,
  accountName,
  amountVnd,
  content,
  contentNote,
  contentFirst = false,
}: {
  phone: string;
  accountName: string;
  amountVnd: number;
  content: string;
  contentNote: string;
  contentFirst?: boolean;
}): TransferRow[] {
  const contentRow: TransferRow = {
    key: "content",
    label: "Nội dung chuyển khoản (bắt buộc)",
    srName: "nội dung chuyển khoản",
    display: content,
    copyValue: content,
    mono: true,
    note: contentNote,
  };
  const phoneRow: TransferRow = { key: "phone", label: "Số điện thoại MoMo", srName: "số điện thoại MoMo", display: phone, copyValue: phone, mono: true };
  const nameRow: TransferRow = { key: "accountName", label: "Tên chủ ví", srName: "tên chủ ví", display: accountName, copyValue: accountName };
  return contentFirst ? [contentRow, phoneRow, nameRow, amountRow(amountVnd)] : [phoneRow, nameRow, contentRow, amountRow(amountVnd)];
}
